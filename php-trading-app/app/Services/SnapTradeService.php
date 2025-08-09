<?php

declare(strict_types=1);

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;

class SnapTradeService
{
    private Client $httpClient;
    private LoggerInterface $logger;
    private string $baseUrl;
    private string $clientId;
    private string $clientSecret;

    public function __construct(
        Client $httpClient,
        LoggerInterface $logger,
        string $baseUrl,
        string $clientId,
        string $clientSecret
    ) {
        $this->httpClient = $httpClient;
        $this->logger = $logger;
        $this->baseUrl = $baseUrl;
        $this->clientId = $clientId;
        $this->clientSecret = $clientSecret;
    }

    public function createUser(string $userId): array
    {
        try {
            $response = $this->makeRequest('POST', '/snapTrade/registerUser', [
                'userId' => $userId
            ]);

            return [
                'success' => true,
                'data' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade user creation failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getAuthorizationUrl(string $userId, string $brokerageAuthorizationId): string
    {
        try {
            $response = $this->makeRequest('POST', '/snapTrade/login', [
                'userId' => $userId,
                'brokerageAuthorizationId' => $brokerageAuthorizationId
            ]);

            return $response['redirectURI'] ?? '';

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade authorization URL failed: ' . $e->getMessage());
            return '';
        }
    }

    public function getAccounts(string $userId, string $userSecret): array
    {
        try {
            $response = $this->makeRequest('GET', '/accounts', [], [
                'userId' => $userId,
                'userSecret' => $userSecret
            ]);

            return [
                'success' => true,
                'accounts' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade get accounts failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'accounts' => []
            ];
        }
    }

    public function getPositions(string $userId, string $userSecret, ?string $accountId = null): array
    {
        try {
            $endpoint = '/holdings';
            $params = [
                'userId' => $userId,
                'userSecret' => $userSecret
            ];

            if ($accountId) {
                $params['accountId'] = $accountId;
            }

            $response = $this->makeRequest('GET', $endpoint, [], $params);

            return [
                'success' => true,
                'positions' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade get positions failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'positions' => []
            ];
        }
    }

    public function placeTrade(string $userId, array $tradeData): array
    {
        try {
            // Validate required trade data
            $requiredFields = ['accountId', 'symbol', 'action', 'orderType', 'quantity'];
            foreach ($requiredFields as $field) {
                if (!isset($tradeData[$field])) {
                    throw new \InvalidArgumentException("Missing required field: {$field}");
                }
            }

            $orderData = [
                'accountId' => $tradeData['accountId'],
                'action' => strtoupper($tradeData['action']), // BUY or SELL
                'orderType' => strtoupper($tradeData['orderType']), // MARKET, LIMIT, etc.
                'quantity' => (float) $tradeData['quantity'],
                'universalSymbol' => [
                    'symbol' => strtoupper($tradeData['symbol'])
                ],
                'timeInForce' => $tradeData['timeInForce'] ?? 'Day'
            ];

            // Add price for limit orders
            if (isset($tradeData['price'])) {
                $orderData['price'] = (float) $tradeData['price'];
            }

            // Add stop price for stop orders
            if (isset($tradeData['stopPrice'])) {
                $orderData['stop'] = (float) $tradeData['stopPrice'];
            }

            $response = $this->makeRequest('POST', '/trade/place', $orderData, [
                'userId' => $userId,
                'userSecret' => $tradeData['userSecret'] ?? ''
            ]);

            return [
                'success' => true,
                'orderId' => $response['id'] ?? null,
                'status' => $response['status'] ?? 'pending',
                'data' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade place trade failed: ' . $e->getMessage(), [
                'userId' => $userId,
                'tradeData' => $tradeData
            ]);
            
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    public function getOrders(string $userId, string $userSecret, ?string $accountId = null): array
    {
        try {
            $params = [
                'userId' => $userId,
                'userSecret' => $userSecret
            ];

            if ($accountId) {
                $params['accountId'] = $accountId;
            }

            $response = $this->makeRequest('GET', '/activities', [], $params);

            return [
                'success' => true,
                'orders' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade get orders failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'orders' => []
            ];
        }
    }

    public function getBrokerages(): array
    {
        try {
            $response = $this->makeRequest('GET', '/brokerageAuthorizationType');

            return [
                'success' => true,
                'brokerages' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade get brokerages failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'brokerages' => []
            ];
        }
    }

    public function searchSymbols(string $query): array
    {
        try {
            $response = $this->makeRequest('POST', '/symbols', [
                'substring' => $query
            ]);

            return [
                'success' => true,
                'symbols' => $response
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade symbol search failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'symbols' => []
            ];
        }
    }

    private function makeRequest(string $method, string $endpoint, array $body = [], array $queryParams = []): array
    {
        $url = rtrim($this->baseUrl, '/') . '/' . ltrim($endpoint, '/');
        
        $options = [
            'headers' => [
                'Content-Type' => 'application/json',
                'SnapTrade-Client-ID' => $this->clientId,
                'SnapTrade-Version' => '1.0.0'
            ],
            'timeout' => 30
        ];

        // Add query parameters
        if (!empty($queryParams)) {
            $options['query'] = $queryParams;
        }

        // Add body for POST/PUT requests
        if (!empty($body) && in_array(strtoupper($method), ['POST', 'PUT', 'PATCH'])) {
            $options['json'] = $body;
        }

        // Generate signature for authentication
        $timestamp = time();
        $options['headers']['SnapTrade-Timestamp'] = $timestamp;
        $options['headers']['SnapTrade-Signature'] = $this->generateSignature(
            $method,
            $endpoint,
            $queryParams,
            $body,
            $timestamp
        );

        try {
            $response = $this->httpClient->request($method, $url, $options);
            $responseBody = $response->getBody()->getContents();
            
            return json_decode($responseBody, true) ?? [];

        } catch (RequestException $e) {
            $this->logger->error('SnapTrade API request failed', [
                'method' => $method,
                'url' => $url,
                'statusCode' => $e->getCode(),
                'message' => $e->getMessage()
            ]);
            
            throw $e;
        }
    }

    private function generateSignature(string $method, string $path, array $queryParams, array $body, int $timestamp): string
    {
        // SnapTrade signature generation
        $queryString = !empty($queryParams) ? '?' . http_build_query($queryParams) : '';
        $bodyString = !empty($body) ? json_encode($body) : '';
        
        $stringToSign = strtoupper($method) . "\n" .
                       $path . $queryString . "\n" .
                       $bodyString . "\n" .
                       $timestamp;

        return base64_encode(hash_hmac('sha256', $stringToSign, $this->clientSecret, true));
    }

    public function getPortfolioValue(string $userId, string $userSecret): array
    {
        try {
            $accounts = $this->getAccounts($userId, $userSecret);
            
            if (!$accounts['success']) {
                return $accounts;
            }

            $totalValue = 0;
            $accountValues = [];

            foreach ($accounts['accounts'] as $account) {
                $positions = $this->getPositions($userId, $userSecret, $account['id']);
                
                if ($positions['success']) {
                    $accountValue = 0;
                    foreach ($positions['positions'] as $position) {
                        $accountValue += ($position['quantity'] ?? 0) * ($position['price'] ?? 0);
                    }
                    
                    $accountValues[] = [
                        'accountId' => $account['id'],
                        'accountName' => $account['name'] ?? 'Unknown',
                        'value' => $accountValue
                    ];
                    
                    $totalValue += $accountValue;
                }
            }

            return [
                'success' => true,
                'totalValue' => $totalValue,
                'accountValues' => $accountValues
            ];

        } catch (\Exception $e) {
            $this->logger->error('SnapTrade portfolio value calculation failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'totalValue' => 0,
                'accountValues' => []
            ];
        }
    }
}