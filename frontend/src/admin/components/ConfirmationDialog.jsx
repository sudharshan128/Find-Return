/**
 * Confirmation Dialog Component
 * Enterprise-grade confirmation for destructive admin actions
 * 
 * SECURITY FEATURES:
 * - Risk level indicators (low, medium, high, critical)
 * - Required reason/justification for high-risk actions
 * - Typing confirmation for critical actions
 * - Cool-down timer before enabling confirm button
 * - Audit trail preparation
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  ExclamationTriangleIcon, 
  ShieldExclamationIcon,
  XMarkIcon,
  CheckIcon 
} from '@heroicons/react/24/outline';

const RISK_LEVELS = {
  low: {
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-600',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    label: 'Low Risk',
    cooldownSeconds: 0,
    requireReason: false,
    requireTyping: false,
  },
  medium: {
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
    label: 'Medium Risk',
    cooldownSeconds: 2,
    requireReason: false,
    requireTyping: false,
  },
  high: {
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    iconColor: 'text-orange-600',
    buttonColor: 'bg-orange-600 hover:bg-orange-700',
    label: 'High Risk',
    cooldownSeconds: 3,
    requireReason: true,
    requireTyping: false,
  },
  critical: {
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
    buttonColor: 'bg-red-600 hover:bg-red-700',
    label: 'Critical - Irreversible',
    cooldownSeconds: 5,
    requireReason: true,
    requireTyping: true,
  },
};

// Action-specific risk mappings
export const ACTION_RISKS = {
  // User actions
  banUser: 'high',
  suspendUser: 'medium',
  unbanUser: 'medium',
  deleteUserAccount: 'critical',
  adjustTrustScore: 'medium',
  
  // Item actions
  hideItem: 'low',
  unhideItem: 'low',
  deleteItem: 'high',
  flagItem: 'low',
  unflagItem: 'low',
  
  // Claim actions
  approveClaim: 'medium',
  rejectClaim: 'medium',
  
  // Admin actions
  deactivateAdmin: 'high',
  changeAdminRole: 'high',
  forceLogoutAdmin: 'high',
  forceLogoutAllAdmins: 'critical',
  
  // System actions
  purgeOldData: 'critical',
  resetDatabase: 'critical',
  exportAllData: 'high',
  
  // Default
  default: 'medium',
};

export const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  actionType = 'default',
  riskLevel: propRiskLevel,
  targetName = '',
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  children,
}) => {
  // Determine risk level
  const riskLevel = propRiskLevel || ACTION_RISKS[actionType] || ACTION_RISKS.default;
  const config = RISK_LEVELS[riskLevel];
  
  // State
  const [reason, setReason] = useState('');
  const [typingConfirmation, setTypingConfirmation] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(config.cooldownSeconds);
  const [isConfirming, setIsConfirming] = useState(false);
  
  // Expected typing for critical actions
  const expectedTyping = targetName ? targetName.toUpperCase() : 'CONFIRM';
  
  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTypingConfirmation('');
      setCooldownRemaining(config.cooldownSeconds);
      setIsConfirming(false);
    }
  }, [isOpen, config.cooldownSeconds]);
  
  // Cooldown timer
  useEffect(() => {
    if (!isOpen || cooldownRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setCooldownRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isOpen, cooldownRemaining]);
  
  // Check if confirm is allowed
  const canConfirm = useCallback(() => {
    if (cooldownRemaining > 0) return false;
    if (config.requireReason && reason.trim().length < 10) return false;
    if (config.requireTyping && typingConfirmation !== expectedTyping) return false;
    return true;
  }, [cooldownRemaining, config, reason, typingConfirmation, expectedTyping]);
  
  // Handle confirm
  const handleConfirm = async () => {
    if (!canConfirm()) return;
    
    setIsConfirming(true);
    try {
      await onConfirm({
        reason: config.requireReason ? reason : null,
        riskLevel,
        timestamp: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      console.error('Confirmation action failed:', error);
      setIsConfirming(false);
    }
  };
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className={`relative w-full max-w-md mx-4 bg-white rounded-lg shadow-xl ${config.borderColor} border-2`}>
        {/* Header */}
        <div className={`${config.bgColor} px-6 py-4 rounded-t-lg border-b ${config.borderColor}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {riskLevel === 'critical' ? (
                <ShieldExclamationIcon className={`w-6 h-6 ${config.iconColor}`} />
              ) : (
                <ExclamationTriangleIcon className={`w-6 h-6 ${config.iconColor}`} />
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <span className={`text-xs font-medium ${config.iconColor} uppercase tracking-wide`}>
                  {config.label}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-gray-700">{message}</p>
          
          {targetName && (
            <div className="px-3 py-2 bg-gray-100 rounded border border-gray-200">
              <span className="text-sm text-gray-500">Target: </span>
              <span className="font-medium text-gray-900">{targetName}</span>
            </div>
          )}
          
          {children}
          
          {/* Reason input (for high+ risk) */}
          {config.requireReason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a detailed reason for this action (min 10 characters)..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                {reason.length}/10 characters minimum
              </p>
            </div>
          )}
          
          {/* Typing confirmation (for critical actions) */}
          {config.requireTyping && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-2">
                Type <span className="font-mono font-bold">{expectedTyping}</span> to confirm this action:
              </p>
              <input
                type="text"
                value={typingConfirmation}
                onChange={(e) => setTypingConfirmation(e.target.value.toUpperCase())}
                placeholder="Type here..."
                className="w-full px-3 py-2 border border-red-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
              />
              {typingConfirmation && typingConfirmation !== expectedTyping && (
                <p className="text-xs text-red-600 mt-1">
                  Text doesn't match. Please type exactly: {expectedTyping}
                </p>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg border-t border-gray-200 flex items-center justify-between">
          {/* Cooldown indicator */}
          {cooldownRemaining > 0 && (
            <p className="text-sm text-gray-500">
              Wait {cooldownRemaining}s before confirming...
            </p>
          )}
          
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={isConfirming}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {cancelButtonText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm() || isConfirming}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${config.buttonColor} disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2`}
            >
              {isConfirming ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  {confirmButtonText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render in portal
  return createPortal(dialog, document.body);
};

// Hook for easy confirmation dialogs
export const useConfirmation = () => {
  const [config, setConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'default',
    riskLevel: null,
    targetName: '',
    confirmButtonText: 'Confirm',
    onConfirm: () => {},
  });
  
  const confirm = useCallback(({
    title,
    message,
    actionType,
    riskLevel,
    targetName,
    confirmButtonText,
    onConfirm,
  }) => {
    return new Promise((resolve) => {
      setConfig({
        isOpen: true,
        title,
        message,
        actionType,
        riskLevel,
        targetName,
        confirmButtonText,
        onConfirm: async (data) => {
          await onConfirm?.(data);
          resolve({ confirmed: true, ...data });
        },
      });
    });
  }, []);
  
  const close = useCallback(() => {
    setConfig(prev => ({ ...prev, isOpen: false }));
  }, []);
  
  const ConfirmDialog = useCallback(() => (
    <ConfirmationDialog
      isOpen={config.isOpen}
      onClose={close}
      onConfirm={config.onConfirm}
      title={config.title}
      message={config.message}
      actionType={config.actionType}
      riskLevel={config.riskLevel}
      targetName={config.targetName}
      confirmButtonText={config.confirmButtonText}
    />
  ), [config, close]);
  
  return { confirm, close, ConfirmDialog };
};

export default ConfirmationDialog;
