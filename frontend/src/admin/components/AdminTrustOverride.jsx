import React, { useState } from 'react';
import { Shield, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { trustScoreAPI } from '../../utils/api';

const AdminTrustOverride = ({
  userId,
  userName,
  currentScore,
  currentLevel,
  onSuccess,
  onClose,
}) => {
  const [newScore, setNewScore] = useState(currentScore);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newScore < 0 || newScore > 100) {
      setError('Score must be between 0 and 100');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await trustScoreAPI.adminOverride(userId, {
        newScore,
        reason: reason.trim(),
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
        }, 1500);
      } else {
        setError(response.message || 'Failed to override trust score');
      }
    } catch (err) {
      console.error('Error overriding trust score:', err);
      setError(err.message || 'Failed to override trust score');
    } finally {
      setLoading(false);
    }
  };

  const predictedLevel = (score) => {
    if (score >= 0 && score <= 30) return 'Risky User';
    if (score >= 31 && score <= 50) return 'Fair Trust';
    if (score >= 51 && score <= 70) return 'Good Trust';
    if (score >= 71 && score <= 85) return 'High Trust';
    if (score >= 86 && score <= 100) return 'Verified Trusted Member';
    return 'Unknown';
  };

  const getLevelColor = (level) => {
    const colors = {
      'Risky User': 'text-red-600',
      'Fair Trust': 'text-orange-600',
      'Good Trust': 'text-cyan-600',
      'High Trust': 'text-green-600',
      'Verified Trusted Member': 'text-purple-600',
    };
    return colors[level] || 'text-gray-600';
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Trust Score Updated!</h3>
          <p className="text-gray-600">
            The trust score has been successfully updated.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8" />
              <div>
                <h2 className="text-2xl font-bold">Admin Trust Score Override</h2>
                <p className="text-purple-100 text-sm">
                  Manually adjust trust score for {userName}
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Current Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Current Score</p>
                <p className="text-2xl font-bold text-gray-900">{currentScore}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Level</p>
                <p className={`text-lg font-semibold ${getLevelColor(currentLevel)}`}>
                  {currentLevel}
                </p>
              </div>
            </div>
          </div>

          {/* New Score Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              New Trust Score *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                value={newScore}
                onChange={(e) => setNewScore(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg font-bold"
                placeholder="0-100"
                required
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-medium">
                / 100
              </div>
            </div>
            
            {/* Score Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={newScore}
              onChange={(e) => setNewScore(parseInt(e.target.value))}
              className="w-full mt-3"
            />

            {/* Predicted Level */}
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-gray-600">Predicted Level:</span>
              <span className={`font-semibold ${getLevelColor(predictedLevel(newScore))}`}>
                {predictedLevel(newScore)}
              </span>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Reason for Override * <span className="text-gray-500 font-normal">(Min 10 characters)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Explain why this trust score override is necessary..."
              required
              minLength={10}
            />
            <div className="mt-1 text-right text-sm text-gray-500">
              {reason.length}/10 characters minimum
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Warning</p>
              <p>
                This action will override the user's trust score and will be logged in the system.
                Make sure you have a valid reason for this action.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                disabled={loading}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || newScore === currentScore}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                loading || newScore === currentScore
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </span>
              ) : (
                'Update Trust Score'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminTrustOverride;
