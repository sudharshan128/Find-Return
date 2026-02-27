/**
 * Claim Form Component
 * Modal form to submit ownership claim
 */

import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../lib/supabase';
import { X, Upload, AlertCircle, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';

const ClaimForm = ({ item, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [proofImages, setProofImages] = useState([]);
  const [formData, setFormData] = useState({
    uniqueMarks: '',
    contents: '',
    lossDetails: '',
    additionalInfo: '',
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: 3,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles) => {
      setProofImages((prev) => [...prev, ...acceptedFiles].slice(0, 3));
    },
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        toast.error('File is too large. Max size is 5MB.');
      } else if (error?.code === 'too-many-files') {
        toast.error('Maximum 3 proof images allowed.');
      }
    },
  });

  const removeImage = (index) => {
    setProofImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.uniqueMarks.trim()) {
      toast.error('Please describe unique identifying marks');
      return;
    }
    if (!formData.lossDetails.trim()) {
      toast.error('Please describe when and how you lost the item');
      return;
    }

    setLoading(true);
    try {
      // Upload proof images if any
      const uploadedImages = [];
      for (const file of proofImages) {
        try {
          const { path, publicUrl } = await storage.uploadClaimImage(file, user.id);
          uploadedImages.push(publicUrl);
          console.log('[ClaimForm] Image uploaded successfully:', path);
        } catch (uploadError) {
          console.error('[ClaimForm] Image upload error:', uploadError);
          // Continue without images if upload fails
        }
      }

      console.log('[ClaimForm] Creating claim with data:', {
        item_id: item.id,
        claimant_id: user.id,
        status: 'pending',
        description: formData.uniqueMarks,
        contact_info: user.email || 'Not provided',
        security_answer_encrypted: 'encrypted_via_backend', // Will be encrypted by backend
        proof_description: formData.lossDetails,
        proof_images: uploadedImages,
      });

      // Create claim with correct column names
      const claim = await db.claims.create({
        item_id: item.id,
        claimant_id: user.id,
        status: 'pending',
        description: formData.uniqueMarks, // Unique marks
        contact_info: user.email || 'Not provided', // User's email
        security_answer_encrypted: 'pending_verification', // Placeholder - backend will handle encryption
        proof_description: formData.lossDetails, // How they lost it + contents
        proof_images: uploadedImages, // Array of image URLs
      });

      console.log('[ClaimForm] Claim created successfully:', claim);
      onSuccess(claim);
    } catch (error) {
      console.error('Error submitting claim:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);
      console.error('Error details:', error?.details);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      toast.error(`Failed to submit claim: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Claim This Item</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-4 p-4 bg-blue-50 rounded-lg flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Prove your ownership</p>
            <p>Answer the questions below with details only the true owner would know. The finder will review your answers.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Unique Marks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unique Identifying Marks <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Describe any scratches, stickers, engravings, or unique features
            </p>
            <textarea
              name="uniqueMarks"
              value={formData.uniqueMarks}
              onChange={handleInputChange}
              rows={3}
              className="input w-full"
              placeholder="e.g., There's a small scratch on the back, a blue sticker on the cover..."
              required
            />
          </div>

          {/* Contents */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contents or Internal Details
            </label>
            <p className="text-xs text-gray-500 mb-2">
              What's inside? Any specific items, files, or details?
            </p>
            <textarea
              name="contents"
              value={formData.contents}
              onChange={handleInputChange}
              rows={3}
              className="input w-full"
              placeholder="e.g., Inside the wallet there's a photo of my family, my gym membership card..."
            />
          </div>

          {/* Loss Details */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              When & How Did You Lose It? <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Provide approximate date, time, and circumstances
            </p>
            <textarea
              name="lossDetails"
              value={formData.lossDetails}
              onChange={handleInputChange}
              rows={3}
              className="input w-full"
              placeholder="e.g., I lost it on Monday evening around 6pm while taking an auto from MG Road..."
              required
            />
          </div>

          {/* Additional Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Information
            </label>
            <textarea
              name="additionalInfo"
              value={formData.additionalInfo}
              onChange={handleInputChange}
              rows={2}
              className="input w-full"
              placeholder="Any other details that prove ownership..."
            />
          </div>

          {/* Proof Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Proof Images (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Upload photos of purchase receipts, previous photos with the item, etc.
            </p>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {isDragActive
                  ? 'Drop the files here...'
                  : 'Drag & drop images here, or click to select'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Max 3 images, 5MB each</p>
            </div>

            {/* Preview images */}
            {proofImages.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {proofImages.map((file, index) => (
                  <div key={index} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Proof ${index + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-50 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Important</p>
              <p>False claims will result in account suspension. You can only claim this item up to 3 times.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner h-4 w-4 mr-2"></div>
                  Submitting...
                </>
              ) : (
                'Submit Claim'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClaimForm;
