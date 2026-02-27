/**
 * Rate Limit Indicator Component
 * Shows remaining attempts and time until reset
 */

import { AlertCircle, Clock, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

const RateLimitIndicator = ({
  current = 0,
  max = 3,
  resetTime = null, // ISO timestamp or null
  action = 'action', // 'upload', 'claim', etc.
  showWhenOk = false, // Show even when not at limit
  className = '',
}) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const remaining = max - current;
  const isAtLimit = remaining <= 0;
  const isNearLimit = remaining === 1;

  useEffect(() => {
    if (!resetTime || !isAtLimit) {
      setTimeRemaining('');
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const reset = new Date(resetTime);
      const diff = reset - now;

      if (diff <= 0) {
        setTimeRemaining('now');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [resetTime, isAtLimit]);

  if (!showWhenOk && !isAtLimit && !isNearLimit) {
    return null;
  }

  if (isAtLimit) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">
            Daily limit reached
          </p>
          <p className="text-xs text-red-600">
            You've used all {max} {action}s for today.
            {timeRemaining && ` Resets in ${timeRemaining}.`}
          </p>
        </div>
        {timeRemaining && (
          <div className="flex items-center gap-1 text-red-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">{timeRemaining}</span>
          </div>
        )}
      </div>
    );
  }

  if (isNearLimit) {
    return (
      <div className={`flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
        <p className="text-sm text-yellow-800">
          <span className="font-medium">1 {action} remaining</span> for today
        </p>
      </div>
    );
  }

  // Show remaining when showWhenOk is true
  return (
    <div className={`flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm text-gray-600 ${className}`}>
      <Info className="w-4 h-4" />
      <span>{remaining} of {max} {action}s remaining today</span>
    </div>
  );
};

// Pre-configured rate limit indicators
export const UploadLimitIndicator = ({ current, resetTime }) => (
  <RateLimitIndicator
    current={current}
    max={3}
    resetTime={resetTime}
    action="upload"
    showWhenOk
  />
);

export const ClaimLimitIndicator = ({ current, resetTime }) => (
  <RateLimitIndicator
    current={current}
    max={5}
    resetTime={resetTime}
    action="claim"
    showWhenOk
  />
);

export default RateLimitIndicator;
