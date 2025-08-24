/**
 * ESLint Custom Rule: Connect Flow Protection
 * 
 * This rule enforces that connect flow files include the protection banner
 * and fails if VITE_ALLOW_CONNECT_EDITS is not set when modifying protected files.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce connect flow protection banner and environment checks',
      category: 'Security',
      recommended: true
    },
    fixable: null,
    schema: []
  },

  create(context) {
    const protectedFiles = [
      'simple-connect-buttons.tsx',
      'connections.tsx', 
      'teller.ts',
      'connections.snaptrade.ts',
      'snaptrade-clean.ts',
      'snaptradeProvision.ts',
      'AccountDetailsModal.tsx'
    ];

    const filename = context.getFilename();
    const isProtectedFile = protectedFiles.some(file => filename.includes(file));

    if (!isProtectedFile) {
      return {};
    }

    let hasProtectionBanner = false;
    let hasRuntimeGuard = false;

    return {
      Program(node) {
        const sourceCode = context.getSourceCode();
        const comments = sourceCode.getAllComments();

        // Check for protection banner
        for (const comment of comments) {
          if (comment.value.includes('DO NOT CHANGE THIS CONNECT FLOW') && 
              comment.value.includes('bubble gum')) {
            hasProtectionBanner = true;
            break;
          }
        }

        // Check for runtime guard
        const code = sourceCode.getText();
        if (code.includes('VITE_ALLOW_CONNECT_EDITS') || 
            code.includes('ALLOW_CONNECT_EDITS')) {
          hasRuntimeGuard = true;
        }

        // Report violations
        if (!hasProtectionBanner) {
          context.report({
            node,
            message: 'Connect flow file missing protection banner. Add: "⚠️ DO NOT CHANGE THIS CONNECT FLOW unless the product owner says \\"bubble gum\\"."'
          });
        }

        if (!hasRuntimeGuard) {
          context.report({
            node,
            message: 'Connect flow file missing runtime guard. Add environment check for VITE_ALLOW_CONNECT_EDITS or ALLOW_CONNECT_EDITS.'
          });
        }

        // In development, check if modifications are authorized
        if (process.env.NODE_ENV === 'development' && 
            !process.env.VITE_ALLOW_CONNECT_EDITS && 
            !process.env.ALLOW_CONNECT_EDITS) {
          context.report({
            node,
            message: 'Unauthorized modification of connect flow detected. Set VITE_ALLOW_CONNECT_EDITS=true to authorize changes.'
          });
        }
      }
    };
  }
};