/**
 * IMAGE UPLOAD VERIFICATION PAGE
 * 
 * This page provides a UI to test the complete image upload flow:
 * 1. Verify user is logged in
 * 2. Upload a dummy image to Supabase Storage
 * 3. Create a test item with the image
 * 4. Verify image appears on homepage and item detail page
 * 
 * Access at: http://localhost:5173/test-image-upload
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { runFullImageUploadTest } from '../lib/imageUploadTest';
import { AlertCircle, CheckCircle, Loader2, Copy, ExternalLink } from 'lucide-react';

const ImageUploadTestPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setError('You must be logged in to run this test. Please sign in first.');
    }
  }, [user, authLoading]);

  const handleRunTest = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    setTesting(true);
    setError(null);
    setResults(null);

    try {
      const testResults = await runFullImageUploadTest(user.id);
      setResults(testResults);
    } catch (err) {
      setError(`Test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Header */}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Image Upload Test
          </h1>
          <p className="text-gray-600 mb-6">
            Verify that image uploads work correctly to Supabase Storage and database
          </p>

          {/* Auth Check */}
          {!user ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900">Not Logged In</h3>
                <p className="text-sm text-red-800 mt-1">
                  You must be logged in to run this test. Please sign in first.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* User Info */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Logged in as:</strong> {user.email || 'Unknown'}
                </p>
                <p className="text-sm text-blue-900">
                  <strong>User ID:</strong> {user.id}
                </p>
              </div>

              {/* Test Description */}
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">What This Test Does:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">1.</span>
                    <span>Creates a 1x1 PNG dummy image in memory</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">2.</span>
                    <span>Uploads it to Supabase Storage bucket "item-images"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">3.</span>
                    <span>Verifies the file is stored with correct path format</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">4.</span>
                    <span>Generates and tests the public URL</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">5.</span>
                    <span>Creates a test item in the database</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600 font-bold">6.</span>
                    <span>Links the image to the item in item_images table</span>
                  </li>
                </ul>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900">Test Failed</h3>
                    <p className="text-sm text-red-800 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Success Results */}
              {results && (
                <div className="mb-6 space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-green-900">All Tests Passed! ✅</h3>
                      <p className="text-sm text-green-800 mt-1">
                        Image upload flow is working correctly
                      </p>
                    </div>
                  </div>

                  {/* Upload Details */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Upload Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">Bucket:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                          {results.upload.bucket}
                        </code>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">File Size:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                          {results.upload.fileSize} bytes
                        </code>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">Storage Path:</span>
                        <div className="flex items-center gap-1">
                          <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs break-all">
                            {results.upload.storagePath}
                          </code>
                          <button
                            onClick={() => copyToClipboard(results.upload.storagePath)}
                            className="text-primary-600 hover:text-primary-700"
                            title="Copy to clipboard"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Item Details</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">Item ID:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                          {results.item.itemId}
                        </code>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">Title:</span>
                        <span className="text-gray-900 font-medium">
                          {results.item.itemTitle}
                        </span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-gray-600">Images Linked:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                          {results.item.imagesCount}
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* View Item Link */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      View the test item on the website:
                    </p>
                    <a
                      href={`/items/${results.item.itemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <span>Item Detail Page</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Run Test Button */}
              <button
                onClick={handleRunTest}
                disabled={testing || !user}
                className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                  testing || !user
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  'Run Image Upload Test'
                )}
              </button>
            </>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This is a diagnostic tool for testing image uploads.
              <br />
              Access this page at: <code className="font-mono">http://localhost:5173/test-image-upload</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageUploadTestPage;
