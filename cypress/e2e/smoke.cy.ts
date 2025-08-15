/**
 * E2E Smoke Tests for Flint
 * Critical path testing for production deployment verification
 */

describe('Flint Smoke Tests', () => {
  const baseUrl = Cypress.env('BASE_URL') || 'http://localhost:5000';

  beforeEach(() => {
    cy.visit(baseUrl);
  });

  describe('Core Application', () => {
    it('should load the landing page', () => {
      cy.visit('/');
      cy.contains('Flint', { timeout: 10000 }).should('be.visible');
      cy.get('button').contains(/log in|sign in/i).should('be.visible');
    });

    it('should have working navigation', () => {
      cy.visit('/');
      // Check for main navigation elements
      cy.get('nav').should('be.visible');
    });

    it('should handle 404 pages gracefully', () => {
      cy.visit('/non-existent-page', { failOnStatusCode: false });
      cy.contains(/not found|404/i).should('be.visible');
    });
  });

  describe('API Health', () => {
    it('should have a healthy API endpoint', () => {
      cy.request(`${baseUrl}/api/health`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('status', 'healthy');
        expect(response.body).to.have.property('database');
        expect(response.body).to.have.property('services');
      });
    });

    it('should check SnapTrade connectivity', () => {
      cy.request(`${baseUrl}/api/snaptrade/status`).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('online');
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should redirect unauthenticated users from protected routes', () => {
      cy.visit('/dashboard', { failOnStatusCode: false });
      cy.url().should('include', '/');
      cy.contains(/log in|sign in/i).should('be.visible');
    });

    it('should handle authentication endpoints', () => {
      cy.request({
        url: `${baseUrl}/api/auth/user`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([200, 401]);
      });
    });
  });

  describe('Market Data', () => {
    it('should fetch market quotes', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/api/quotes/AAPL`,
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 200) {
          expect(response.body).to.have.property('symbol');
          expect(response.body).to.have.property('price');
        }
      });
    });
  });

  describe('Performance', () => {
    it('should load the homepage within acceptable time', () => {
      cy.visit('/', {
        onBeforeLoad: (win) => {
          win.performance.mark('start');
        },
        onLoad: (win) => {
          win.performance.mark('end');
          win.performance.measure('pageLoad', 'start', 'end');
          const measure = win.performance.getEntriesByName('pageLoad')[0];
          expect(measure.duration).to.be.lessThan(5000); // 5 seconds max
        }
      });
    });
  });

  describe('Security Headers', () => {
    it('should have security headers set', () => {
      cy.request('/').then((response) => {
        const headers = response.headers;
        
        // Check for essential security headers
        expect(headers).to.have.property('x-content-type-options');
        expect(headers).to.have.property('x-frame-options');
        
        // HTTPS only headers (production)
        if (baseUrl.includes('https')) {
          expect(headers).to.have.property('strict-transport-security');
        }
      });
    });
  });

  describe('Database Connectivity', () => {
    it('should verify database connection through health endpoint', () => {
      cy.request(`${baseUrl}/api/health`).then((response) => {
        expect(response.body.database).to.have.property('connected', true);
        expect(response.body.database).to.have.property('latency');
        expect(response.body.database.latency).to.be.lessThan(1000); // Under 1 second
      });
    });
  });

  describe('Critical User Paths', () => {
    it('should display watchlist page elements', () => {
      cy.visit('/');
      
      // Look for watchlist-related elements on landing page
      if (Cypress.$('[data-testid="watchlist"]').length > 0) {
        cy.get('[data-testid="watchlist"]').should('be.visible');
      }
    });

    it('should have functional search if available', () => {
      cy.visit('/');
      
      // Check if search exists
      if (Cypress.$('input[type="search"], input[placeholder*="search" i]').length > 0) {
        cy.get('input[type="search"], input[placeholder*="search" i]')
          .first()
          .type('AAPL')
          .should('have.value', 'AAPL');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      cy.request({
        url: `${baseUrl}/api/invalid-endpoint`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([404, 405]);
      });
    });

    it('should handle malformed requests', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/api/trades`,
        body: { invalid: 'data' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 401, 422]);
      });
    });
  });
});