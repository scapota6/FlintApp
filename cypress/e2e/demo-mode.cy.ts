/**
 * E2E Test: Demo Mode Functionality
 * Tests the application works correctly in demo mode without real accounts
 */

describe('Demo Mode', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should display demo accounts when demo mode is enabled', () => {
    // Visit dashboard
    cy.visit('/dashboard');
    
    // Check for demo accounts
    cy.contains('Demo Checking Account').should('be.visible');
    cy.contains('Demo Investment Account').should('be.visible');
    cy.contains('Demo Crypto Wallet').should('be.visible');
    
    // Verify demo balances are displayed
    cy.contains('$12,500.50').should('be.visible');
    cy.contains('$45,000.00').should('be.visible');
    cy.contains('$8,500.75').should('be.visible');
  });

  it('should display demo holdings in portfolio', () => {
    cy.visit('/dashboard');
    
    // Check for demo holdings
    cy.contains('AAPL').should('be.visible');
    cy.contains('Apple Inc.').should('be.visible');
    cy.contains('GOOGL').should('be.visible');
    cy.contains('MSFT').should('be.visible');
    cy.contains('TSLA').should('be.visible');
  });

  it('should show demo transactions', () => {
    cy.visit('/activity');
    
    // Check for demo transactions
    cy.contains('Direct Deposit - Salary').should('be.visible');
    cy.contains('$3,500.00').should('be.visible');
    cy.contains('Amazon Purchase').should('be.visible');
    cy.contains('Stock Dividend - AAPL').should('be.visible');
  });

  it('should allow simulated trading in demo mode', () => {
    cy.visit('/trading');
    
    // Enter stock symbol
    cy.get('input[placeholder*="symbol"]').type('AAPL');
    
    // Select buy action
    cy.contains('Buy').click();
    
    // Enter quantity
    cy.get('input[type="number"]').type('10');
    
    // Verify preview shows demo data
    cy.contains('Preview Order').click();
    cy.contains('10 shares').should('be.visible');
    cy.contains('AAPL').should('be.visible');
  });
});

describe('Feature Flags', () => {
  it('should fetch feature flags from API', () => {
    cy.request('/api/feature-flags').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body).to.have.property('FF_DEMO_MODE');
      expect(response.body).to.have.property('FF_TRADING');
      expect(response.body).to.have.property('FF_ALERTS');
    });
  });

  it('should hide trading features when FF_TRADING is disabled', () => {
    // Mock feature flags with trading disabled
    cy.intercept('GET', '/api/feature-flags', {
      body: {
        FF_TRADING: false,
        FF_ALERTS: false,
        FF_DEMO_MODE: true,
      },
    });

    cy.visit('/dashboard');
    
    // Trading button should not be visible
    cy.get('[data-testid="trading-button"]').should('not.exist');
  });
});