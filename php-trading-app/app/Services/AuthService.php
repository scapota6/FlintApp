<?php

declare(strict_types=1);

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Doctrine\DBAL\Connection;
use Psr\Log\LoggerInterface;

class AuthService
{
    private Connection $db;
    private LoggerInterface $logger;
    private string $jwtSecret;
    private string $jwtAlgorithm;
    private int $jwtExpiration;

    public function __construct(
        Connection $db,
        LoggerInterface $logger,
        string $jwtSecret,
        string $jwtAlgorithm = 'HS256',
        int $jwtExpiration = 3600
    ) {
        $this->db = $db;
        $this->logger = $logger;
        $this->jwtSecret = $jwtSecret;
        $this->jwtAlgorithm = $jwtAlgorithm;
        $this->jwtExpiration = $jwtExpiration;
    }

    public function authenticate(string $email, string $password): ?array
    {
        try {
            // Find user by email
            $user = $this->getUserByEmail($email);
            
            if (!$user) {
                $this->logger->info('Authentication failed: User not found', ['email' => $email]);
                return null;
            }

            // In a real app, you would verify the password hash
            // For demo purposes, we'll create a simple check
            if (!$this->verifyPassword($password, $user['password_hash'] ?? '')) {
                $this->logger->info('Authentication failed: Invalid password', ['email' => $email]);
                return null;
            }

            // Generate JWT token
            $token = $this->generateJwtToken($user);
            
            // Update last login
            $this->updateLastLogin($user['id']);
            
            // Log successful authentication
            $this->logActivity($user['id'], 'login', 'User authenticated successfully');

            return [
                'user' => $this->sanitizeUser($user),
                'token' => $token,
                'expires_in' => $this->jwtExpiration
            ];

        } catch (\Exception $e) {
            $this->logger->error('Authentication error: ' . $e->getMessage(), [
                'email' => $email,
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }

    public function register(array $userData): ?array
    {
        try {
            // Check if user already exists
            if ($this->getUserByEmail($userData['email'])) {
                $this->logger->info('Registration failed: Email already exists', ['email' => $userData['email']]);
                return null;
            }

            // Generate user ID
            $userId = $this->generateUserId();
            
            // Hash password
            $passwordHash = $this->hashPassword($userData['password']);

            // Insert user
            $this->db->insert('users', [
                'id' => $userId,
                'email' => $userData['email'],
                'first_name' => $userData['first_name'] ?? null,
                'last_name' => $userData['last_name'] ?? null,
                'password_hash' => $passwordHash,
                'subscription_tier' => 'free',
                'subscription_status' => 'active',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s')
            ]);

            // Get the created user
            $user = $this->getUserById($userId);
            
            // Generate JWT token
            $token = $this->generateJwtToken($user);
            
            // Log registration
            $this->logActivity($userId, 'register', 'User registered successfully');

            return [
                'user' => $this->sanitizeUser($user),
                'token' => $token,
                'expires_in' => $this->jwtExpiration
            ];

        } catch (\Exception $e) {
            $this->logger->error('Registration error: ' . $e->getMessage(), [
                'email' => $userData['email'] ?? 'unknown',
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }

    public function validateToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, $this->jwtAlgorithm));
            $payload = (array) $decoded;

            // Check if token is expired
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                return null;
            }

            // Get fresh user data
            $user = $this->getUserById($payload['sub']);
            
            if (!$user) {
                return null;
            }

            return $this->sanitizeUser($user);

        } catch (\Exception $e) {
            $this->logger->warning('Token validation failed: ' . $e->getMessage());
            return null;
        }
    }

    public function refreshToken(string $token): ?string
    {
        $user = $this->validateToken($token);
        
        if (!$user) {
            return null;
        }

        return $this->generateJwtToken($user);
    }

    private function generateJwtToken(array $user): string
    {
        $payload = [
            'iss' => $_ENV['APP_URL'] ?? 'trading-app',
            'sub' => $user['id'],
            'email' => $user['email'],
            'name' => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')),
            'subscription_tier' => $user['subscription_tier'],
            'iat' => time(),
            'exp' => time() + $this->jwtExpiration
        ];

        return JWT::encode($payload, $this->jwtSecret, $this->jwtAlgorithm);
    }

    private function getUserByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $result = $stmt->executeQuery([$email]);
        $user = $result->fetchAssociative();
        
        return $user ?: null;
    }

    private function getUserById(string $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $result = $stmt->executeQuery([$id]);
        $user = $result->fetchAssociative();
        
        return $user ?: null;
    }

    private function verifyPassword(string $password, string $hash): bool
    {
        // In a real app, use password_verify()
        // For demo, we'll use a simple comparison
        return password_verify($password, $hash);
    }

    private function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }

    private function generateUserId(): string
    {
        return 'user_' . bin2hex(random_bytes(16));
    }

    private function updateLastLogin(string $userId): void
    {
        $this->db->update('users', [
            'updated_at' => date('Y-m-d H:i:s')
        ], ['id' => $userId]);
    }

    private function logActivity(string $userId, string $action, string $description): void
    {
        try {
            $this->db->insert('activity_log', [
                'user_id' => $userId,
                'action' => $action,
                'description' => $description,
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            $this->logger->warning('Failed to log activity: ' . $e->getMessage());
        }
    }

    private function sanitizeUser(array $user): array
    {
        // Remove sensitive data
        unset($user['password_hash']);
        unset($user['snaptrade_user_secret']);
        unset($user['stripe_customer_id']);
        
        return $user;
    }

    public function createDemoUser(): array
    {
        $demoUser = [
            'email' => 'demo@tradingapp.com',
            'password' => 'demo123',
            'first_name' => 'Demo',
            'last_name' => 'User'
        ];

        // Check if demo user exists
        $existingUser = $this->getUserByEmail($demoUser['email']);
        if ($existingUser) {
            // Generate token for existing demo user
            $token = $this->generateJwtToken($existingUser);
            return [
                'user' => $this->sanitizeUser($existingUser),
                'token' => $token,
                'expires_in' => $this->jwtExpiration
            ];
        }

        // Create demo user
        return $this->register($demoUser);
    }
}