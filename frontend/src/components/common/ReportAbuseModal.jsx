/**
 * Report Abuse Modal
 * Modal for reporting items, users, or messages
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { X, AlertTriangle, Flag, Loader2, Shield } from 'lucide-react';

const REPORT_REASONS = {
  item: [
    { value: 'fake_listing', label: 'Fake or misleading listing' },
    { value: 'stolen_item', label: 'Item appears to be stolen' },
    { value: 'inappropriate_content', label: 'Inappropriate images or content' },
    { value: 'scam', label: 'Suspected scam' },
    { value: 'duplicate', label: 'Duplicate listing' },
    { value: 'other', label: 'Other' },
  ],
  user: [
    { value: 'harassment', label: 'Harassment or abuse' },
    { value: 'fake_claims', label: 'Making false claims' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'impersonation', label: 'Impersonation' },
    { value: 'inappropriate_behavior', label: 'Inappropriate behavior' },
    { value: 'other', label: 'Other' },
  ],
  message: [
    { value: 'harassment', label: 'Harassment or threats' },
    { value: 'spam', label: 'Spam or irrelevant content' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'personal_info_request', label: 'Requesting personal information' },
    { value: 'scam', label: 'Scam attempt' },
    { value: 'other', label: 'Other' },
  ],
  claim: [
    { value: 'fake_claim', label: 'Fake or fraudulent claim' },
    { value: 'harassment', label: 'Harassment in claim' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
  ],
};

const ReportAbuseModal = ({
  isOpen,
  onClose,
  targetType, // 'item', 'user', 'message', 'claim'
  targetId,
  targetTitle = '', // Optional display name
}) => {
  const { user, isAuthenticated } = useAuth();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const reasons = REPORT_REASONS[targetType] || REPORT_REASONS.item;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Please log in to submit a report');
      return;
    }

    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    if (description.trim().length < 10) {
      toast.error('Please provide more details (at least 10 characters)');
      return;
    }

    setLoading(true);
    try {
      await db.reports.create({
        reporter_id: user.id,
        target_type: targetType,
        [`target_${targetType}_id`]: targetId,
        reason,
        description: description.trim(),
      });

      toast.success('Report submitted. Our team will review it shortly.');
      onClose();
      setReason('');
      setDescription('');
    } catch (error) {
      console.error('Error submitting report:', error);
      if (error.message?.includes('duplicate')) {
        toast.error('You have already reported this');
      } else {
        toast.error('Failed to submit report. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-full">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Report {targetType}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="mx-6 mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium mb-1">Report responsibly</p>
            <p>False reports may result in your account being suspended. Only report genuine violations.</p>
          </div>
        </div>

        {/* Target Info */}
        {targetTitle && (
          <div className="mx-6 mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Reporting:</p>
            <p className="text-sm font-medium text-gray-900 truncate">{targetTitle}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for reporting <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {reasons.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    reason === r.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-900">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional details <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Please provide specific details to help us investigate
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="input w-full"
              placeholder="Describe the issue in detail..."
              required
              minLength={10}
            />
          </div>

          {/* Privacy Notice */}
          <div className="flex gap-2 p-3 bg-blue-50 rounded-lg">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Your report is confidential. The reported party will not see your identity.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason || description.trim().length < 10}
              className="flex-1 btn btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportAbuseModal;
