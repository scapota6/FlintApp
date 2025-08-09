<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\AuthService;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Result;
use Doctrine\DBAL\Statement;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\LoggerInterface;

class AuthServiceTest extends TestCase
{
    private AuthService $authService;
    private MockObject $mockDb;
    private MockObject $mockLogger;
    private MockObject $mockStatement;
    private MockObject $mockResult;

    protected function setUp(): void
    {
        $this->mockDb = $this->createMock(Connection::class);
        $this->mockLogger = $this->createMock(LoggerInterface::class);
        $this->mockStatement = $this->createMock(Statement::class);
        $this->mockResult = $this->createMock(Result::class);

        $this->authService = new AuthService(
            $this->mockDb,
            $this->mockLogger,
            'test-secret-key',
            'HS256',
            3600
        );
    }

    public function testAuthenticateWithValidCredentials(): void
    {
        $email = 'test@example.com';
        $password = 'password123';
        $hashedPassword = password_hash($password, PASSWORD_ARGON2ID);

        $userData = [
            'id' => 'user_123',
            'email' => $email,
            'password_hash' => $hashedPassword,
            'first_name' => 'Test',
            'last_name' => 'User',
            'subscription_tier' => 'free'
        ];

        // Mock the database query for user lookup
        $this->mockDb->expects($this->exactly(2))
            ->method('prepare')
            ->withConsecutive(
                ['SELECT * FROM users WHERE email = ? LIMIT 1'],
                ['SELECT * FROM users WHERE id = ? LIMIT 1']
            )
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->exactly(2))
            ->method('executeQuery')
            ->withConsecutive([$email], [$userData['id']])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->exactly(2))
            ->method('fetchAssociative')
            ->willReturn($userData);

        // Mock the update query
        $this->mockDb->expects($this->once())
            ->method('update')
            ->with('users', $this->anything(), ['id' => $userData['id']]);

        // Mock activity log insertion
        $this->mockDb->expects($this->once())
            ->method('insert')
            ->with('activity_log', $this->anything());

        $result = $this->authService->authenticate($email, $password);

        $this->assertNotNull($result);
        $this->assertArrayHasKey('user', $result);
        $this->assertArrayHasKey('token', $result);
        $this->assertArrayHasKey('expires_in', $result);
        $this->assertEquals($userData['id'], $result['user']['id']);
        $this->assertEquals($userData['email'], $result['user']['email']);
        $this->assertArrayNotHasKey('password_hash', $result['user']);
    }

    public function testAuthenticateWithInvalidEmail(): void
    {
        $email = 'nonexistent@example.com';
        $password = 'password123';

        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->with('SELECT * FROM users WHERE email = ? LIMIT 1')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->with([$email])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn(false); // No user found

        $this->mockLogger->expects($this->once())
            ->method('info')
            ->with('Authentication failed: User not found', ['email' => $email]);

        $result = $this->authService->authenticate($email, $password);

        $this->assertNull($result);
    }

    public function testAuthenticateWithInvalidPassword(): void
    {
        $email = 'test@example.com';
        $password = 'wrongpassword';
        $hashedPassword = password_hash('correctpassword', PASSWORD_ARGON2ID);

        $userData = [
            'id' => 'user_123',
            'email' => $email,
            'password_hash' => $hashedPassword,
            'first_name' => 'Test',
            'last_name' => 'User'
        ];

        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->with('SELECT * FROM users WHERE email = ? LIMIT 1')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->with([$email])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn($userData);

        $this->mockLogger->expects($this->once())
            ->method('info')
            ->with('Authentication failed: Invalid password', ['email' => $email]);

        $result = $this->authService->authenticate($email, $password);

        $this->assertNull($result);
    }

    public function testRegisterNewUser(): void
    {
        $userData = [
            'email' => 'new@example.com',
            'password' => 'password123',
            'first_name' => 'New',
            'last_name' => 'User'
        ];

        // Mock checking if user exists (should return null)
        $this->mockDb->expects($this->exactly(2))
            ->method('prepare')
            ->withConsecutive(
                ['SELECT * FROM users WHERE email = ? LIMIT 1'],
                ['SELECT * FROM users WHERE id = ? LIMIT 1']
            )
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->exactly(2))
            ->method('executeQuery')
            ->willReturnOnConsecutiveCalls(
                $this->mockResult, // For checking if user exists
                $this->mockResult  // For getting created user
            );

        $this->mockResult->expects($this->exactly(2))
            ->method('fetchAssociative')
            ->willReturnOnConsecutiveCalls(
                false, // User doesn't exist
                array_merge($userData, ['id' => 'user_456']) // Created user
            );

        // Mock user insertion
        $this->mockDb->expects($this->once())
            ->method('insert')
            ->with('users', $this->callback(function ($data) use ($userData) {
                return $data['email'] === $userData['email'] &&
                       isset($data['password_hash']) &&
                       $data['first_name'] === $userData['first_name'];
            }));

        // Mock activity log insertion
        $this->mockDb->expects($this->once())
            ->method('insert')
            ->with('activity_log', $this->anything());

        $result = $this->authService->register($userData);

        $this->assertNotNull($result);
        $this->assertArrayHasKey('user', $result);
        $this->assertArrayHasKey('token', $result);
        $this->assertEquals($userData['email'], $result['user']['email']);
    }

    public function testRegisterExistingUser(): void
    {
        $userData = [
            'email' => 'existing@example.com',
            'password' => 'password123'
        ];

        $existingUser = [
            'id' => 'user_123',
            'email' => $userData['email']
        ];

        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->with('SELECT * FROM users WHERE email = ? LIMIT 1')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->with([$userData['email']])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn($existingUser); // User already exists

        $this->mockLogger->expects($this->once())
            ->method('info')
            ->with('Registration failed: Email already exists', ['email' => $userData['email']]);

        $result = $this->authService->register($userData);

        $this->assertNull($result);
    }

    public function testValidateValidToken(): void
    {
        $userData = [
            'id' => 'user_123',
            'email' => 'test@example.com',
            'first_name' => 'Test',
            'subscription_tier' => 'free'
        ];

        // Create a valid token
        $payload = [
            'sub' => $userData['id'],
            'email' => $userData['email'],
            'iat' => time(),
            'exp' => time() + 3600
        ];
        $token = \Firebase\JWT\JWT::encode($payload, 'test-secret-key', 'HS256');

        // Mock database query for user
        $this->mockDb->expects($this->once())
            ->method('prepare')
            ->with('SELECT * FROM users WHERE id = ? LIMIT 1')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->once())
            ->method('executeQuery')
            ->with([$userData['id']])
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->once())
            ->method('fetchAssociative')
            ->willReturn($userData);

        $result = $this->authService->validateToken($token);

        $this->assertNotNull($result);
        $this->assertEquals($userData['id'], $result['id']);
        $this->assertEquals($userData['email'], $result['email']);
    }

    public function testValidateExpiredToken(): void
    {
        // Create an expired token
        $payload = [
            'sub' => 'user_123',
            'email' => 'test@example.com',
            'iat' => time() - 7200, // 2 hours ago
            'exp' => time() - 3600  // 1 hour ago (expired)
        ];
        $token = \Firebase\JWT\JWT::encode($payload, 'test-secret-key', 'HS256');

        $result = $this->authService->validateToken($token);

        $this->assertNull($result);
    }

    public function testValidateInvalidToken(): void
    {
        $invalidToken = 'invalid.token.here';

        $this->mockLogger->expects($this->once())
            ->method('warning')
            ->with($this->stringContains('Token validation failed'));

        $result = $this->authService->validateToken($invalidToken);

        $this->assertNull($result);
    }

    public function testCreateDemoUser(): void
    {
        // Mock that demo user doesn't exist
        $this->mockDb->expects($this->exactly(2))
            ->method('prepare')
            ->willReturn($this->mockStatement);

        $this->mockStatement->expects($this->exactly(2))
            ->method('executeQuery')
            ->willReturn($this->mockResult);

        $this->mockResult->expects($this->exactly(2))
            ->method('fetchAssociative')
            ->willReturnOnConsecutiveCalls(
                false, // Demo user doesn't exist
                [      // Created demo user
                    'id' => 'user_demo',
                    'email' => 'demo@tradingapp.com',
                    'first_name' => 'Demo',
                    'last_name' => 'User',
                    'subscription_tier' => 'free'
                ]
            );

        // Mock user creation
        $this->mockDb->expects($this->once())
            ->method('insert')
            ->with('users', $this->anything());

        // Mock activity log
        $this->mockDb->expects($this->once())
            ->method('insert')
            ->with('activity_log', $this->anything());

        $result = $this->authService->createDemoUser();

        $this->assertNotNull($result);
        $this->assertArrayHasKey('user', $result);
        $this->assertArrayHasKey('token', $result);
        $this->assertEquals('demo@tradingapp.com', $result['user']['email']);
    }
}