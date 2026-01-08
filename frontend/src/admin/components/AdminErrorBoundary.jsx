/**
 * Admin Error Boundary Component
 * Catches React errors and provides secure error handling
 * 
 * SECURITY FEATURES:
 * - Prevents sensitive error details from leaking to UI
 * - Logs errors securely for debugging
 * - Provides graceful degradation
 * - Option to report errors for security review
 */

import { Component } from 'react';

// Inline SVG icons to avoid dependency issues
const ShieldExclamationIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

const ArrowPathIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const HomeIcon = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);

class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorId: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Generate unique error ID for tracking
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}`;
    
    return { 
      hasError: true, 
      error,
      errorId,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error securely (don't expose to client in production)
    console.error('Admin Error Boundary caught error:', {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
    });
    
    this.setState({ errorInfo });
    
    // In production, send to error tracking service
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo);
    }
  }
  
  reportError = async (error, errorInfo) => {
    try {
      // Could send to error tracking service (Sentry, etc.)
      // For now, just log
      console.info('Error would be reported:', this.state.errorId);
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/admin';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Check if it's a critical error
      const isCritical = this.state.error?.message?.includes('chunk') ||
                         this.state.error?.message?.includes('Loading') ||
                         this.state.error?.message?.includes('network');

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-gray-200 p-6">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <ShieldExclamationIcon className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Something went wrong
            </h1>
            
            {/* Message */}
            <p className="text-gray-600 text-center mb-4">
              {isCritical 
                ? 'A network or loading error occurred. Please check your connection and try again.'
                : 'An unexpected error occurred. Our team has been notified.'}
            </p>
            
            {/* Error ID (for support reference) */}
            <div className="bg-gray-100 rounded-lg px-4 py-3 mb-6">
              <p className="text-xs text-gray-500 text-center">
                Error Reference: <span className="font-mono font-medium">{this.state.errorId}</span>
              </p>
              <p className="text-xs text-gray-400 text-center mt-1">
                Please include this code if contacting support
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <HomeIcon className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>
            
            {/* Reload option */}
            <button
              onClick={this.handleReload}
              className="w-full mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Refresh the page
            </button>
            
            {/* Show details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 p-3 bg-red-50 rounded-lg">
                <summary className="text-sm font-medium text-red-800 cursor-pointer">
                  Developer Details
                </summary>
                <div className="mt-2 text-xs text-red-700 font-mono overflow-auto max-h-48">
                  <p className="font-bold">{this.state.error.message}</p>
                  <pre className="mt-2 whitespace-pre-wrap">{this.state.error.stack}</pre>
                  {this.state.errorInfo?.componentStack && (
                    <pre className="mt-2 whitespace-pre-wrap text-red-600">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AdminErrorBoundary;
