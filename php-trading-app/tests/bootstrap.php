<?php

declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

// Load environment variables for testing
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad(); // Use safeLoad to avoid errors if .env doesn't exist

// Set up test database if needed
if (!defined('TESTING')) {
    define('TESTING', true);
}