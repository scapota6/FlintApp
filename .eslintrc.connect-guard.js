/**
 * ESLint Configuration for Connect Flow Protection
 * 
 * This configuration can be used in CI/CD to enforce connect flow protection.
 * Usage: eslint --config .eslintrc.connect-guard.js client/src/components/dashboard/
 */

module.exports = {
  extends: ['.eslintrc.js'],
  plugins: ['connect-flow-guard'],
  rules: {
    'connect-flow-guard/require-protection-banner': 'error'
  },
  settings: {
    'connect-flow-guard': {
      protectedFiles: [
        '**/simple-connect-buttons.tsx',
        '**/connections.tsx', 
        '**/teller.ts',
        '**/connections.snaptrade.ts',
        '**/snaptrade-clean.ts',
        '**/snaptradeProvision.ts',
        '**/AccountDetailsModal.tsx'
      ]
    }
  }
};