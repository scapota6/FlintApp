import { Router } from 'express';
import { isAuthenticated } from '../replitAuth';
import { rateLimits } from '../middleware/rateLimiter';
import { connectionDiagnostics } from '../services/ConnectionDiagnostics';

const router = Router();

/**
 * GET /api/diagnostics/health
 * Run comprehensive connection diagnostics for the current user
 */
router.get('/health', rateLimits.auth, isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    console.log(`[Diagnostics API] Running health check for user: ${userId}`);
    
    const report = await connectionDiagnostics.runDiagnostics(userId);
    
    res.json({
      success: true,
      report
    });
    
  } catch (error: any) {
    console.error('[Diagnostics API] Health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run diagnostics',
      error: error.message
    });
  }
});

/**
 * POST /api/diagnostics/repair
 * Execute an automated repair action
 */
router.post('/repair', rateLimits.auth, isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    const { issueId, actionId } = req.body;
    
    if (!issueId || !actionId) {
      return res.status(400).json({
        success: false,
        message: 'Issue ID and action ID are required'
      });
    }
    
    console.log(`[Diagnostics API] Executing repair for user: ${userId}, issue: ${issueId}, action: ${actionId}`);
    
    const result = await connectionDiagnostics.executeRepair(userId, issueId, actionId);
    
    res.json({
      success: result.success,
      message: result.message
    });
    
  } catch (error: any) {
    console.error('[Diagnostics API] Repair execution failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute repair',
      error: error.message
    });
  }
});

/**
 * GET /api/diagnostics/quick-check
 * Lightweight health check for dashboard status indicators
 */
router.get('/quick-check', rateLimits.auth, isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user.claims.sub;
    
    // Run a simplified check for dashboard use
    const report = await connectionDiagnostics.runDiagnostics(userId);
    
    // Return simplified status
    const quickStatus = {
      overallHealth: report.overallHealth,
      criticalIssues: report.issues.filter((i: any) => i.type === 'critical').length,
      warningIssues: report.issues.filter((i: any) => i.type === 'warning').length,
      hasAutoRepairs: report.issues.some((i: any) => i.autoRepairAvailable),
      accountStatus: report.accountStatus,
      lastChecked: report.lastChecked
    };
    
    res.json({
      success: true,
      status: quickStatus
    });
    
  } catch (error: any) {
    console.error('[Diagnostics API] Quick check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run quick check',
      error: error.message
    });
  }
});

export default router;