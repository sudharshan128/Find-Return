/**
 * Safety Banner Component
 * Warning banners for trust and safety
 */

import { AlertTriangle, Shield, Info, X } from 'lucide-react';
import { useState } from 'react';

const SafetyBanner = ({
  type = 'warning', // warning, info, danger
  title,
  message,
  dismissible = false,
  storageKey = null, // If provided, remember dismissal
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(() => {
    if (storageKey) {
      try {
        return sessionStorage.getItem(`banner_${storageKey}`) === 'dismissed';
      } catch {
        return false;
      }
    }
    return false;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        sessionStorage.setItem(`banner_${storageKey}`, 'dismissed');
      } catch {
        // Ignore storage errors
      }
    }
  };

  const styles = {
    warning: {
      container: 'bg-yellow-50 border-yellow-200',
      icon: 'text-yellow-600',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
    },
    info: {
      container: 'bg-blue-50 border-blue-200',
      icon: 'text-blue-600',
      title: 'text-blue-800',
      message: 'text-blue-700',
    },
    danger: {
      container: 'bg-red-50 border-red-200',
      icon: 'text-red-600',
      title: 'text-red-800',
      message: 'text-red-700',
    },
    success: {
      container: 'bg-green-50 border-green-200',
      icon: 'text-green-600',
      title: 'text-green-800',
      message: 'text-green-700',
    },
  };

  const style = styles[type] || styles.warning;
  const Icon = type === 'danger' ? AlertTriangle : type === 'info' ? Info : Shield;

  return (
    <div className={`p-4 border rounded-lg flex gap-3 ${style.container} ${className}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${style.icon}`} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`font-medium text-sm mb-1 ${style.title}`}>{title}</p>
        )}
        <p className={`text-sm ${style.message}`}>{message}</p>
      </div>
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={`p-1 hover:bg-white/50 rounded transition-colors ${style.icon}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// Pre-configured safety banners
export const ClaimSafetyBanner = () => (
  <SafetyBanner
    type="warning"
    title="Verify ownership honestly"
    message="Submitting false claims is a serious offense. Your account may be permanently banned, and legal action may be taken against fraudulent claims."
    dismissible
    storageKey="claim_safety"
  />
);

export const ChatSafetyBanner = () => (
  <SafetyBanner
    type="info"
    title="Stay safe"
    message="Keep communication within the app. Never share personal contact information, bank details, or meet alone in isolated places."
  />
);

export const HandoverSafetyBanner = () => (
  <SafetyBanner
    type="warning"
    title="Safe handover tips"
    message="Meet in a public place during daylight. Bring a friend if possible. Verify the item before completing the handover. Never accept or pay money."
    dismissible
    storageKey="handover_safety"
  />
);

export const FakeClaimWarning = () => (
  <SafetyBanner
    type="danger"
    title="Warning: Fraudulent claims detected"
    message="We've noticed suspicious activity. If you're caught making false claims, your account will be permanently banned."
    className="mt-4"
  />
);

export const TrustScoreBanner = ({ score }) => {
  if (score >= 70) return null;
  
  return (
    <SafetyBanner
      type="warning"
      title="Low trust score detected"
      message={`This user has a trust score of ${score}/100. Proceed with caution and verify thoroughly before approving any claims.`}
    />
  );
};

export default SafetyBanner;
