/**
 * Report Found Item Page
 * Form to report a found item
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, storage } from '../lib/supabase';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { 
  Upload, 
  X, 
  MapPin, 
  Calendar, 
  Image, 
  AlertCircle,
  Check,
  ChevronRight
} from 'lucide-react';

const ReportFoundPage = () => {
  const navigate = useNavigate();
  const { user, profile, initializing } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [areas, setAreas] = useState([]);
  const [images, setImages] = useState([]);
  const [dataError, setDataError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    categoryId: '',
    areaId: '',
    locationDetails: '',
    foundDate: new Date().toISOString().split('T')[0],
    verificationQuestion1: '',
    verificationQuestion2: '',
    verificationQuestion3: '',
  });

  // Load categories and areas
  useEffect(() => {
    // Wait for auth to initialize
    if (initializing) return;

    let isMounted = true;

    const loadData = async () => {
      try {
        setInitialLoading(true);
        setDataError(null);
        
        const [cats, areasData] = await Promise.all([
          db.categories.getAll(),
          db.areas.getAll(),
        ]);
        
        if (isMounted) {
          setCategories(cats || []);
          setAreas(areasData || []);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        if (isMounted) {
          setDataError(error.message || 'Failed to load form data');
          toast.error('Failed to load form data');
        }
      } finally {
        if (isMounted) {
          setInitialLoading(false);
        }
      }
    };
    
    loadData();

    return () => {
      isMounted = false;
    };
  }, [initializing]);

  // Group areas by zone
  const areasByZone = areas.reduce((acc, area) => {
    if (!acc[area.zone]) acc[area.zone] = [];
    acc[area.zone].push(area);
    return acc;
  }, {});

  // Dropzone
  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...newFiles].slice(0, 5));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    maxFiles: 5,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: (rejections) => {
      const error = rejections[0]?.errors[0];
      if (error?.code === 'file-too-large') {
        toast.error('File is too large. Max size is 5MB.');
      } else if (error?.code === 'too-many-files') {
        toast.error('Maximum 5 images allowed.');
      }
    },
  });

  const removeImage = (index) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateStep = (stepNum) => {
    switch (stepNum) {
      case 1:
        if (!formData.title.trim()) {
          toast.error('Please enter a title');
          return false;
        }
        if (!formData.categoryId) {
          toast.error('Please select a category');
          return false;
        }
        return true;
      case 2:
        if (!formData.areaId) {
          toast.error('Please select an area');
          return false;
        }
        if (!formData.foundDate) {
          toast.error('Please select the date found');
          return false;
        }
        return true;
      case 3:
        if (images.length === 0) {
          toast.error('Please upload at least one image');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 4));
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      // Upload images
      const uploadedImages = [];
      for (let i = 0; i < images.length; i++) {
        const { path, publicUrl } = await storage.uploadItemImage(images[i].file, user.id);
        uploadedImages.push({
          storage_bucket: 'item-images',
          storage_path: path,
          image_url: publicUrl,
          is_primary: i === 0,
        });
      }

      // Create item
      const item = await db.items.create({
        finder_id: user.id,
        title: formData.title,
        description: formData.description,
        category_id: formData.categoryId,
        area_id: formData.areaId,
        location_details: formData.locationDetails,
        date_found: formData.foundDate,
        security_question: formData.verificationQuestion1 || 'What color was the item?',
        status: 'active',
      });

      console.log('[ReportFoundPage] Item created:', item.id);

      // Create image records
      for (let i = 0; i < uploadedImages.length; i++) {
        const img = uploadedImages[i];
        console.log('[ReportFoundPage] Creating image record:', i + 1, 'of', uploadedImages.length, img);
        try {
          const createdImage = await db.itemImages.create({
            item_id: item.id,
            ...img,
          });
          console.log('[ReportFoundPage] Image record created:', createdImage.id);
        } catch (imgError) {
          console.error('[ReportFoundPage] Error creating image record:', imgError);
          throw imgError;
        }
      }

      toast.success('Item reported successfully!');
      navigate(`/items/${item.id}`);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to report item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, title: 'Basic Info' },
    { num: 2, title: 'Location' },
    { num: 3, title: 'Photos' },
    { num: 4, title: 'Review' },
  ];

  // Show loading state while auth or data is loading
  if (initializing || initialLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (dataError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="card text-center py-12">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load form data</h2>
            <p className="text-gray-600 mb-4">{dataError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Found Item</h1>
        <p className="text-gray-600 mb-8">Help someone find their lost belongings</p>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, index) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                  step >= s.num
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step > s.num ? <Check className="w-5 h-5" /> : s.num}
              </div>
              <span
                className={`ml-2 hidden sm:block text-sm ${
                  step >= s.num ? 'text-gray-900 font-medium' : 'text-gray-500'
                }`}
              >
                {s.title}
              </span>
              {index < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-gray-300 mx-2 hidden sm:block" />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">What did you find?</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="e.g., Black leather wallet"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, categoryId: cat.id }))}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        formData.categoryId === cat.id
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <span className="block text-sm mt-1">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="input w-full"
                  placeholder="Describe the item in detail (color, size, brand, etc.)"
                />
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Where did you find it?</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area <span className="text-red-500">*</span>
                </label>
                <select
                  name="areaId"
                  value={formData.areaId}
                  onChange={handleInputChange}
                  className="input w-full"
                  required
                >
                  <option value="">Select area</option>
                  {Object.entries(areasByZone).map(([zone, zoneAreas]) => (
                    <optgroup key={zone} label={zone}>
                      {zoneAreas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specific Location Details
                </label>
                <input
                  type="text"
                  name="locationDetails"
                  value={formData.locationDetails}
                  onChange={handleInputChange}
                  className="input w-full"
                  placeholder="e.g., Near Forum Mall entrance, Bus stop bench"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be specific but don't share exact addresses for safety
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date Found <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="foundDate"
                  value={formData.foundDate}
                  onChange={handleInputChange}
                  max={new Date().toISOString().split('T')[0]}
                  className="input w-full"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Photos</h2>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag & drop images here, or click to select'}
                </p>
                <p className="text-sm text-gray-500">Max 5 images, 5MB each</p>
              </div>

              {/* Preview */}
              {images.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Uploaded ({images.length}/5)
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.preview}
                          alt={`Upload ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg"
                        />
                        {index === 0 && (
                          <span className="absolute top-2 left-2 px-2 py-1 bg-primary-600 text-white text-xs rounded">
                            Primary
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-yellow-50 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Photo Tips</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Take clear photos from multiple angles</li>
                    <li>Hide any personal information visible on the item</li>
                    <li>First image will be the main display image</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Your Submission</h2>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  {images[0] && (
                    <img
                      src={images[0].preview}
                      alt="Item"
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{formData.title}</h3>
                    <p className="text-sm text-gray-600">
                      {categories.find((c) => c.id === formData.categoryId)?.name}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {areas.find((a) => a.id === formData.areaId)?.name}
                      {formData.locationDetails && ` • ${formData.locationDetails}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Found on {formData.foundDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Image className="w-4 h-4" />
                    <span>{images.length} photo(s)</span>
                  </div>
                </div>

                {formData.description && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-500 mb-1">Description</p>
                    <p className="text-gray-700">{formData.description}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-green-50 rounded-lg flex gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-medium">Ready to submit!</p>
                  <p>Your item will be visible to people searching for lost items.</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8 pt-6 border-t">
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="btn btn-secondary flex-1"
                disabled={loading}
              >
                Back
              </button>
            )}
            
            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary flex-1"
              >
                Continue
              </button>
            ) : (
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
                  'Submit Item'
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportFoundPage;
