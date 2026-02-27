/**
 * Login Page â€” professional split layout
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { Shield, Lock, Users, CheckCircle, Eye, Fingerprint, BadgeCheck, Package } from 'lucide-react';

const GoogleLogo = () => (
  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const LoginPage = () => {
  const { signInWithGoogle, initializing, isAuthenticated } = useAuth();
  const { platform_name, contact_email } = useSettings();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleGoogleSignIn = async () => {
    if (isSigningIn || initializing) return;
    setIsSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError('Unable to sign in. Please try again.');
      setIsSigningIn(false);
    }
  };

  const features = [
    { icon: Shield,      title: 'Secure Claims',      desc: 'Prove ownership with verification questions â€” no sensitive info exposed.' },
    { icon: Eye,         title: 'Privacy Protected',  desc: 'Contact details stay hidden. Communicate safely through masked messaging.' },
    { icon: Users,       title: 'Community Verified', desc: 'Trust scores ensure reliable, honest interactions across the platform.' },
    { icon: Fingerprint, title: 'Ownership Verified', desc: 'Multi-step checks confirm you\'re the rightful owner before any handover.' },
  ];

  return (
    <div className="min-h-screen bg-surface flex">

      {/* â”€â”€ Left panel â€” navy brand â”€â”€ */}
      <div className="hidden lg:flex lg:w-[52%] bg-primary-900 flex-col justify-between p-12 xl:p-16">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">{platform_name || 'Find & Return'}</span>
        </div>

        {/* Headline */}
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Reuniting Bangalore's<br />
            <span className="text-primary-300">Lost &amp; Found.</span>
          </h1>
          <p className="text-primary-200 text-lg leading-relaxed mb-10">
            A trusted, privacy-first platform to help found items reach their rightful owners.
          </p>

          {/* Feature list */}
          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 items-start">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-primary-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-primary-300 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-8 pt-8 border-t border-white/10">
          {[['10K+', 'Items found'], ['8K+', 'Reunited'], ['15K+', 'Users'], ['4.8â˜…', 'Rating']].map(([val, lbl]) => (
            <div key={lbl}>
              <div className="text-xl font-bold text-white">{val}</div>
              <div className="text-xs text-primary-400 uppercase tracking-wide">{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Right panel â€” login â”€â”€ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-primary-900 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-ink text-lg">{platform_name || 'Find & Return'}</span>
          </div>

          <h2 className="text-2xl font-bold text-ink mb-1">Welcome back</h2>
          <p className="text-ink-muted text-sm mb-8">Sign in to continue to Find &amp; Return</p>

          {/* Error */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <span className="text-red-500 font-bold text-sm flex-shrink-0 mt-0.5">!</span>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Google sign-in */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn || initializing}
            className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white
                       border-2 border-surface-border rounded-xl font-semibold text-ink text-sm
                       hover:border-ink-subtle hover:shadow-card transition-all
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <span>Signing inâ€¦</span>
              </>
            ) : (
              <>
                <GoogleLogo />
                <span>Continue with Google</span>
              </>
            )}
          </button>

          {/* OAuth note */}
          <div className="mt-5 p-4 bg-primary-50 rounded-xl border border-primary-100 flex gap-3">
            <BadgeCheck className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-primary-900">Secure Google OAuth</p>
              <p className="text-xs text-primary-700 mt-0.5 leading-relaxed">
                We use Google OAuth 2.0. No passwords stored on our servers.
              </p>
            </div>
          </div>

          {/* Trust pills */}
          <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: Shield,      label: 'SSL Secured' },
              { icon: Lock,        label: 'Encrypted'   },
              { icon: CheckCircle, label: 'GDPR Ready'  },
            ].map(({ icon: Icon, label }) => (
              <span key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-surface-border
                           rounded-full text-xs font-medium text-ink-muted shadow-card">
                <Icon className="w-3.5 h-3.5 text-green-500" />
                {label}
              </span>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-ink-subtle leading-relaxed">
            By signing in you agree to our{' '}
            <a href="/terms" className="link">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="link">Privacy Policy</a>
          </p>

          <p className="mt-4 text-center text-sm text-ink-muted">
            Need help?{' '}
            <a href={`mailto:${contact_email}`} className="link">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
