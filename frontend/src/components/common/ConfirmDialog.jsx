/**
 * Confirm Dialog Component
 * Reusable confirmation modal for destructive actions
 */

import { AlertTriangle, X, Loader2 } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // danger, warning, info
  loading = false,
  icon: CustomIcon = null,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: 'bg-yellow-100 text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      icon: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
    success: {
      icon: 'bg-green-100 text-green-600',
      button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  // Handle both component icons and rendered elements
  const renderIcon = () => {
    if (CustomIcon) {
      // If it's a React element (already rendered), return it directly
      if (typeof CustomIcon === 'object' && CustomIcon.$$typeof) {
        return CustomIcon;
      }
      // If it's a component, render it
      return <CustomIcon className="w-6 h-6" />;
    }
    return <AlertTriangle className="w-6 h-6" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6">
          <div className={`p-3 rounded-full ${styles.icon}`}>
            {renderIcon()}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">{message}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 ${styles.button}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
