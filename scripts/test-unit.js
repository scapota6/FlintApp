#!/usr/bin/env node

/**
 * Unit Test Runner for Flint
 * Runs unit tests for both frontend and backend components
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runTests(testType, command, args = []) {
  return new Promise((resolve, reject) => {
    log(`\n━━━ Running ${testType} Tests ━━━`, colors.blue);
    
    const testProcess = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..')
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log(`✓ ${testType} tests passed`, colors.green);
        resolve();
      } else {
        log(`✗ ${testType} tests failed with code ${code}`, colors.red);
        reject(new Error(`${testType} tests failed`));
      }
    });

    testProcess.on('error', (err) => {
      log(`✗ Failed to run ${testType} tests: ${err.message}`, colors.red);
      reject(err);
    });
  });
}

async function main() {
  const startTime = Date.now();
  let hasErrors = false;

  try {
    // Run backend unit tests
    await runTests('Backend', 'tsx', ['--test', 'server/**/*.test.ts']);
    
    // Run frontend unit tests
    await runTests('Frontend', 'vitest', ['run', '--reporter=verbose']);
    
    // Run shared schema validation tests
    await runTests('Schema', 'tsx', ['--test', 'shared/**/*.test.ts']);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n✓ All unit tests passed in ${duration}s`, colors.green);
    process.exit(0);
  } catch (error) {
    hasErrors = true;
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`\n✗ Unit tests failed after ${duration}s`, colors.red);
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  log(`\n✗ Unexpected error: ${error.message}`, colors.red);
  process.exit(1);
});