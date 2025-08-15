/**
 * Playwright E2E Test: Demo Mode and Feature Flags
 * Tests application functionality in demo mode
 */

import { test, expect } from '@playwright/test';

test.describe('Demo Mode', () => {
  test('should display demo accounts in dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for demo accounts
    await expect(page.locator('text=Demo Checking Account')).toBeVisible();
    await expect(page.locator('text=Demo Investment Account')).toBeVisible();
    await expect(page.locator('text=Demo Crypto Wallet')).toBeVisible();
    
    // Verify demo balances
    await expect(page.locator('text=$12,500.50')).toBeVisible();
    await expect(page.locator('text=$45,000.00')).toBeVisible();
    await expect(page.locator('text=$8,500.75')).toBeVisible();
  });

  test('should display demo portfolio holdings', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check for demo holdings
    await expect(page.locator('text=AAPL')).toBeVisible();
    await expect(page.locator('text=Apple Inc.')).toBeVisible();
    await expect(page.locator('text=GOOGL')).toBeVisible();
    await expect(page.locator('text=MSFT')).toBeVisible();
    await expect(page.locator('text=TSLA')).toBeVisible();
  });

  test('should show demo transactions in activity page', async ({ page }) => {
    await page.goto('/activity');
    
    // Check for demo transactions
    await expect(page.locator('text=Direct Deposit - Salary')).toBeVisible();
    await expect(page.locator('text=$3,500.00')).toBeVisible();
    await expect(page.locator('text=Amazon Purchase')).toBeVisible();
    await expect(page.locator('text=Stock Dividend - AAPL')).toBeVisible();
  });

  test('should allow simulated trading in demo mode', async ({ page }) => {
    await page.goto('/trading');
    
    // Enter stock symbol
    await page.fill('input[placeholder*="symbol"]', 'AAPL');
    
    // Select buy action
    await page.click('text=Buy');
    
    // Enter quantity
    await page.fill('input[type="number"]', '10');
    
    // Click preview order
    await page.click('text=Preview Order');
    
    // Verify preview shows correct data
    await expect(page.locator('text=10 shares')).toBeVisible();
    await expect(page.locator('text=AAPL')).toBeVisible();
  });
});

test.describe('Feature Flags API', () => {
  test('should return feature flags from API', async ({ request }) => {
    const response = await request.get('/api/feature-flags');
    
    expect(response.ok()).toBeTruthy();
    
    const flags = await response.json();
    expect(flags).toHaveProperty('FF_DEMO_MODE');
    expect(flags).toHaveProperty('FF_TRADING');
    expect(flags).toHaveProperty('FF_ALERTS');
  });

  test('should respect feature flags in UI', async ({ page }) => {
    // Override feature flags response
    await page.route('/api/feature-flags', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          FF_TRADING: false,
          FF_ALERTS: false,
          FF_DEMO_MODE: true,
        }),
      });
    });

    await page.goto('/dashboard');
    
    // Trading features should be hidden when flag is disabled
    await expect(page.locator('[data-testid="trading-button"]')).not.toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/dashboard', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      });
    });

    await page.goto('/dashboard');
    
    // Should show error message
    await expect(page.locator('text=Error loading dashboard')).toBeVisible({ timeout: 10000 });
  });

  test('should display error boundary on component crash', async ({ page }) => {
    // Navigate to a page that triggers an error
    await page.goto('/test-error');
    
    // Should show error boundary
    await expect(page.locator('text=Something went wrong')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Reload Page')).toBeVisible();
  });
});