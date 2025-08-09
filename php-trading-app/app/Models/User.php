<?php

declare(strict_types=1);

namespace App\Models;

use Doctrine\DBAL\Connection;

class User
{
    private Connection $db;

    public function __construct(Connection $db)
    {
        $this->db = $db;
    }

    public function create(array $data): string
    {
        $id = $this->generateUserId();
        
        $this->db->insert('users', array_merge($data, [
            'id' => $id,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]));

        return $id;
    }

    public function findById(string $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE id = ?');
        $result = $stmt->executeQuery([$id]);
        $user = $result->fetchAssociative();
        
        return $user ?: null;
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM users WHERE email = ?');
        $result = $stmt->executeQuery([$email]);
        $user = $result->fetchAssociative();
        
        return $user ?: null;
    }

    public function update(string $id, array $data): bool
    {
        $data['updated_at'] = date('Y-m-d H:i:s');
        
        $affectedRows = $this->db->update('users', $data, ['id' => $id]);
        
        return $affectedRows > 0;
    }

    public function delete(string $id): bool
    {
        $affectedRows = $this->db->delete('users', ['id' => $id]);
        
        return $affectedRows > 0;
    }

    public function getConnectedAccounts(string $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM connected_accounts 
            WHERE user_id = ? AND is_active = true 
            ORDER BY created_at DESC
        ');
        $result = $stmt->executeQuery([$userId]);
        
        return $result->fetchAllAssociative();
    }

    public function getHoldings(string $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT h.*, ca.institution_name, ca.account_name 
            FROM holdings h
            LEFT JOIN connected_accounts ca ON h.account_id = ca.id
            WHERE h.user_id = ?
            ORDER BY h.market_value DESC
        ');
        $result = $stmt->executeQuery([$userId]);
        
        return $result->fetchAllAssociative();
    }

    public function getWatchlist(string $userId): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM watchlist 
            WHERE user_id = ? 
            ORDER BY created_at DESC
        ');
        $result = $stmt->executeQuery([$userId]);
        
        return $result->fetchAllAssociative();
    }

    public function getTrades(string $userId, int $limit = 50, int $offset = 0): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM trades 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        ');
        $result = $stmt->executeQuery([$userId, $limit, $offset]);
        
        return $result->fetchAllAssociative();
    }

    public function getActivityLog(string $userId, int $limit = 100): array
    {
        $stmt = $this->db->prepare('
            SELECT * FROM activity_log 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        ');
        $result = $stmt->executeQuery([$userId, $limit]);
        
        return $result->fetchAllAssociative();
    }

    private function generateUserId(): string
    {
        return 'user_' . bin2hex(random_bytes(16));
    }
}