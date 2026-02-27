/**
 * Upload Found Item Page
 * Full-page form to upload found items following the mandatory feature spec
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { db, storage, supabase } from '../lib/supabase';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { 
  Upload, 
  X, 
  MapPin, 
  Calendar, 
  Image as ImageIcon, 
  AlertCircle,
  Check,
  ChevronRight,
  ChevronLeft,
  Package,
  FileText,
  Shield,
  Loader2,
  Info
} from 'lucide-react';

// Fixed categories as per requirement
const FIXED_CATEGORIES = [
  { slug: 'phone', name: 'Phone', icon: '📱' },
  { slug: 'wallet', name: 'Wallet', icon: '👛' },
  { slug: 'id-card', name: 'ID Card', icon: '🪪' },
  { slug: 'bag', name: 'Bag', icon: '👜' },
  { slug: 'documents', name: 'Documents', icon: '📄' },
  { slug: 'keys', name: 'Keys', icon: '🔑' },
  { slug: 'other', name: 'Other', icon: '📦' },
];

// Fixed areas as fallback
const FIXED_AREAS = [
  { id: '1', name: 'BTM Layout', zone: 'South' },
  { id: '2', name: 'Koramangala', zone: 'South' },
  { id: '3', name: 'Indiranagar', zone: 'East' },
  { id: '4', name: 'Whitefield', zone: 'East' },
  { id: '5', name: 'Silk Board', zone: 'South' },
  { id: '6', name: 'Richmond Road', zone: 'West' },
  { id: '7', name: 'Ulsoor', zone: 'Central' },
  { id: '8', name: 'Forum Mall', zone: 'South' },
  { id: '9', name: 'MG Road', zone: 'Central' },
  { id: '10', name: 'Brigade Road', zone: 'Central' },
];

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const UploadItemPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, authLoading } = useAuth();
  const { contact_email } = useSettings();
  
  // Form state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [images, setImages] = useState([]);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [formData, setFormData] = useState({
    // Category
    categoryId: '',
    categorySlug: '',
    // Product Details
    color: '',
    brand: '',
    title: '',
    description: '',
    // Security question (to verify true owner)
    securityQuestion: '',
    // Location & Date
    areaId: '',
    locationDetails: '',
    dateFound: new Date().toISOString().split('T')[0],
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !authLoading) {
      console.log('[UPLOAD] Not authenticated, redirecting to login');
      toast.error('Please sign in to upload a found item');
      navigate('/login', { state: { from: '/upload-item' } });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Load categories and areas from database - wait for auth
  useEffect(() => {
    // Skip if auth is still initializing
    if (authLoading) {
      console.log('[UPLOAD] Waiting for auth to initialize...');
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        console.log('[UPLOAD] Loading categories and areas...');
        
        // Load categories
        let catsData = [];
        try {
          console.log('[UPLOAD] Fetching categories...');
          catsData = await db.categories.getAll();
          console.log('[UPLOAD] Categories response:', catsData);
        } catch (catError) {
          console.error('[UPLOAD] Error loading categories:', catError);
        }
        
        // Load areas
        let areasData = [];
        try {
          console.log('[UPLOAD] Fetching areas...');
          areasData = await db.areas.getAll();
          console.log('[UPLOAD] Areas response:', areasData);
        } catch (areaError) {
          console.error('[UPLOAD] Error loading areas:', areaError);
        }
        
        // Map database categories to fixed categories or use fixed if no match
        if (catsData && catsData.length > 0) {
          setCategories(catsData);
          console.log('[UPLOAD] Categories loaded from DB:', catsData.length);
        } else {
          // Use fixed categories if none in database
          setCategories(FIXED_CATEGORIES.map((c, i) => ({
            id: c.slug,
            ...c,
            display_order: i,
          })));
          console.log('[UPLOAD] Using fixed categories');
        }
        
        // Always set areas, even if empty (will fallback in render if needed)
        if (areasData && areasData.length > 0) {
          setAreas(areasData);
          console.log('[UPLOAD] Areas loaded from DB:', areasData.length);
        } else {
          // Use fixed areas if none in database
          setAreas(FIXED_AREAS.map((a, i) => ({
            ...a,
            is_active: true,
            display_order: i,
          })));
          console.log('[UPLOAD] Using fixed areas');
        }
        console.log('[UPLOAD] Total areas available:', (areasData?.length || FIXED_AREAS.length));
      } catch (error) {
        console.error('[UPLOAD] Unexpected error loading data:', error);
        // Always fall back to fixed categories on error
        setCategories(FIXED_CATEGORIES.map((c, i) => ({
          id: c.slug,
          ...c,
          display_order: i,
        })));
        setAreas([]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authLoading]);

  // Group areas by zone for better UX
  const areasByZone = areas.reduce((acc, area) => {
    const zone = area.zone || 'Other';
    if (!acc[zone]) acc[zone] = [];
    acc[zone].push(area);
    return acc;
  }, {});

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      rejectedFiles.forEach((rejection) => {
        const error = rejection.errors[0];
        if (error?.code === 'file-too-large') {
          toast.error(`${rejection.file.name} is too large. Max size is 5MB.`);
        } else if (error?.code === 'file-invalid-type') {
          toast.error(`${rejection.file.name} is not a valid image type.`);
        }
      });
    }

    // Process accepted files
    const newFiles = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
      size: file.size,
    }));
    
    setImages((prev) => {
      const combined = [...prev, ...newFiles];
      if (combined.length > 5) {
        toast.error('Maximum 5 images allowed');
        return combined.slice(0, 5);
      }
      return combined;
    });
    
    // Clear image error if present
    if (errors.images) {
      setErrors((prev) => ({ ...prev, images: null }));
    }
  }, [errors.images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 5,
    maxSize: MAX_FILE_SIZE,
  });

  const removeImage = (index) => {
    setImages((prev) => {
      // Revoke URL to prevent memory leaks
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear specific error when field is modified
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCategorySelect = (category) => {
    setFormData((prev) => ({
      ...prev,
      categoryId: category.id,
      categorySlug: category.slug,
    }));
    if (errors.categoryId) {
      setErrors((prev) => ({ ...prev, categoryId: null }));
    }
  };

  // Validation functions
  const validateStep = (stepNum) => {
    const newErrors = {};

    switch (stepNum) {
      case 1: // Category selection
        if (!formData.categoryId) {
          newErrors.categoryId = 'Please select a category';
        }
        break;
        
      case 2: // Product details
        if (!formData.title.trim() || formData.title.length < 5) {
          newErrors.title = 'Title must be at least 5 characters';
        }
        if (formData.title.length > 100) {
          newErrors.title = 'Title must be less than 100 characters';
        }
        if (formData.description && formData.description.length > 1000) {
          newErrors.description = 'Description must be less than 1000 characters';
        }
        // Check for serial numbers or sensitive info
        const sensitivePattern = /\b(serial|imei|mac|aadhaar|pan|passport)\s*(number|no|#)?[\s:]*[\w-]{6,}/i;
        if (sensitivePattern.test(formData.description)) {
          newErrors.description = 'Please do not include serial numbers or sensitive ID information';
        }
        if (!formData.securityQuestion.trim() || formData.securityQuestion.length < 10) {
          newErrors.securityQuestion = 'Security question must be at least 10 characters';
        }
        break;
        
      case 3: // Location & Date
        if (!formData.areaId) {
          newErrors.areaId = 'Please select an area';
        }
        if (!formData.dateFound) {
          newErrors.dateFound = 'Please select the date found';
        }
        // Validate date is not in future
        if (new Date(formData.dateFound) > new Date()) {
          newErrors.dateFound = 'Date cannot be in the future';
        }
        break;
        
      case 4: // Image upload
        if (images.length === 0) {
          newErrors.images = 'Please upload at least one image';
        }
        break;
        
      case 5: // Confirmation
        if (!confirmed) {
          newErrors.confirmed = 'Please confirm the declaration';
        }
        break;
        
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (targetStep) => {
    // Can only go back or to completed steps
    if (targetStep < step) {
      setStep(targetStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(5)) return;
    if (!user) {
      toast.error('Please sign in to continue');
      return;
    }

    console.log('[UploadItemPage] ====== SUBMIT STARTED ======');
    console.log('[UploadItemPage] User ID:', user.id);
    console.log('[UploadItemPage] Images to upload:', images.length);
    
    setSubmitting(true);
    let uploadedImagePaths = [];
    
    try {
      // Step 1: Upload images first
      console.log('[UploadItemPage] Step 1: Starting image uploads...');
      toast.loading('Uploading images...', { id: 'upload' });
      
      const uploadPromises = images.map(async (img, index) => {
        console.log(`[UploadItemPage] Uploading image ${index + 1}/${images.length}:`, img.file.name);
        const result = await storage.uploadItemImage(img.file, user.id);
        console.log(`[UploadItemPage] Image ${index + 1} uploaded:`, result.publicUrl);
        return result.publicUrl;
      });
      
      console.log('[UploadItemPage] Waiting for all image uploads...');
      uploadedImagePaths = await Promise.all(uploadPromises);
      console.log('[UploadItemPage] All images uploaded:', uploadedImagePaths);
      toast.dismiss('upload');

      // Step 2: Create item in database
      console.log('[UploadItemPage] Step 2: Creating item in database...');
      toast.loading('Creating item...', { id: 'create' });
      
      const itemData = {
        finder_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category_id: formData.categoryId,
        area_id: formData.areaId,
        location_details: formData.locationDetails.trim() || null,
        date_found: formData.dateFound,
        color: formData.color.trim() || null,
        brand: formData.brand.trim() || null,
        security_question: formData.securityQuestion.trim(),
        images: uploadedImagePaths,
        status: 'active', // Maps to 'unclaimed' in display
        contact_method: 'chat',
      };

      console.log('[UploadItemPage] Item data prepared:', JSON.stringify(itemData, null, 2));
      const newItem = await db.items.create(itemData);
      console.log('[UploadItemPage] Item created successfully:', newItem);
      
      toast.dismiss('create');
      toast.success('Item uploaded successfully! 🎉');
      
      console.log('[UploadItemPage] Navigating to item page:', `/items/${newItem.id}`);
      // Redirect to item detail page
      navigate(`/items/${newItem.id}`, { 
        state: { justCreated: true } 
      });
      
    } catch (error) {
      console.error('[UploadItemPage] ====== ERROR ======');
      console.error('[UploadItemPage] Error creating item:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: error.status,
        stack: error.stack,
      });
      toast.dismiss('upload');
      toast.dismiss('create');
      
      // Rollback: Delete uploaded images if DB insert failed
      if (uploadedImagePaths.length > 0) {
        console.log('[UploadItemPage] Rolling back uploaded images...');
        for (const path of uploadedImagePaths) {
          try {
            // Extract path from URL
            const urlParts = path.split('/items/');
            if (urlParts[1]) {
              await storage.deleteImage('items', urlParts[1]);
            }
          } catch (rollbackError) {
            console.error('[UploadItemPage] Rollback error:', rollbackError);
          }
        }
      }
      
      // Show appropriate error message
      if (error.message?.includes('rate') || error.message?.includes('limit')) {
        toast.error('Daily upload limit reached. Please try again tomorrow.');
      } else if (error.message?.includes('duplicate')) {
        toast.error('This item may have already been uploaded.');
      } else if (error.message?.includes('timeout')) {
        toast.error('Upload timed out. Please try again.');
      } else {
        toast.error('Failed to upload item. Please try again.');
      }
    } finally {
      console.log('[UploadItemPage] ====== SUBMIT FINISHED ======');
      setSubmitting(false);
    }
  };

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.preview));
    };
  }, []);

  const steps = [
    { num: 1, title: 'Category', icon: Package },
    { num: 2, title: 'Details', icon: FileText },
    { num: 3, title: 'Location', icon: MapPin },
    { num: 4, title: 'Photos', icon: ImageIcon },
    { num: 5, title: 'Confirm', icon: Shield },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen py-8">
      <div className="container-app">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="page-title">Upload Found Item</h1>
            <p className="body-text mt-1">Help someone find their lost belongings by uploading details.</p>
          </div>

          {/* Progress Steps */}
          <div className="bg-white border border-surface-border rounded-xl px-4 py-3 mb-6">
            <div className="flex items-center">
              {steps.map((s, index) => {
                const StepIcon = s.icon;
                const isCompleted = step > s.num;
                const isCurrent = step === s.num;
                
                return (
                  <div key={s.num} className="flex items-center flex-1">
                    <button
                      onClick={() => goToStep(s.num)}
                      disabled={s.num > step}
                      className={`flex flex-col items-center transition-all ${
                        s.num <= step ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-primary-600 text-white'
                            : 'bg-surface-muted text-ink-subtle'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <StepIcon className="w-4 h-4" />
                        )}
                      </div>
                      <span
                        className={`mt-1 text-2xs font-semibold uppercase tracking-wide ${
                          isCurrent ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-ink-subtle'
                        }`}
                      >
                        {s.title}
                      </span>
                    </button>
                    
                    {index < steps.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 rounded ${
                          step > s.num ? 'bg-green-400' : 'bg-surface-border'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="section-card">
            
            {/* Step 1: Category Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="card-title mb-1">What type of item did you find?</h2>
                  <p className="body-text mb-4">Select the category that best describes the found item.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        formData.categoryId === cat.id
                          ? 'border-primary-600 bg-primary-50 ring-1 ring-primary-200'
                          : 'border-surface-border hover:border-primary-400 hover:bg-primary-50/30'
                      }`}
                    >
                      <span className="text-3xl block mb-2">{cat.icon}</span>
                      <span className="font-medium text-ink">{cat.name}</span>
                    </button>
                  ))}
                </div>

                {errors.categoryId && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.categoryId}
                  </p>
                )}
              </div>
            )}

            {/* Step 2: Product Details */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="card-title mb-1">Describe the item</h2>
                  <p className="body-text mb-4">Provide details that will help the owner identify their item.</p>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label className="label">Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className={`input ${errors.title ? 'input-error' : ''}`}
                    placeholder="e.g., Black Samsung Phone, Brown Leather Wallet"
                    maxLength={100}
                  />
                  {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
                  <p className="label-hint">{formData.title.length}/100 characters</p>
                </div>

                {/* Color */}
                <div className="form-group">
                  <label className="label">Color</label>
                  <input type="text" name="color" value={formData.color} onChange={handleInputChange}
                    className="input" placeholder="e.g., Black, Blue, Red" />
                </div>

                {/* Brand */}
                <div className="form-group">
                  <label className="label">Brand / Model <span className="text-ink-subtle text-xs">(optional)</span></label>
                  <input type="text" name="brand" value={formData.brand} onChange={handleInputChange}
                    className="input" placeholder="e.g., Samsung, Nike, Louis Vuitton" />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="label">Public Description</label>
                  <textarea
                    name="description" value={formData.description} onChange={handleInputChange}
                    rows={4}
                    className={`input ${errors.description ? 'input-error' : ''}`}
                    placeholder="Describe visible features, condition, etc. DO NOT include serial numbers."
                    maxLength={1000}
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                  <p className="label-hint">{formData.description.length}/1000</p>
                </div>

                {/* Security Question */}
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="block text-sm font-semibold text-amber-800 mb-1">
                        Verification Question <span className="text-red-500">*</span>
                      </label>
                      <p className="text-xs text-amber-700 mb-2">Ask something only the true owner would know.</p>
                      <input
                        type="text" name="securityQuestion" value={formData.securityQuestion}
                        onChange={handleInputChange}
                        className={`input border-amber-300 focus:ring-amber-500 ${
                          errors.securityQuestion ? 'border-red-400' : ''
                        }`}
                        placeholder="e.g., What is the phone's lock screen wallpaper?"
                      />
                      {errors.securityQuestion && <p className="text-red-500 text-xs mt-1">{errors.securityQuestion}</p>}
                    </div>
                  </div>
                </div>

                {/* Sensitive info warning */}
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Do NOT include:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-red-700">
                      <li>Serial numbers or IMEI</li>
                      <li>Full Aadhaar, PAN, or passport numbers</li>
                      <li>Personal addresses or phone numbers</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Location & Date */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="card-title mb-1">Where and when did you find it?</h2>
                  <p className="body-text mb-4">This helps owners narrow down their search.</p>
                </div>

                {/* Area */}
                <div className="form-group">
                  <label className="label">Area in Bangalore <span className="text-red-500">*</span></label>
                  <select
                    name="areaId" value={formData.areaId} onChange={handleInputChange}
                    className={`input ${errors.areaId ? 'input-error' : ''}`}
                  >
                    <option value="">Select an area</option>
                    {Object.entries(areasByZone).map(([zone, zoneAreas]) => (
                      <optgroup key={zone} label={`${zone} Bangalore`}>
                        {zoneAreas.map((area) => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {errors.areaId && <p className="text-red-500 text-xs mt-1">{errors.areaId}</p>}
                </div>

                {/* Location Details */}
                <div className="form-group">
                  <label className="label">Specific Location <span className="text-ink-subtle text-xs">(optional)</span></label>
                  <input type="text" name="locationDetails" value={formData.locationDetails}
                    onChange={handleInputChange} className="input"
                    placeholder="e.g., Near Forum Mall entrance, Coffee shop near metro" />
                  <p className="label-hint">Be helpful but avoid sharing exact addresses for safety.</p>
                </div>

                {/* Date Found */}
                <div className="form-group">
                  <label className="label">Date Found <span className="text-red-500">*</span></label>
                  <input type="date" name="dateFound" value={formData.dateFound}
                    onChange={handleInputChange} max={new Date().toISOString().split('T')[0]}
                    className={`input ${errors.dateFound ? 'input-error' : ''}`} />
                  {errors.dateFound && <p className="text-red-500 text-xs mt-1">{errors.dateFound}</p>}
                </div>

                <div className="flex items-start gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <Info className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-primary-800">Items automatically expire after 90 days if unclaimed.</p>
                </div>
              </div>
            )}

            {/* Step 4: Photo Upload */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="card-title mb-1">Add Photos</h2>
                  <p className="body-text mb-4">Clear photos help owners identify their items.</p>
                </div>

                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-primary-500 bg-primary-50'
                      : errors.images
                      ? 'border-red-300 bg-red-50'
                      : 'border-surface-border hover:border-primary-400 hover:bg-primary-50/30'
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className={`w-12 h-12 mx-auto mb-3 ${
                    isDragActive ? 'text-primary-500' : 'text-ink-subtle'
                  }`} />
                  <p className="body-text mb-1 font-medium">
                    {isDragActive ? 'Drop the files here…' : 'Drag & drop or click to select photos'}
                  </p>
                  <p className="caption">JPEG, PNG, WebP • Max 5MB each • Up to 5 images</p>
                </div>

                {errors.images && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />{errors.images}
                  </p>
                )}

                {/* Image Previews */}
                {images.length > 0 && (
                  <div>
                    <p className="label mb-3">Uploaded Images ({images.length}/5)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {images.map((img, index) => (
                        <div key={index} className="relative group">
                          <img src={img.preview} alt={`Upload ${index + 1}`}
                            className="w-full aspect-square object-cover rounded-xl border border-surface-border" />
                          {index === 0 && (
                            <span className="absolute top-2 left-2 badge badge-primary">Primary</span>
                          )}
                          <button type="button" onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-card">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-800">
                    <p className="font-semibold mb-1">Photo Tips</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Clear photos from multiple angles</li>
                      <li>Hide or blur any personal info on the item</li>
                      <li>First image will be the main display photo</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Confirmation */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="card-title mb-1">Review &amp; Confirm</h2>
                  <p className="body-text mb-4">Please review before submitting.</p>
                </div>

                {/* Summary Card */}
                <div className="border border-surface-border rounded-xl overflow-hidden">
                  {images[0] && (
                    <div className="relative h-48 bg-surface-muted">
                      <img src={images[0].preview} alt="Item preview" className="w-full h-full object-cover" />
                      <span className="absolute top-3 right-3 px-2 py-1 bg-white/90 rounded-lg text-xs font-medium shadow">
                        {images.length} photo{images.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  
                  <div className="p-4 space-y-4">
                    <div>
                      <h3 className="font-semibold text-ink text-lg">{formData.title}</h3>
                      <p className="caption">
                        {categories.find((c) => c.id === formData.categoryId)?.icon}{' '}
                        {categories.find((c) => c.id === formData.categoryId)?.name}
                      </p>
                    </div>

                    {(formData.color || formData.brand) && (
                      <div className="flex gap-4 text-sm">
                        {formData.color && <span><span className="text-ink-muted">Color:</span> <span className="font-medium">{formData.color}</span></span>}
                        {formData.brand && <span><span className="text-ink-muted">Brand:</span> <span className="font-medium">{formData.brand}</span></span>}
                      </div>
                    )}

                    <div className="pt-3 border-t border-surface-border space-y-2">
                      <div className="flex items-center gap-2 text-sm text-ink-muted">
                        <MapPin className="w-4 h-4" />
                        <span>{areas.find((a) => a.id === formData.areaId)?.name}{formData.locationDetails && ` • ${formData.locationDetails}`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-ink-muted">
                        <Calendar className="w-4 h-4" />
                        <span>Found on {new Date(formData.dateFound).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                    </div>

                    {formData.description && (
                      <div className="pt-3 border-t border-surface-border">
                        <p className="caption mb-1">Description</p>
                        <p className="body-text">{formData.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirmation Checkbox */}
                <div className="p-4 bg-surface-muted rounded-xl border border-surface-border">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox" checked={confirmed}
                      onChange={(e) => {
                        setConfirmed(e.target.checked);
                        if (errors.confirmed) setErrors((p) => ({ ...p, confirmed: null }));
                      }}
                      className="mt-1 w-5 h-5 rounded border-surface-border text-primary-600 focus:ring-primary-500"
                    />
                    <span className="body-text">
                      I confirm that these details are accurate and I am genuinely trying to return this item to its rightful owner.
                    </span>
                  </label>
                </div>

                {errors.confirmed && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />{errors.confirmed}
                  </p>
                )}

                <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-green-800">
                    <p className="font-semibold mb-1">What happens next?</p>
                    <ul className="space-y-0.5">
                      <li>• Your item goes live immediately</li>
                      <li>• Owners submit verified claims</li>
                      <li>• You approve the rightful owner</li>
                      <li>• Chat securely to arrange the return</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-8 pt-6 border-t border-surface-border">
              {step > 1 && (
                <button type="button" onClick={prevStep} disabled={submitting}
                  className="btn btn-secondary flex-1">
                  <ChevronLeft className="w-5 h-5" /> Back
                </button>
              )}

              {step < 5 ? (
                <button type="button" onClick={nextStep} className="btn btn-primary flex-1">
                  Continue <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button type="submit" disabled={submitting || !confirmed}
                  className="btn btn-primary flex-1">
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="w-5 h-5" /> Submit Item</>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* Help Text */}
          <p className="text-center caption mt-6">
            Need help? Contact us at{' '}
            <a href={`mailto:${contact_email}`} className="link">{contact_email}</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UploadItemPage;
