/**
 * Login Page
 * Modern, trust-oriented Google OAuth authentication
 * Designed to convey security, reliability, and professionalism
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Shield, 
  Lock, 
  Users, 
  CheckCircle, 
  Eye, 
  MessageSquare,
  Fingerprint,
  BadgeCheck,
  MapPin,
  Sparkles
} from 'lucide-react';

// Google Logo SVG Component
const GoogleLogo = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Trust Badge Component
const TrustBadge = ({ icon: Icon, label, color = 'emerald' }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm border border-gray-100">
    <Icon className={`w-4 h-4 text-${color}-500`} />
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </div>
);

// Feature Card Component
const FeatureCard = ({ icon: Icon, title, description, delay = 0 }) => (
  <div 
    className="group flex items-start gap-4 p-5 bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-white transition-all duration-300"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:scale-110 transition-transform duration-300">
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  </div>
);

// Stats Counter Component
const StatCounter = ({ value, label }) => (
  <div className="text-center">
    <div className="text-2xl font-bold text-primary-600">{value}</div>
    <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
  </div>
);

const LoginPage = () => {
  const { signInWithGoogle, initializing, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || initializing) return; // Prevent double-click
    
    setIsSigningIn(true);
    setError(null);
    
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
      setError('Unable to sign in. Please try again.');
      setIsSigningIn(false);
    }
  };

  const features = [
    {
      icon: Shield,
      title: 'Secure Claims Process',
      description: 'Prove ownership with security questions—no sensitive details exposed until verified.',
    },
    {
      icon: Eye,
      title: 'Privacy Protected',
      description: 'Your contact info stays hidden. Communicate safely through our masked messaging.',
    },
    {
      icon: Users,
      title: 'Community Verified',
      description: 'Trust scores and verification badges ensure reliable, honest interactions.',
    },
    {
      icon: Fingerprint,
      title: 'Ownership Verification',
      description: 'Multi-step verification confirms you\'re the rightful owner before handover.',
    },
  ];

  const isButtonDisabled = isSigningIn || initializing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-primary-50/40 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl" />
      </div>

      <div className="relative min-h-screen flex">
        {/* Left Section - Branding & Features */}
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] flex-col justify-center px-12 xl:px-20">
          <div className="max-w-xl">
            {/* Logo & Branding */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <MapPin className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Lost & Found
                  </h1>
                  <p className="text-primary-600 font-semibold">Bangalore</p>
                </div>
              </div>
              
              <p className="text-xl text-gray-600 leading-relaxed mb-4">
                The trusted platform to reunite lost belongings with their rightful owners across Bangalore.
              </p>
              
              <p className="text-gray-500">
                Secure. Private. Community-driven.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid gap-4 mb-10">
              {features.map((feature, index) => (
                <FeatureCard 
                  key={index}
                  {...feature}
                  delay={index * 100}
                />
              ))}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8 p-6 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-100">
              <StatCounter value="10K+" label="Items Found" />
              <div className="w-px h-12 bg-gray-200" />
              <StatCounter value="8K+" label="Reunited" />
              <div className="w-px h-12 bg-gray-200" />
              <StatCounter value="15K+" label="Users" />
              <div className="w-px h-12 bg-gray-200" />
              <StatCounter value="4.8★" label="Rating" />
            </div>
          </div>
        </div>

        {/* Right Section - Login Card */}
        <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
                  <p className="text-primary-600 font-medium text-sm">Bangalore</p>
                </div>
              </div>
            </div>

            {/* Login Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
              {/* Card Header */}
              <div className="px-8 pt-10 pb-6 text-center bg-gradient-to-b from-gray-50/80 to-white">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-50 rounded-2xl mb-5">
                  <Lock className="w-8 h-8 text-primary-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Welcome Back
                </h2>
                <p className="text-gray-500">
                  Sign in securely to continue
                </p>
              </div>

              {/* Card Body */}
              <div className="px-8 pb-8">
                {/* Error Message */}
                {error && (
                  <div 
                    className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3"
                    role="alert"
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                      <span className="text-red-600 text-xs font-bold">!</span>
                    </div>
                    <div>
                      <p className="text-sm text-red-700 font-medium">{error}</p>
                      <p className="text-xs text-red-500 mt-1">Please check your connection and try again.</p>
                    </div>
                  </div>
                )}

                {/* Google Sign In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isButtonDisabled}
                  className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  aria-label="Sign in with Google"
                >
                  {isSigningIn ? (
                    <>
                      <svg 
                        className="animate-spin h-5 w-5 text-primary-600" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <GoogleLogo />
                      <span>Continue with Google</span>
                      <Sparkles className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </>
                  )}
                </button>

                {/* Why Google Sign In */}
                <div className="mt-6 p-4 bg-blue-50/70 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <BadgeCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Secure Google Authentication</p>
                      <p className="text-xs text-blue-700 mt-1">
                        We use Google's secure OAuth to protect your account. No passwords stored on our servers.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <p className="mt-6 text-center text-xs text-gray-500 leading-relaxed">
                  By signing in, you agree to our{' '}
                  <a 
                    href="/terms" 
                    className="text-primary-600 hover:text-primary-700 underline underline-offset-2 font-medium"
                  >
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a 
                    href="/privacy" 
                    className="text-primary-600 hover:text-primary-700 underline underline-offset-2 font-medium"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <TrustBadge icon={Shield} label="SSL Secured" />
              <TrustBadge icon={Lock} label="Encrypted" />
              <TrustBadge icon={CheckCircle} label="GDPR Ready" />
            </div>

            {/* Help Text */}
            <p className="mt-6 text-center text-sm text-gray-500">
              Having trouble?{' '}
              <a 
                href="mailto:support@lostfound.bangalore" 
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Contact Support
              </a>
            </p>

            {/* Mobile Features */}
            <div className="lg:hidden mt-10 space-y-3">
              {features.slice(0, 2).map((feature, index) => (
                <FeatureCard key={index} {...feature} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
