<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\{UserService, AccountService, TradingService};
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class DashboardController
{
    private UserService $userService;
    private AccountService $accountService;
    private TradingService $tradingService;
    private LoggerInterface $logger;

    public function __construct(
        UserService $userService,
        AccountService $accountService,
        TradingService $tradingService,
        LoggerInterface $logger
    ) {
        $this->userService = $userService;
        $this->accountService = $accountService;
        $this->tradingService = $tradingService;
        $this->logger = $logger;
    }

    public function getDashboard(Request $request, Response $response): Response
    {
        try {
            // Get authenticated user ID from JWT or session
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            // Get user data
            $user = $this->userService->getUser($userId);
            if (!$user) {
                return $this->jsonResponse($response, ['error' => 'User not found'], 404);
            }

            // Get connected accounts
            $connectedAccounts = $this->accountService->getConnectedAccounts($userId);
            
            // Initialize balances
            $totalBalance = 0;
            $bankBalance = 0;
            $investmentValue = 0;
            $cryptoValue = 0;
            $enrichedAccounts = [];

            // Process each connected account
            foreach ($connectedAccounts as $account) {
                $enrichedAccount = $account;
                
                switch ($account['type']) {
                    case 'bank':
                        $bankData = $this->accountService->getBankAccountData($account['account_id']);
                        if ($bankData) {
                            $enrichedAccount['balance'] = $bankData['balance'];
                            $enrichedAccount['institution'] = $bankData['institution'];
                            $bankBalance += $bankData['balance'];
                        }
                        break;
                        
                    case 'investment':
                        $investmentData = $this->tradingService->getInvestmentAccountData($account['account_id']);
                        if ($investmentData) {
                            $enrichedAccount['value'] = $investmentData['total_value'];
                            $enrichedAccount['positions'] = $investmentData['positions'];
                            $investmentValue += $investmentData['total_value'];
                        }
                        break;
                        
                    case 'crypto':
                        $cryptoData = $this->tradingService->getCryptoAccountData($account['account_id']);
                        if ($cryptoData) {
                            $enrichedAccount['value'] = $cryptoData['total_value'];
                            $enrichedAccount['holdings'] = $cryptoData['holdings'];
                            $cryptoValue += $cryptoData['total_value'];
                        }
                        break;
                }
                
                $enrichedAccounts[] = $enrichedAccount;
            }

            $totalBalance = $bankBalance + $investmentValue + $cryptoValue;

            // Get recent transactions
            $recentTransactions = $this->tradingService->getRecentTransactions($userId, 10);
            
            // Get watchlist
            $watchlist = $this->tradingService->getWatchlist($userId);
            
            // Get market summary
            $marketSummary = $this->tradingService->getMarketSummary();

            // Build dashboard response
            $dashboardData = [
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'name' => $user['name'] ?? $user['email']
                ],
                'summary' => [
                    'totalBalance' => round($totalBalance, 2),
                    'bankBalance' => round($bankBalance, 2),
                    'investmentValue' => round($investmentValue, 2),
                    'cryptoValue' => round($cryptoValue, 2),
                    'accountsConnected' => count($connectedAccounts)
                ],
                'accounts' => $enrichedAccounts,
                'recentTransactions' => $recentTransactions,
                'watchlist' => $watchlist,
                'marketSummary' => $marketSummary,
                'timestamp' => date('c')
            ];

            return $this->jsonResponse($response, $dashboardData);

        } catch (\Exception $e) {
            $this->logger->error('Dashboard error: ' . $e->getMessage(), [
                'userId' => $userId ?? null,
                'trace' => $e->getTraceAsString()
            ]);
            
            return $this->jsonResponse($response, [
                'error' => 'Internal server error',
                'message' => 'Unable to load dashboard data'
            ], 500);
        }
    }

    public function getAccountSummary(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $summary = $this->accountService->getAccountSummary($userId);
            
            return $this->jsonResponse($response, $summary);

        } catch (\Exception $e) {
            $this->logger->error('Account summary error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to load account summary'], 500);
        }
    }

    public function getPortfolioPerformance(Request $request, Response $response): Response
    {
        try {
            $userId = $request->getAttribute('userId');
            
            if (!$userId) {
                return $this->jsonResponse($response, ['error' => 'Unauthorized'], 401);
            }

            $params = $request->getQueryParams();
            $timeframe = $params['timeframe'] ?? '1M'; // 1D, 1W, 1M, 3M, 1Y
            
            $performance = $this->tradingService->getPortfolioPerformance($userId, $timeframe);
            
            return $this->jsonResponse($response, $performance);

        } catch (\Exception $e) {
            $this->logger->error('Portfolio performance error: ' . $e->getMessage());
            return $this->jsonResponse($response, ['error' => 'Unable to load portfolio performance'], 500);
        }
    }

    private function jsonResponse(Response $response, array $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_THROW_ON_ERROR));
        return $response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($status);
    }
}