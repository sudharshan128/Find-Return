import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import trustScoreController from '../services/trustScoreController';

const router = express.Router();

/**
 * Trust Score Routes
 * All routes require authentication
 */

// ============================================
// User Routes (Authenticated users)
// ============================================

/**
 * @route   GET /api/trust-score/me
 * @desc    Get current user's trust score
 * @access  Private
 */
router.get('/me', requireAuth, trustScoreController.getMyTrustScore);

/**
 * @route   GET /api/trust-score/me/logs
 * @desc    Get current user's trust score history
 * @access  Private
 * @query   limit - Number of logs to return (default: 50)
 */
router.get('/me/logs', requireAuth, trustScoreController.getMyTrustLogs);

/**
 * @route   GET /api/trust-score/me/summary
 * @desc    Get current user's trust score summary with statistics
 * @access  Private
 */
router.get('/me/summary', requireAuth, trustScoreController.getMyTrustSummary);

/**
 * @route   POST /api/trust-score/profile-completion
 * @desc    Check and update profile completion status
 * @access  Private
 */
router.post('/profile-completion', requireAuth, trustScoreController.updateProfileCompletion);

// ============================================
// Admin Routes
// ============================================

/**
 * @route   GET /api/trust-score/user/:userId
 * @desc    Get specific user's trust score (Admin only)
 * @access  Admin
 */
router.get('/user/:userId', requireAuth, trustScoreController.getUserTrustScore);

/**
 * @route   GET /api/trust-score/user/:userId/logs
 * @desc    Get specific user's trust logs (Admin only)
 * @access  Admin
 * @query   limit - Number of logs to return (default: 50)
 */
router.get('/user/:userId/logs', requireAuth, trustScoreController.getUserTrustLogs);

/**
 * @route   POST /api/trust-score/admin/override/:userId
 * @desc    Admin override user's trust score
 * @access  Admin
 * @body    { newScore: number, reason: string }
 */
router.post('/admin/override/:userId', requireAuth, trustScoreController.adminOverrideTrustScore);

/**
 * @route   GET /api/trust-score/admin/statistics
 * @desc    Get trust score statistics for dashboard
 * @access  Admin
 */
router.get('/admin/statistics', requireAuth, trustScoreController.getTrustStatistics);

/**
 * @route   GET /api/trust-score/admin/top-users
 * @desc    Get top trusted users
 * @access  Admin
 * @query   limit - Number of users to return (default: 10)
 */
router.get('/admin/top-users', requireAuth, trustScoreController.getTopTrustedUsers);

/**
 * @route   GET /api/trust-score/admin/risky-users
 * @desc    Get risky users (low trust score)
 * @access  Admin
 * @query   limit - Number of users to return (default: 50)
 */
router.get('/admin/risky-users', requireAuth, trustScoreController.getRiskyUsers);

/**
 * @route   POST /api/trust-score/admin/manual-update
 * @desc    Manual trust score update (Admin only)
 * @access  Admin
 * @body    { userId: string, actionType: string, pointsChange: number, reason: string, metadata: object }
 */
router.post('/admin/manual-update', requireAuth, trustScoreController.manualTrustUpdate);

export default router;
