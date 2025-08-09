<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\{TradingService, QuoteService, SnapTradeService};
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class TradingController
{
    private TradingService $tradingService;
    private QuoteService $quoteService;
    private SnapTradeService $snapTradeService;
    private LoggerInterface $logger;

    public function __construct(
        TradingService $tradingService,
        QuoteService $quoteService,
        SnapTradeService $snapTradeService,
        LoggerInterface $logger
    ) {
        $this->tradingService = $tradingService;
        $this->quoteService = $quoteService;
        $this->snapTradeService = $snapTradeService;
        $this->logger = $logger;
    }

    public function getHoldings(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $holdings = $this->tradingService->getUserHoldings($userId);
            
            // Enrich holdings with current market data
            $enrichedHoldings = [];
            foreach ($holdings as $holding) {
                $quote = $this->quoteService->getQuote($holding['symbol']);
                
                $enrichedHolding = $holding;
                $enrichedHolding['currentPrice'] = $quote['price'] ?? $holding['averagePrice'];
                $enrichedHolding['marketValue'] = $enrichedHolding['currentPrice'] * $holding['quantity'];
                $enrichedHolding['unrealizedPnL'] = $enrichedHolding['marketValue'] - ($holding['averagePrice'] * $holding['quantity']);
                $enrichedHolding['percentChange'] = $quote['percentChange'] ?? 0;
                
                $enrichedHoldings[] = $enrichedHolding;
            }

            return $this->jsonResponse($response, [
                'holdings' => $enrichedHoldings,
                'totalValue' => array_sum(array_column($enrichedHoldings, 'marketValue')),
                'totalPnL' => array_sum(array_column($enrichedHoldings, 'unrealizedPnL'))
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Holdings error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to load holdings'], 500);
        }
    }

    public function getPositions(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $positions = $this->snapTradeService->getPositions($userId);
            
            return $this->jsonResponse($response, ['positions' => $positions]);

        } catch (\Exception $e) {
            $this->logger->error('Positions error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to load positions'], 500);
        }
    }

    public function placeTrade(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $body = json_decode((string) $request->getBody(), true);
            
            // Validate required fields
            $requiredFields = ['symbol', 'quantity', 'action', 'orderType'];
            foreach ($requiredFields as $field) {
                if (!isset($body[$field])) {
                    return $this->jsonResponse($response, [
                        'error' => "Missing required field: {$field}"
                    ], 400);
                }
            }

            // Validate trade parameters
            $validationResult = $this->validateTradeRequest($body);
            if ($validationResult !== true) {
                return $this->jsonResponse($response, ['error' => $validationResult], 400);
            }

            // Get current quote for the symbol
            $quote = $this->quoteService->getQuote($body['symbol']);
            if (!$quote) {
                return $this->jsonResponse($response, ['error' => 'Invalid symbol or quote unavailable'], 400);
            }

            // Calculate estimated cost
            $estimatedPrice = $body['orderType'] === 'MARKET' ? $quote['price'] : ($body['limitPrice'] ?? $quote['price']);
            $estimatedCost = $estimatedPrice * $body['quantity'];

            // Check buying power (for buy orders)
            if ($body['action'] === 'BUY') {
                $buyingPower = $this->tradingService->getBuyingPower($userId);
                if ($estimatedCost > $buyingPower) {
                    return $this->jsonResponse($response, [
                        'error' => 'Insufficient buying power',
                        'required' => $estimatedCost,
                        'available' => $buyingPower
                    ], 400);
                }
            }

            // Place the trade through SnapTrade
            $tradeResult = $this->snapTradeService->placeTrade($userId, [
                'account_id' => $body['accountId'],
                'symbol' => $body['symbol'],
                'action' => $body['action'], // BUY or SELL
                'order_type' => $body['orderType'], // MARKET, LIMIT, STOP, STOP_LIMIT
                'quantity' => $body['quantity'],
                'price' => $body['limitPrice'] ?? null,
                'stop_price' => $body['stopPrice'] ?? null,
                'time_in_force' => $body['timeInForce'] ?? 'DAY'
            ]);

            if ($tradeResult['success']) {
                // Log the trade
                $this->tradingService->logTrade($userId, [
                    'orderId' => $tradeResult['orderId'],
                    'symbol' => $body['symbol'],
                    'action' => $body['action'],
                    'quantity' => $body['quantity'],
                    'orderType' => $body['orderType'],
                    'estimatedPrice' => $estimatedPrice,
                    'status' => 'PENDING'
                ]);

                return $this->jsonResponse($response, [
                    'success' => true,
                    'orderId' => $tradeResult['orderId'],
                    'message' => 'Trade placed successfully',
                    'estimatedCost' => $estimatedCost
                ]);
            } else {
                return $this->jsonResponse($response, [
                    'error' => 'Trade failed',
                    'message' => $tradeResult['message'] ?? 'Unknown error'
                ], 400);
            }

        } catch (\Exception $e) {
            $this->logger->error('Trade placement error: ' . $e->getMessage(), [
                'userId' => $userId ?? null,
                'body' => $body ?? null
            ]);
            
            return $this->jsonResponse($response, [
                'error' => 'Trade execution failed',
                'message' => 'Unable to place trade'
            ], 500);
        }
    }

    public function getTrades(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $params = $request->getQueryParams();
            $limit = min((int)($params['limit'] ?? 50), 100);
            $offset = (int)($params['offset'] ?? 0);

            $trades = $this->tradingService->getUserTrades($userId, $limit, $offset);
            
            return $this->jsonResponse($response, [
                'trades' => $trades,
                'pagination' => [
                    'limit' => $limit,
                    'offset' => $offset,
                    'hasMore' => count($trades) === $limit
                ]
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Trades history error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to load trades'], 500);
        }
    }

    public function getQuote(Request $request, Response $response, array $args): Response
    {
        try {
            $symbol = strtoupper($args['symbol']);
            
            $quote = $this->quoteService->getQuote($symbol);
            
            if (!$quote) {
                return $this->jsonResponse($response, ['error' => 'Quote not found'], 404);
            }

            return $this->jsonResponse($response, $quote);

        } catch (\Exception $e) {
            $this->logger->error('Quote error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to get quote'], 500);
        }
    }

    public function searchSymbols(Request $request, Response $response): Response
    {
        try {
            $params = $request->getQueryParams();
            $query = $params['q'] ?? '';
            
            if (strlen($query) < 1) {
                return $this->jsonResponse($response, ['error' => 'Query too short'], 400);
            }

            $results = $this->quoteService->searchSymbols($query);
            
            return $this->jsonResponse($response, ['results' => $results]);

        } catch (\Exception $e) {
            $this->logger->error('Symbol search error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Search failed'], 500);
        }
    }

    private function validateTradeRequest(array $data): string|true
    {
        // Validate action
        if (!in_array($data['action'], ['BUY', 'SELL'])) {
            return 'Invalid action. Must be BUY or SELL';
        }

        // Validate order type
        if (!in_array($data['orderType'], ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'])) {
            return 'Invalid order type';
        }

        // Validate quantity
        if (!is_numeric($data['quantity']) || $data['quantity'] <= 0) {
            return 'Invalid quantity';
        }

        // Validate limit price for limit orders
        if (in_array($data['orderType'], ['LIMIT', 'STOP_LIMIT'])) {
            if (!isset($data['limitPrice']) || !is_numeric($data['limitPrice']) || $data['limitPrice'] <= 0) {
                return 'Limit price required for limit orders';
            }
        }

        // Validate stop price for stop orders
        if (in_array($data['orderType'], ['STOP', 'STOP_LIMIT'])) {
            if (!isset($data['stopPrice']) || !is_numeric($data['stopPrice']) || $data['stopPrice'] <= 0) {
                return 'Stop price required for stop orders';
            }
        }

        return true;
    }

    private function jsonResponse(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_THROW_ON_ERROR));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}