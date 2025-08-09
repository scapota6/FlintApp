<?php

declare(strict_types=1);

namespace App\Database;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\DBAL\Types\Types;

abstract class Migration
{
    protected Connection $connection;
    protected Schema $schema;

    public function __construct(Connection $connection)
    {
        $this->connection = $connection;
        $this->schema = $connection->createSchemaManager()->introspectSchema();
    }

    abstract public function up(): void;
    abstract public function down(): void;

    protected function createTable(string $name, callable $definition): void
    {
        $table = $this->schema->createTable($name);
        $definition($table);
        
        $queries = $this->schema->toSql($this->connection->getDatabasePlatform());
        foreach ($queries as $query) {
            $this->connection->executeStatement($query);
        }
    }

    protected function addTimestamps($table): void
    {
        $table->addColumn('created_at', Types::DATETIME_MUTABLE)
              ->setDefault('CURRENT_TIMESTAMP');
        $table->addColumn('updated_at', Types::DATETIME_MUTABLE)
              ->setDefault('CURRENT_TIMESTAMP');
    }

    protected function addSerialPrimaryKey($table, string $name = 'id'): void
    {
        $table->addColumn($name, Types::INTEGER)
              ->setAutoincrement(true);
        $table->setPrimaryKey([$name]);
    }

    protected function addStringPrimaryKey($table, string $name = 'id'): void
    {
        $table->addColumn($name, Types::STRING)
              ->setLength(255)
              ->setNotnull(true);
        $table->setPrimaryKey([$name]);
    }

    protected function addForeignKey($table, string $column, string $referencedTable, string $referencedColumn = 'id'): void
    {
        $table->addColumn($column, Types::STRING)
              ->setLength(255)
              ->setNotnull(true);
        $table->addForeignKeyConstraint(
            $referencedTable,
            [$column],
            [$referencedColumn],
            ['onDelete' => 'CASCADE']
        );
    }

    protected function execute(string $sql): void
    {
        $this->connection->executeStatement($sql);
    }
}