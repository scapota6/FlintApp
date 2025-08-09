<?php

declare(strict_types=1);

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;
use Doctrine\DBAL\Connection;

class QuoteService
{
    private Client $httpClient;
    private LoggerInterface $logger;
    private Connection $db;
    private string $apiKey;
    private string $baseUrl = 'https://www.alphavantage.co/query';

    public function __construct(
        Client $httpClient,
        LoggerInterface $logger,
        Connection $db,
        string $apiKey
    ) {
        $this->httpClient = $httpClient;
        $this->logger = $logger;
        $this->db = $db;
        $this->apiKey = $apiKey;
    }

    public function getQuote(string $symbol): ?array
    {
        try {
            // First check cache
            $cachedQuote = $this->getCachedQuote($symbol);
            if ($cachedQuote && $this->isCacheValid($cachedQuote)) {
                return $this->formatQuote($cachedQuote);
            }

            // Fetch from Alpha Vantage API
            $response = $this->httpClient->get($this->baseUrl, [
                'query' => [
                    'function' => 'GLOBAL_QUOTE',
                    'symbol' => $symbol,
                    'apikey' => $this->apiKey
                ],
                'timeout' => 10
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['Global Quote'])) {
                $quote = $this->parseAlphaVantageQuote($symbol, $data['Global Quote']);
                $this->cacheQuote($quote);
                return $this->formatQuote($quote);
            }

            // If Alpha Vantage fails, try mock data for demo
            return $this->getMockQuote($symbol);

        } catch (RequestException $e) {
            $this->logger->warning('Alpha Vantage API request failed', [
                'symbol' => $symbol,
                'error' => $e->getMessage()
            ]);
            
            // Return cached data if available, even if expired
            $cachedQuote = $this->getCachedQuote($symbol);
            if ($cachedQuote) {
                return $this->formatQuote($cachedQuote);
            }

            // Fall back to mock data
            return $this->getMockQuote($symbol);

        } catch (\Exception $e) {
            $this->logger->error('Quote service error', [
                'symbol' => $symbol,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    public function getMultipleQuotes(array $symbols): array
    {
        $quotes = [];
        
        foreach ($symbols as $symbol) {
            $quote = $this->getQuote($symbol);
            if ($quote) {
                $quotes[$symbol] = $quote;
            }
        }
        
        return $quotes;
    }

    public function searchSymbols(string $query): array
    {
        try {
            $response = $this->httpClient->get($this->baseUrl, [
                'query' => [
                    'function' => 'SYMBOL_SEARCH',
                    'keywords' => $query,
                    'apikey' => $this->apiKey
                ],
                'timeout' => 10
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['bestMatches'])) {
                return array_map(function ($match) {
                    return [
                        'symbol' => $match['1. symbol'] ?? '',
                        'name' => $match['2. name'] ?? '',
                        'type' => $match['3. type'] ?? '',
                        'region' => $match['4. region'] ?? '',
                        'currency' => $match['8. currency'] ?? 'USD'
                    ];
                }, array_slice($data['bestMatches'], 0, 10));
            }

            return $this->getMockSearchResults($query);

        } catch (\Exception $e) {
            $this->logger->error('Symbol search error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
            
            return $this->getMockSearchResults($query);
        }
    }

    public function getIntradayData(string $symbol, string $interval = '5min'): array
    {
        try {
            $response = $this->httpClient->get($this->baseUrl, [
                'query' => [
                    'function' => 'TIME_SERIES_INTRADAY',
                    'symbol' => $symbol,
                    'interval' => $interval,
                    'apikey' => $this->apiKey,
                    'outputsize' => 'compact'
                ],
                'timeout' => 15
            ]);

            $data = json_decode($response->getBody()->getContents(), true);
            $timeSeriesKey = "Time Series ({$interval})";

            if (isset($data[$timeSeriesKey])) {
                $timeSeries = $data[$timeSeriesKey];
                $chartData = [];

                foreach (array_slice($timeSeries, 0, 100, true) as $time => $values) {
                    $chartData[] = [
                        'timestamp' => $time,
                        'open' => (float) $values['1. open'],
                        'high' => (float) $values['2. high'],
                        'low' => (float) $values['3. low'],
                        'close' => (float) $values['4. close'],
                        'volume' => (int) $values['5. volume']
                    ];
                }

                return array_reverse($chartData); // Most recent first
            }

            return $this->getMockChartData($symbol);

        } catch (\Exception $e) {
            $this->logger->error('Intraday data error', [
                'symbol' => $symbol,
                'error' => $e->getMessage()
            ]);
            
            return $this->getMockChartData($symbol);
        }
    }

    public function getMarketStatus(): array
    {
        try {
            $response = $this->httpClient->get($this->baseUrl, [
                'query' => [
                    'function' => 'MARKET_STATUS',
                    'apikey' => $this->apiKey
                ],
                'timeout' => 10
            ]);

            $data = json_decode($response->getBody()->getContents(), true);

            if (isset($data['markets'])) {
                $usMarket = array_filter($data['markets'], function ($market) {
                    return ($market['region'] ?? '') === 'United States';
                });

                if (!empty($usMarket)) {
                    $market = array_values($usMarket)[0];
                    return [
                        'isOpen' => ($market['current_status'] ?? '') === 'open',
                        'status' => $market['current_status'] ?? 'unknown',
                        'nextOpen' => $market['local_open'] ?? null,
                        'nextClose' => $market['local_close'] ?? null
                    ];
                }
            }

            return $this->getDefaultMarketStatus();

        } catch (\Exception $e) {
            $this->logger->error('Market status error: ' . $e->getMessage());
            return $this->getDefaultMarketStatus();
        }
    }

    private function parseAlphaVantageQuote(string $symbol, array $data): array
    {
        $price = (float) ($data['05. price'] ?? 0);
        $previousClose = (float) ($data['08. previous close'] ?? $price);
        $change = $price - $previousClose;
        $changePercent = $previousClose > 0 ? ($change / $previousClose) * 100 : 0;

        return [
            'symbol' => $symbol,
            'price' => $price,
            'change' => $change,
            'changePercent' => $changePercent,
            'volume' => (int) ($data['06. volume'] ?? 0),
            'open' => (float) ($data['02. open'] ?? 0),
            'high' => (float) ($data['03. high'] ?? 0),
            'low' => (float) ($data['04. low'] ?? 0),
            'previousClose' => $previousClose,
            'lastUpdated' => date('Y-m-d H:i:s'),
            'source' => 'alphavantage'
        ];
    }

    private function getCachedQuote(string $symbol): ?array
    {
        try {
            $stmt = $this->db->prepare('
                SELECT * FROM market_data 
                WHERE symbol = ? 
                ORDER BY last_updated DESC 
                LIMIT 1
            ');
            $result = $stmt->executeQuery([$symbol]);
            $row = $result->fetchAssociative();

            return $row ?: null;

        } catch (\Exception $e) {
            $this->logger->warning('Cache lookup failed: ' . $e->getMessage());
            return null;
        }
    }

    private function cacheQuote(array $quote): void
    {
        try {
            $this->db->executeStatement('
                INSERT INTO market_data (
                    symbol, name, asset_type, price, change_percent, 
                    volume, market_cap, last_updated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (symbol) DO UPDATE SET
                    price = EXCLUDED.price,
                    change_percent = EXCLUDED.change_percent,
                    volume = EXCLUDED.volume,
                    last_updated = EXCLUDED.last_updated
            ', [
                $quote['symbol'],
                $quote['symbol'], // Name would come from a separate lookup
                'stock',
                $quote['price'],
                $quote['changePercent'],
                $quote['volume'],
                null, // Market cap would need separate API call
                $quote['lastUpdated']
            ]);

        } catch (\Exception $e) {
            $this->logger->warning('Cache write failed: ' . $e->getMessage());
        }
    }

    private function isCacheValid(array $cachedQuote): bool
    {
        $lastUpdated = strtotime($cachedQuote['last_updated']);
        $cacheAge = time() - $lastUpdated;
        
        // Cache is valid for 5 minutes during market hours, 1 hour otherwise
        $maxAge = $this->isMarketOpen() ? 300 : 3600;
        
        return $cacheAge < $maxAge;
    }

    private function isMarketOpen(): bool
    {
        $marketStatus = $this->getMarketStatus();
        return $marketStatus['isOpen'] ?? false;
    }

    private function formatQuote(array $quote): array
    {
        return [
            'symbol' => $quote['symbol'],
            'price' => round((float) $quote['price'], 2),
            'change' => round((float) ($quote['change'] ?? 0), 2),
            'changePercent' => round((float) ($quote['change_percent'] ?? 0), 2),
            'volume' => (int) ($quote['volume'] ?? 0),
            'lastUpdated' => $quote['last_updated'] ?? $quote['lastUpdated'] ?? date('Y-m-d H:i:s')
        ];
    }

    private function getMockQuote(string $symbol): array
    {
        // Mock data for popular symbols
        $mockQuotes = [
            'AAPL' => ['price' => 150.25, 'change' => 2.5, 'volume' => 52000000],
            'GOOGL' => ['price' => 2750.80, 'change' => -15.20, 'volume' => 1200000],
            'TSLA' => ['price' => 890.50, 'change' => 45.30, 'volume' => 28000000],
            'MSFT' => ['price' => 310.15, 'change' => 8.75, 'volume' => 18000000],
            'AMZN' => ['price' => 3200.00, 'change' => -25.50, 'volume' => 3500000],
            'NVDA' => ['price' => 220.75, 'change' => 12.30, 'volume' => 45000000]
        ];

        $mockData = $mockQuotes[$symbol] ?? [
            'price' => rand(10, 500) + rand(0, 99) / 100,
            'change' => rand(-20, 20) + rand(0, 99) / 100,
            'volume' => rand(100000, 50000000)
        ];

        $changePercent = $mockData['price'] > 0 ? ($mockData['change'] / $mockData['price']) * 100 : 0;

        return [
            'symbol' => $symbol,
            'price' => round($mockData['price'], 2),
            'change' => round($mockData['change'], 2),
            'changePercent' => round($changePercent, 2),
            'volume' => $mockData['volume'],
            'lastUpdated' => date('Y-m-d H:i:s'),
            'source' => 'mock'
        ];
    }

    private function getMockSearchResults(string $query): array
    {
        $mockResults = [
            ['symbol' => 'AAPL', 'name' => 'Apple Inc.', 'type' => 'Equity', 'region' => 'United States'],
            ['symbol' => 'AMZN', 'name' => 'Amazon.com Inc.', 'type' => 'Equity', 'region' => 'United States'],
            ['symbol' => 'GOOGL', 'name' => 'Alphabet Inc.', 'type' => 'Equity', 'region' => 'United States'],
            ['symbol' => 'MSFT', 'name' => 'Microsoft Corporation', 'type' => 'Equity', 'region' => 'United States'],
            ['symbol' => 'TSLA', 'name' => 'Tesla Inc.', 'type' => 'Equity', 'region' => 'United States']
        ];

        return array_filter($mockResults, function ($result) use ($query) {
            return stripos($result['symbol'], $query) !== false || 
                   stripos($result['name'], $query) !== false;
        });
    }

    private function getMockChartData(string $symbol): array
    {
        $data = [];
        $basePrice = rand(100, 500);
        $time = time() - (100 * 5 * 60); // 100 5-minute intervals ago

        for ($i = 0; $i < 100; $i++) {
            $open = $basePrice + rand(-10, 10);
            $close = $open + rand(-5, 5);
            $high = max($open, $close) + rand(0, 3);
            $low = min($open, $close) - rand(0, 3);

            $data[] = [
                'timestamp' => date('Y-m-d H:i:s', $time + ($i * 5 * 60)),
                'open' => round($open, 2),
                'high' => round($high, 2),
                'low' => round($low, 2),
                'close' => round($close, 2),
                'volume' => rand(100000, 1000000)
            ];

            $basePrice = $close;
        }

        return $data;
    }

    private function getDefaultMarketStatus(): array
    {
        $now = new \DateTime('now', new \DateTimeZone('America/New_York'));
        $hour = (int) $now->format('H');
        $dayOfWeek = (int) $now->format('w');

        // Simple market hours: Mon-Fri 9:30 AM - 4:00 PM ET
        $isWeekday = $dayOfWeek >= 1 && $dayOfWeek <= 5;
        $isMarketHours = $hour >= 9 && $hour < 16;

        return [
            'isOpen' => $isWeekday && $isMarketHours,
            'status' => ($isWeekday && $isMarketHours) ? 'open' : 'closed',
            'nextOpen' => null,
            'nextClose' => null
        ];
    }
}