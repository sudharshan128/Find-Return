import { Request, Response } from 'express';
import trustScoreService from '../services/trustScoreService';
import { supabase } from '../services/supabase';

const supabaseAdmin = supabase.getServiceClient();

/**
 * Get current user's trust score
 */
export const getMyTrustScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const trustData = await trustScoreService.getUserTrustScore(userId);
    const levelDetails = trustScoreService.getTrustLevelDetails(trustData.trust_level);

    res.status(200).json({
      success: true,
      data: {
        ...trustData,
        levelDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust score',
      error: error.message,
    });
  }
};

/**
 * Get user's trust logs (history)
 */
export const getMyTrustLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const logs = await trustScoreService.getUserTrustLogs(userId, limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Error fetching trust logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust logs',
      error: error.message,
    });
  }
};

/**
 * Get user's trust summary
 */
export const getMyTrustSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const summary = await trustScoreService.getUserTrustSummary(userId);
    const levelDetails = trustScoreService.getTrustLevelDetails(summary.trustLevel);

    res.status(200).json({
      success: true,
      data: {
        ...summary,
        levelDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching trust summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust summary',
      error: error.message,
    });
  }
};

/**
 * Get any user's trust score (Admin only)
 */
export const getUserTrustScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const { userId } = req.params;
    
    // Check admin permissions
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const trustData = await trustScoreService.getUserTrustScore(userId);
    const levelDetails = trustScoreService.getTrustLevelDetails(trustData.trust_level);

    res.status(200).json({
      success: true,
      data: {
        ...trustData,
        levelDetails,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust score',
      error: error.message,
    });
  }
};

/**
 * Get any user's trust logs (Admin only)
 */
export const getUserTrustLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Check admin permissions
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const logs = await trustScoreService.getUserTrustLogs(userId, limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('Error fetching user trust logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust logs',
      error: error.message,
    });
  }
};

/**
 * Admin: Override user's trust score
 */
export const adminOverrideTrustScore = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const { userId } = req.params;
    const { newScore, reason } = req.body;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // Validate input
    if (typeof newScore !== 'number' || newScore < 0 || newScore > 100) {
      res.status(400).json({
        success: false,
        message: 'Invalid score. Must be between 0 and 100',
      });
      return;
    }

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'Reason is required (minimum 10 characters)',
      });
      return;
    }

    const result = await trustScoreService.adminOverrideTrustScore(
      adminId,
      userId,
      newScore,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Trust score overridden successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error overriding trust score:', error);
    res.status(error.message.includes('Unauthorized') ? 403 : 500).json({
      success: false,
      message: error.message || 'Failed to override trust score',
    });
  }
};

/**
 * Admin: Get trust statistics
 */
export const getTrustStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    
    // Check admin permissions
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const stats = await trustScoreService.getTrustStatistics();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching trust statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trust statistics',
      error: error.message,
    });
  }
};

/**
 * Admin: Get top trusted users
 */
export const getTopTrustedUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Check admin permissions
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const users = await trustScoreService.getTopTrustedUsers(limit);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('Error fetching top trusted users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top trusted users',
      error: error.message,
    });
  }
};

/**
 * Admin: Get risky users
 */
export const getRiskyUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Check admin permissions
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const users = await trustScoreService.getRiskyUsers(limit);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('Error fetching risky users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch risky users',
      error: error.message,
    });
  }
};

/**
 * Update profile completion status
 */
export const updateProfileCompletion = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const isComplete = await trustScoreService.checkAndUpdateProfileCompletion(userId);

    res.status(200).json({
      success: true,
      data: {
        profileCompleted: isComplete,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile completion:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile completion',
      error: error.message,
    });
  }
};

/**
 * Manual trust score update (for specific actions)
 * This should be called from other services, not directly from frontend
 */
export const manualTrustUpdate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, actionType, pointsChange, reason, metadata } = req.body;
    const adminId = req.user?.id;

    // This endpoint should only be accessible to backend services or admins
    const { data: admin } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', adminId)
      .single();

    if (!admin || !['admin', 'superadmin'].includes(admin.role)) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized: Admin access required',
      });
      return;
    }

    const result = await trustScoreService.updateTrustScore(
      userId,
      actionType,
      pointsChange,
      reason,
      metadata,
      adminId
    );

    res.status(200).json({
      success: true,
      message: 'Trust score updated successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('Error updating trust score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trust score',
      error: error.message,
    });
  }
};

export default {
  getMyTrustScore,
  getMyTrustLogs,
  getMyTrustSummary,
  getUserTrustScore,
  getUserTrustLogs,
  adminOverrideTrustScore,
  getTrustStatistics,
  getTopTrustedUsers,
  getRiskyUsers,
  updateProfileCompletion,
  manualTrustUpdate,
};
