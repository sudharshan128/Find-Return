import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const getTrustLevelColor = (score) => {
  if (score >= 0 && score <= 30) return '#dc2626'; // Red
  if (score >= 31 && score <= 50) return '#ea580c'; // Orange
  if (score >= 51 && score <= 70) return '#0891b2'; // Cyan
  if (score >= 71 && score <= 85) return '#059669'; // Green
  if (score >= 86 && score <= 100) return '#7c3aed'; // Purple
  return '#6b7280'; // Gray
};

const TrustScoreProgress = ({
  trustScore,
  trustLevel,
  previousScore,
  animated = true,
  showLabel = true,
  className = '',
}) => {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : trustScore);
  const color = getTrustLevelColor(trustScore);
  const scoreChange = previousScore ? trustScore - previousScore : 0;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(trustScore);
      return;
    }

    // Animate score change
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const stepValue = (trustScore - displayScore) / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setDisplayScore((prev) => {
        const nextValue = prev + stepValue;
        if (currentStep >= steps) {
          clearInterval(interval);
          return trustScore;
        }
        return nextValue;
      });
    }, duration / steps);

    return () => clearInterval(interval);
  }, [trustScore, animated]);

  return (
    <div className={`w-full ${className}`}>
      {/* Score and Label */}
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Trust Score</span>
            {scoreChange !== 0 && (
              <div
                className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  scoreChange > 0
                    ? 'bg-green-100 text-green-700'
                    : scoreChange < 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {scoreChange > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : scoreChange < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {scoreChange > 0 ? '+' : ''}
                  {scoreChange}
                </span>
              </div>
            )}
          </div>
          <span className="text-lg font-bold" style={{ color }}>
            {Math.round(displayScore)}/100
          </span>
        </div>
      )}

      {/* Progress Bar */}
      <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        {/* Animated background gradient */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `linear-gradient(90deg, ${color}00 0%, ${color} 100%)`,
          }}
        />

        {/* Progress fill with animation */}
        <div
          className={`h-full rounded-full relative overflow-hidden ${
            animated ? 'transition-all duration-1000 ease-out' : ''
          }`}
          style={{
            width: `${displayScore}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`,
          }}
        >
          {/* Shimmer effect */}
          {animated && (
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)`,
                animation: 'shimmer 2s infinite',
              }}
            />
          )}
        </div>

        {/* Milestone markers */}
        <div className="absolute inset-0 flex justify-between items-center px-1">
          {[30, 50, 70, 85].map((milestone) => (
            <div
              key={milestone}
              className="w-0.5 h-full bg-white opacity-50"
              style={{ marginLeft: `${milestone}%` }}
            />
          ))}
        </div>
      </div>

      {/* Trust Level Label */}
      {showLabel && (
        <div className="mt-2 flex justify-between items-center text-xs">
          <span className="text-gray-500">Level</span>
          <span className="font-semibold" style={{ color }}>
            {trustLevel}
          </span>
        </div>
      )}

      {/* Milestone indicators */}
      <div className="mt-3 flex justify-between text-xs text-gray-400">
        <span className="text-[10px]">Risky</span>
        <span className="text-[10px]">Fair</span>
        <span className="text-[10px]">Good</span>
        <span className="text-[10px]">High</span>
        <span className="text-[10px]">Verified</span>
      </div>

      {/* CSS for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default TrustScoreProgress;
