<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\QuoteService;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use Doctrine\DBAL\Statement;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Http\Message\StreamInterface;
use Psr\Log\LoggerInterface;

class QuoteServiceTest extends TestCase
{
    private QuoteService $quoteService;
    private MockObject $mockHttpClient;
    private MockObject $mockLogger;
    private MockObject $mockDb;
    private MockObject $mockStatement;
    private MockObject $mockResult;

    protected function setUp(): void
    {
        $this->mockHttpClient = $this->createMock(Client::class);
        $this->mockLogger = $this->createMock(LoggerInterface::class);
        $this->mockDb = $this->createMock(Connection::class);
        $this->mockStatement = $this->createMock(Statement::class);
        $this->mockResult = $this->createMock(Result::class);

        $this->quoteService = new QuoteService(
            $this->mockHttpClient,
            $this->mockLogger,
            $this->mockDb,
            'test-api-key'
        );
    }

    public function testGetQuoteFromCache(): void
    {
        $symbol = 'AAPL';
        $cachedQuote = [
            'symbol' => $symbol,
            'price' => 150.25,
            'change_percent' => 1.5,
            'volume' => 1000000,
            'last_updated' => date('Y-m-d H:i:s', time() - 60) // 1 minute ago
        ];

        // Mock cache lookup
        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->with($this->stringContains('SELECT * FROM market_data'))
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->with([$symbol])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn($cachedQuote);

        // Should not make HTTP request since cache is valid
        $this->mockHttpClient->expects($this->never())
            ->method('get');

        $result = $this->quoteService->getQuote($symbol);

        $this->assertNotNull($result);
        $this->assertEquals($symbol, $result['symbol']);
        $this->assertEquals(150.25, $result['price']);
        $this->assertEquals(1.5, $result['changePercent']);
    }

    public function testGetQuoteFromApiWhenCacheExpired(): void
    {
        $symbol = 'GOOGL';
        $expiredCache = [
            'symbol' => $symbol,
            'price' => 2500.00,
            'last_updated' => date('Y-m-d H:i:s', time() - 7200) // 2 hours ago
        ];

        $apiResponse = [
            'Global Quote' => [
                '01. symbol' => $symbol,
                '05. price' => '2750.80',
                '02. open' => '2740.00',
                '03. high' => '2760.00',
                '04. low' => '2735.00',
                '06. volume' => '1200000',
                '08. previous close' => '2740.00'
            ]
        ];

        // Mock cache lookup (expired data)
        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn($expiredCache);

        // Mock API response
        $mockResponse = $this->createMock(Response::class);
        $mockStream = $this->createMock(StreamInterface::class);
        
        $mockStream->expects($this->once())
            ->method('getContents')
            ->willReturn(json_encode($apiResponse));

        $mockResponse->expects($this->once())
            ->method('getBody')
            ->willReturn($mockStream);

        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://www.alphavantage.co/query',
                $this->callback(function ($options) use ($symbol) {
                    return isset($options['query']) &&
                           $options['query']['function'] === 'GLOBAL_QUOTE' &&
                           $options['query']['symbol'] === $symbol &&
                           $options['query']['apikey'] === 'test-api-key';
                })
            )
            ->willReturn($mockResponse);

        // Mock cache write
        $this->mockDb->expects($this->once())
            ->method('executeStatement')
            ->with($this->stringContains('INSERT INTO market_data'));

        $result = $this->quoteService->getQuote($symbol);

