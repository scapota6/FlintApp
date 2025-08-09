<?php

declare(strict_types=1);

use App\Http\Controllers\{DashboardController, TradingController};
use Slim\App;
use Slim\Routing\RouteCollectorProxy;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

return function (App $app) {
    // Root redirect
    $app->get('/', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode([
            'message' => 'Trading App PHP API',
            'version' => '1.0.0',
            'status' => 'running',
            'timestamp' => date('c')
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });

    // Health check
    $app->get('/health', function (Request $request, Response $response) {
        $response->getBody()->write(json_encode([
            'status' => 'healthy',
            'timestamp' => date('c'),
            'php_version' => PHP_VERSION,
            'memory_usage' => memory_get_usage(true),
            'uptime' => time() - $_SERVER['REQUEST_TIME']
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    });

    // API routes
    $app->group('/api', function (RouteCollectorProxy $group) {
        
        // Dashboard routes
        $group->get('/dashboard', [DashboardController::class, 'getDashboard']);
        $group->get('/dashboard/summary', [DashboardController::class, 'getAccountSummary']);
        $group->get('/dashboard/performance', [DashboardController::class, 'getPortfolioPerformance']);
        
        // Trading routes
        $group->get('/holdings', [TradingController::class, 'getHoldings']);
        $group->get('/positions', [TradingController::class, 'getPositions']);
        $group->get('/trades', [TradingController::class, 'getTrades']);
        $group->post('/trades', [TradingController::class, 'placeTrade']);
        
        // Market data routes
        $group->get('/quotes/{symbol}', [TradingController::class, 'getQuote']);
        $group->get('/search', [TradingController::class, 'searchSymbols']);
        
        // Authentication endpoints
        $group->post('/auth/login', [AuthController::class, 'login']);
        $group->post('/auth/register', [AuthController::class, 'register']);
        $group->post('/auth/refresh', [AuthController::class, 'refresh']);
        $group->post('/auth/demo', [AuthController::class, 'createDemoUser']);
        
        // Protected routes (require authentication)
        $group->group('', function (RouteCollectorProxy $protectedGroup) {
            $protectedGroup->get('/auth/me', [AuthController::class, 'me']);
            $protectedGroup->post('/auth/logout', [AuthController::class, 'logout']);
            
            // Dashboard routes
            $protectedGroup->get('/dashboard', [DashboardController::class, 'getDashboard']);
            $protectedGroup->get('/dashboard/summary', [DashboardController::class, 'getAccountSummary']);
            $protectedGroup->get('/dashboard/performance', [DashboardController::class, 'getPortfolioPerformance']);
            
            // Trading routes
            $protectedGroup->get('/holdings', [TradingController::class, 'getHoldings']);
            $protectedGroup->get('/positions', [TradingController::class, 'getPositions']);
            $protectedGroup->get('/trades', [TradingController::class, 'getTrades']);
            $protectedGroup->post('/trades', [TradingController::class, 'placeTrade']);
            
        })->add(new \App\Http\Middleware\AuthMiddleware($container->get(\App\Services\AuthService::class)));

        // Demo endpoints with sample data
        $group->get('/demo/dashboard', function (Request $request, Response $response) {
            $demoData = [
                'user' => [
                    'id' => 'demo-user-123',
                    'email' => 'demo@tradingapp.com',
                    'name' => 'Demo User'
                ],
                'summary' => [
                    'totalBalance' => 50000.00,
                    'bankBalance' => 15000.00,
                    'investmentValue' => 30000.00,
                    'cryptoValue' => 5000.00,
                    'accountsConnected' => 3
                ],
                'accounts' => [
                    [
                        'id' => 'account-1',
                        'type' => 'bank',
                        'institution' => 'Demo Bank',
                        'balance' => 15000.00,
                        'name' => 'Checking Account'
                    ],
                    [
                        'id' => 'account-2', 
                        'type' => 'investment',
                        'institution' => 'Demo Brokerage',
                        'value' => 30000.00,
                        'name' => 'Investment Account'
                    ],
                    [
                        'id' => 'account-3',
                        'type' => 'crypto',
                        'institution' => 'Demo Exchange',
                        'value' => 5000.00,
                        'name' => 'Crypto Wallet'
                    ]
                ],
                'watchlist' => [
                    ['symbol' => 'AAPL', 'name' => 'Apple Inc.', 'price' => 150.25, 'change' => 2.5, 'changePercent' => 1.69],
                    ['symbol' => 'GOOGL', 'name' => 'Alphabet Inc.', 'price' => 2750.80, 'change' => -15.20, 'changePercent' => -0.55],
                    ['symbol' => 'TSLA', 'name' => 'Tesla Inc.', 'price' => 890.50, 'change' => 45.30, 'changePercent' => 5.36],
                    ['symbol' => 'MSFT', 'name' => 'Microsoft Corp.', 'price' => 310.15, 'change' => 8.75, 'changePercent' => 2.90]
                ],
                'recentTransactions' => [
                    ['date' => '2024-01-15', 'symbol' => 'AAPL', 'action' => 'BUY', 'quantity' => 10, 'price' => 148.50],
                    ['date' => '2024-01-14', 'symbol' => 'GOOGL', 'action' => 'SELL', 'quantity' => 2, 'price' => 2760.00],
                    ['date' => '2024-01-13', 'symbol' => 'TSLA', 'action' => 'BUY', 'quantity' => 5, 'price' => 845.20]
                ],
                'marketSummary' => [
                    ['name' => 'S&P 500', 'value' => '4,750.25', 'change' => 1.2],
                    ['name' => 'NASDAQ', 'value' => '15,200.80', 'change' => -0.8],
                    ['name' => 'DOW', 'value' => '36,850.45', 'change' => 0.5]
                ],
                'timestamp' => date('c')
            ];
            
            $response->getBody()->write(json_encode($demoData));
            return $response->withHeader('Content-Type', 'application/json');
        });

        $group->get('/demo/quotes/{symbol}', function (Request $request, Response $response, array $args) {
            $symbol = strtoupper($args['symbol']);
            
            // Mock quote data
            $quotes = [
                'AAPL' => ['symbol' => 'AAPL', 'price' => 150.25, 'change' => 2.5, 'changePercent' => 1.69, 'volume' => 52000000],
                'GOOGL' => ['symbol' => 'GOOGL', 'price' => 2750.80, 'change' => -15.20, 'changePercent' => -0.55, 'volume' => 1200000],
                'TSLA' => ['symbol' => 'TSLA', 'price' => 890.50, 'change' => 45.30, 'changePercent' => 5.36, 'volume' => 28000000],
                'MSFT' => ['symbol' => 'MSFT', 'price' => 310.15, 'change' => 8.75, 'changePercent' => 2.90, 'volume' => 18000000]
            ];
            
            if (isset($quotes[$symbol])) {
                $response->getBody()->write(json_encode($quotes[$symbol]));
            } else {
                $response->getBody()->write(json_encode(['error' => 'Symbol not found']));
                $response = $response->withStatus(404);
            }
            
            return $response->withHeader('Content-Type', 'application/json');
        });
    });

    // Frontend routes (for serving HTML)
    $app->get('/dashboard', function (Request $request, Response $response) {
        // In a real app, this would render the Twig template with data
        $html = '<!DOCTYPE html>
<html>
<head>
    <title>Trading Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white">
    <div class="container mx-auto p-8">
        <h1 class="text-3xl font-bold mb-6">Trading Dashboard</h1>
        <div class="bg-gray-800 p-6 rounded-lg">
            <h2 class="text-xl mb-4">Welcome to the PHP Trading App!</h2>
            <p class="mb-4">This is a converted version of the Node.js/React trading application.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-gray-700 p-4 rounded">
                    <h3 class="font-semibold mb-2">API Endpoints:</h3>
                    <ul class="text-sm space-y-1">
                        <li><a href="/api/demo/dashboard" class="text-blue-400 hover:underline">/api/demo/dashboard</a></li>
                        <li><a href="/api/demo/quotes/AAPL" class="text-blue-400 hover:underline">/api/demo/quotes/AAPL</a></li>
                        <li><a href="/health" class="text-blue-400 hover:underline">/health</a></li>
                    </ul>
                </div>
                <div class="bg-gray-700 p-4 rounded">
                    <h3 class="font-semibold mb-2">Features Converted:</h3>
                    <ul class="text-sm space-y-1">
                        <li>✅ Dashboard Controller</li>
                        <li>✅ Trading Controller</li>
                        <li>✅ Route Structure</li>
                        <li>✅ Twig Templates</li>
                        <li>⏳ Database Integration</li>
                        <li>⏳ Authentication</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</body>
</html>';
        
        $response->getBody()->write($html);
        return $response->withHeader('Content-Type', 'text/html');
    });
};