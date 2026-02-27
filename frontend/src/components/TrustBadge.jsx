import React, { useState } from 'react';
import { Shield, Info } from 'lucide-react';

const getTrustLevelDetails = (level) => {
  const details = {
    'Risky User': {
      color: '#dc2626',
      bgColor: '#fee2e2',
      icon: '⚠️',
      badge: 'danger',
    },
    'Fair Trust': {
      color: '#ea580c',
      bgColor: '#ffedd5',
      icon: '⚡',
      badge: 'warning',
    },
    'Good Trust': {
      color: '#0891b2',
      bgColor: '#cffafe',
      icon: '✓',
      badge: 'info',
    },
    'High Trust': {
      color: '#059669',
      bgColor: '#d1fae5',
      icon: '★',
      badge: 'success',
    },
    'Verified Trusted Member': {
      color: '#7c3aed',
      bgColor: '#ede9fe',
      icon: '👑',
      badge: 'premium',
    },
  };
  return details[level] || { color: '#6b7280', bgColor: '#f3f4f6', icon: '?', badge: 'default' };
};

const TrustBadge = ({
  trustScore,
  trustLevel,
  size = 'medium',
  showTooltip = true,
  animated = false,
  className = '',
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const details = getTrustLevelDetails(trustLevel);

  const sizeClasses = {
    small: 'text-xs px-2 py-1',
    medium: 'text-sm px-3 py-1.5',
    large: 'text-base px-4 py-2',
  };

  const iconSizes = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          flex items-center gap-2 rounded-full font-semibold
          transition-all duration-300
          ${sizeClasses[size]}
          ${animated ? 'hover:scale-105 hover:shadow-lg' : ''}
        `}
        style={{
          backgroundColor: details.bgColor,
          color: details.color,
          border: `2px solid ${details.color}`,
        }}
      >
        <span className={iconSizes[size]}>{details.icon}</span>
        <span className="font-bold">{trustScore}</span>
        <span className="font-medium">{trustLevel}</span>
        
        {showTooltip && (
          <Info
            className={`${iconSizes[size]} cursor-pointer opacity-70 hover:opacity-100 transition-opacity`}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          />
        )}
      </div>

      {/* Tooltip */}
      {showInfo && showTooltip && (
        <div
          className="absolute z-50 w-80 p-4 mt-2 bg-white rounded-lg shadow-2xl border border-gray-200"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-1">
                  Trust Score Explanation
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Your trust score reflects your reliability and activity on the platform.
                </p>
              </div>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h5 className="font-semibold text-xs text-gray-700">How to Improve:</h5>
              <ul className="space-y-1.5 text-xs text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Verify your email (+5 points)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Complete your profile (+5 points)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Return items successfully (+15 points)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Get claims approved (+10 points)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Stay active without issues (+5 points/30 days)</span>
                </li>
              </ul>
            </div>

            <div className="border-t pt-3 space-y-2">
              <h5 className="font-semibold text-xs text-gray-700">Trust Levels:</h5>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>0-30:</span>
                  <span className="font-semibold text-red-600">Risky User</span>
                </div>
                <div className="flex justify-between">
                  <span>31-50:</span>
                  <span className="font-semibold text-orange-600">Fair Trust</span>
                </div>
                <div className="flex justify-between">
                  <span>51-70:</span>
                  <span className="font-semibold text-cyan-600">Good Trust</span>
                </div>
                <div className="flex justify-between">
                  <span>71-85:</span>
                  <span className="font-semibold text-green-600">High Trust</span>
                </div>
                <div className="flex justify-between">
                  <span>86-100:</span>
                  <span className="font-semibold text-purple-600">Verified Trusted</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustBadge;
