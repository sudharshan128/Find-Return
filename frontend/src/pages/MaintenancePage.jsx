import { Wrench, Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

const MaintenancePage = () => {
  const [message, setMessage] = useState('We are currently performing maintenance. Please check back soon.');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Try to get custom maintenance message from sessionStorage
    const customMessage = sessionStorage.getItem('maintenanceMessage');
    if (customMessage) {
      setMessage(customMessage);
    }
  }, []);

  const handleRetry = () => {
    // Clear the maintenance flag and reload
    sessionStorage.removeItem('maintenanceMessage');
    window.location.href = '/';
  };

  return (
    <div className="bg-surface min-h-screen flex items-center justify-center p-4">
      <div className={`max-w-md w-full section-card text-center transform transition-all duration-500 ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full mb-4 shadow-lg">
            <Wrench className="h-10 w-10 text-white animate-bounce" />
          </div>
          <h1 className="page-title mb-2">
            Under Maintenance
          </h1>
          <div className="h-1 w-20 bg-primary-600 mx-auto mb-4 rounded-full"></div>
          <p className="body-text text-lg mb-6 leading-relaxed">
            {message}
          </p>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm text-amber-800 font-medium">Service Temporarily Unavailable</p>
              <p className="text-xs text-amber-700 mt-1">Our team is working to restore service as quickly as possible.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 caption mb-6">
          <Clock className="h-4 w-4" />
          <span>Estimated time: 15-30 minutes</span>
        </div>

        <button
          onClick={handleRetry}
          className="btn btn-primary w-full py-3"
        >
          Check Again
        </button>
        
        <div className="mt-6 pt-6 border-t border-surface-border">
          <p className="caption">
            For urgent matters, please contact{' '}
            <a href={`mailto:${contact_email}`} className="link font-medium">
              {contact_email}
            </a>
          </p>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