        $this->assertNotNull($result);
        $this->assertEquals($symbol, $result['symbol']);
        $this->assertEquals(2750.80, $result['price']);
    }

    public function testGetQuoteFallsBackToMockOnApiFailure(): void
    {
        $symbol = 'TSLA';

        // Mock cache lookup (no data)
        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn(false); // No cached data

        // Mock API failure
        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->willThrowException(new RequestException('API Error', $this->createMock(\Psr\Http\Message\RequestInterface::class)));

        // Should log the warning
        $this->mockLogger->expects($this->once())
            ->method('warning')
            ->with('Alpha Vantage API request failed', $this->anything());

        $result = $this->quoteService->getQuote($symbol);

        // Should return mock data
        $this->assertNotNull($result);
        $this->assertEquals($symbol, $result['symbol']);
        $this->assertArrayHasKey('price', $result);
        $this->assertArrayHasKey('change', $result);
        $this->assertEquals('mock', $result['source']);
    }

    public function testSearchSymbols(): void
    {
        $query = 'APPL';
        $apiResponse = [
            'bestMatches' => [
                [
                    '1. symbol' => 'AAPL',
                    '2. name' => 'Apple Inc.',
                    '3. type' => 'Equity',
                    '4. region' => 'United States',
                    '8. currency' => 'USD'
                ],
                [
                    '1. symbol' => 'APLE',
                    '2. name' => 'Apple Hospitality REIT Inc.',
                    '3. type' => 'Equity',
                    '4. region' => 'United States',
                    '8. currency' => 'USD'
                ]
            ]
        ];

        $mockResponse = $this->createMock(Response::class);
        $mockStream = $this->createMock(StreamInterface::class);
        
        $mockStream->expects($this->once())
            ->method('getContents')
            ->willReturn(json_encode($apiResponse));

        $mockResponse->expects($this->once())
            ->method('getBody')
            ->willReturn($mockStream);

        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://www.alphavantage.co/query',
                $this->callback(function ($options) use ($query) {
                    return isset($options['query']) &&
                           $options['query']['function'] === 'SYMBOL_SEARCH' &&
                           $options['query']['keywords'] === $query;
                })
            )
            ->willReturn($mockResponse);

        $result = $this->quoteService->searchSymbols($query);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertEquals('AAPL', $result[0]['symbol']);
        $this->assertEquals('Apple Inc.', $result[0]['name']);
        $this->assertEquals('APLE', $result[1]['symbol']);
    }

    public function testSearchSymbolsFallsBackToMockOnFailure(): void
    {
        $query = 'AAPL';

        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->willThrowException(new \Exception('API Error'));

        $this->mockLogger->expects($this->once())
            ->method('error')
            ->with('Symbol search error', $this->anything());

        $result = $this->quoteService->searchSymbols($query);

        $this->assertIsArray($result);
        $this->assertNotEmpty($result);
        // Should return mock data that matches the query
        $foundMatch = false;
        foreach ($result as $item) {
            if (stripos($item['symbol'], $query) !== false || stripos($item['name'], $query) !== false) {
                $foundMatch = true;
                break;
            }
        }
        $this->assertTrue($foundMatch);
    }

    public function testGetMultipleQuotes(): void
    {
        $symbols = ['AAPL', 'GOOGL'];
        
        // Mock cache lookups returning no data
        $this->mockDb->expects($this->exactly(2))
            ->method('prepare')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->exactly(2))
            ->method('executeQuery')
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->exactly(2))
            ->method('fetchAssociative')
            ->willReturn(false);

        // Mock API failures to trigger mock data
        $this->mockHttpClient->expects($this->exactly(2))
            ->method('get')
            ->willThrowException(new RequestException('API Error', $this->createMock(\Psr\Http\Message\RequestInterface::class)));

        $this->mockLogger->expects($this->exactly(2))
            ->method('warning');

        $result = $this->quoteService->getMultipleQuotes($symbols);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        $this->assertArrayHasKey('AAPL', $result);
        $this->assertArrayHasKey('GOOGL', $result);
    }

    public function testGetIntradayData(): void
    {
        $symbol = 'MSFT';
        $interval = '5min';
        $apiResponse = [
            'Time Series (5min)' => [
                '2024-01-15 16:00:00' => [
                    '1. open' => '310.00',
                    '2. high' => '312.00',
                    '3. low' => '309.50',
                    '4. close' => '311.50',
                    '5. volume' => '150000'
                ],
                '2024-01-15 15:55:00' => [
                    '1. open' => '309.00',
                    '2. high' => '310.50',
                    '3. low' => '308.75',
                    '4. close' => '310.00',
                    '5. volume' => '120000'
                ]
            ]
        ];

        $mockResponse = $this->createMock(Response::class);
        $mockStream = $this->createMock(StreamInterface::class);
        
        $mockStream->expects($this->once())
            ->method('getContents')
            ->willReturn(json_encode($apiResponse));

        $mockResponse->expects($this->once())
            ->method('getBody')
            ->willReturn($mockStream);

        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://www.alphavantage.co/query',
                $this->callback(function ($options) use ($symbol, $interval) {
                    return isset($options['query']) &&
                           $options['query']['function'] === 'TIME_SERIES_INTRADAY' &&
                           $options['query']['symbol'] === $symbol &&
                           $options['query']['interval'] === $interval;
                })
            )
            ->willReturn($mockResponse);

        $result = $this->quoteService->getIntradayData($symbol, $interval);

        $this->assertIsArray($result);
        $this->assertCount(2, $result);
        
        // Check that data is in correct order (most recent first)
        $this->assertEquals('2024-01-15 15:55:00', $result[0]['timestamp']);
        $this->assertEquals(309.00, $result[0]['open']);
        $this->assertEquals('2024-01-15 16:00:00', $result[1]['timestamp']);
        $this->assertEquals(310.00, $result[1]['open']);
    }

    public function testGetMarketStatus(): void
    {
        $apiResponse = [
            'markets' => [
                [
                    'region' => 'United States',
                    'primary_exchanges' => 'NASDAQ,NYSE',
                    'local_open' => '09:30',
                    'local_close' => '16:00',
                    'current_status' => 'open',
                    'notes' => ''
                ]
            ]
        ];

        $mockResponse = $this->createMock(Response::class);
        $mockStream = $this->createMock(StreamInterface::class);
        
        $mockStream->expects($this->once())
            ->method('getContents')
            ->willReturn(json_encode($apiResponse));

        $mockResponse->expects($this->once())
            ->method('getBody')
            ->willReturn($mockStream);

        $this->mockHttpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://www.alphavantage.co/query',
                $this->callback(function ($options) {
                    return isset($options['query']) &&
                           $options['query']['function'] === 'MARKET_STATUS';
                })
            )
            ->willReturn($mockResponse);

        $result = $this->quoteService->getMarketStatus();

        $this->assertIsArray($result);
        $this->assertTrue($result['isOpen']);
        $this->assertEquals('open', $result['status']);
    }
}