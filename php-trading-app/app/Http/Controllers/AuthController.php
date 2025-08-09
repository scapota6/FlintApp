<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\AuthService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class AuthController
{
    private AuthService $authService;
    private LoggerInterface $logger;

    public function __construct(AuthService $authService, LoggerInterface $logger)
    {
        $this->authService = $authService;
        $this->logger = $logger;
    }

    public function login(Request $request, Response $response): Response
    {
        try {
            $body = json_decode((string) $request->getBody(), true);
            
            if (!isset($body['email']) || !isset($body['password'])) {
                return $this->jsonResponse($response, [
                    'error' => 'Email and password are required'
                ], 400);
            }

            $result = $this->authService->authenticate($body['email'], $body['password']);
            
            if (!$result) {
                return $this->jsonResponse($response, [
                    'error' => 'Invalid credentials'
                ], 401);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Authentication successful',
                'data' => $result
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Login error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Authentication failed'
            ], 500);
        }
    }

    public function register(Request $request, Response $response): Response
    {
        try {
            $body = json_decode((string) $request->getBody(), true);
            
            // Validate required fields
            $requiredFields = ['email', 'password'];
            foreach ($requiredFields as $field) {
                if (!isset($body[$field]) || empty($body[$field])) {
                    return $this->jsonResponse($response, [
                        'error' => "Field '{$field}' is required"
                    ], 400);
                }
            }

            // Validate email format
            if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
                return $this->jsonResponse($response, [
                    'error' => 'Invalid email format'
                ], 400);
            }

            // Validate password strength
            if (strlen($body['password']) < 6) {
                return $this->jsonResponse($response, [
                    'error' => 'Password must be at least 6 characters long'
                ], 400);
            }

            $result = $this->authService->register($body);
            
            if (!$result) {
                return $this->jsonResponse($response, [
                    'error' => 'Registration failed. Email may already be in use.'
                ], 409);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Registration successful',
                'data' => $result
            ], 201);

        } catch (\Exception $e) {
            $this->logger->error('Registration error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Registration failed'
            ], 500);
        }
    }

    public function refresh(Request $request, Response $response): Response
    {
        try {
            $authHeader = $request->getHeaderLine('Authorization');
            
            if (!$authHeader || !preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                return $this->jsonResponse($response, [
                    'error' => 'Invalid authorization header'
                ], 400);
            }

            $token = $matches[1];
            $newToken = $this->authService->refreshToken($token);
            
            if (!$newToken) {
                return $this->jsonResponse($response, [
                    'error' => 'Token refresh failed'
                ], 401);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Token refreshed successfully',
                'data' => [
                    'token' => $newToken,
                    'expires_in' => 3600
                ]
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Token refresh error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Token refresh failed'
            ], 500);
        }
    }

    public function me(Request $request, Response $response): Response
    {
        try {
            $user = $request->getAttribute('user');
            
            if (!$user) {
                return $this->jsonResponse($response, [
                    'error' => 'User not found'
                ], 404);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'data' => [
                    'user' => $user
                ]
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Get user error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Failed to get user data'
            ], 500);
        }
    }

    public function logout(Request $request, Response $response): Response
    {
        try {
            // In a stateless JWT system, logout is typically handled client-side
            // by removing the token. However, we can log the logout event.
            
            $user = $request->getAttribute('user');
            if ($user) {
                $this->logger->info('User logged out', ['user_id' => $user['id']]);
            }

            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Logged out successfully'
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Logout error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Logout failed'
            ], 500);
        }
    }

    public function createDemoUser(Request $request, Response $response): Response
    {
        try {
            $result = $this->authService->createDemoUser();
            
            return $this->jsonResponse($response, [
                'success' => true,
                'message' => 'Demo user created/accessed successfully',
                'data' => $result
            ]);

        } catch (\Exception $e) {
            $this->logger->error('Demo user creation error: ' . $e->getMessage());
            return $this->jsonResponse($response, [
                'error' => 'Failed to create demo user'
            ], 500);
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