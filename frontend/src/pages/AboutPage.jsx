/**
 * About Page
 * Premium SaaS-style about page — matches Homepage design system
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Github, Mail, Shield, Heart, Code, Zap,
  UserCheck, Lock, CheckCircle2, Package, Search, RotateCcw,
  Users, TrendingUp,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/* ─── Static data ─────────────────────────────────────────── */

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: <Package className="w-6 h-6 text-blue-600" />,
    title: 'Report Lost or Found Item',
    desc: 'Users report lost or found items with descriptions, images, and locations.',
  },
  {
    step: '02',
    icon: <Search className="w-6 h-6 text-blue-600" />,
    title: 'Smart Matching',
    desc: 'Potential matches are identified using item descriptions and locations.',
  },
  {
    step: '03',
    icon: <CheckCircle2 className="w-6 h-6 text-blue-600" />,
    title: 'Secure Claim Process',
    desc: 'Ownership verification ensures items are returned to rightful owners.',
  },
];

// STATS are now fetched live — see usePlatformStats hook below

const VALUES = [
  { icon: <Heart className="w-5 h-5 text-blue-600" />,     title: 'Community First',    desc: 'Helping people support each other and build trust.' },
  { icon: <Shield className="w-5 h-5 text-blue-600" />,    title: 'Trust & Security',   desc: 'Verification ensures rightful ownership every time.' },
  { icon: <Code className="w-5 h-5 text-blue-600" />,      title: 'Modern Technology',  desc: 'Built using modern, scalable, production-grade tech.' },
  { icon: <Zap className="w-5 h-5 text-blue-600" />,       title: 'Fast Recovery',      desc: 'Helping users recover their belongings quickly.' },
  { icon: <UserCheck className="w-5 h-5 text-blue-600" />, title: 'Verified Users',     desc: 'User verification increases community trust.' },
  { icon: <Lock className="w-5 h-5 text-blue-600" />,      title: 'Privacy Focused',    desc: 'User data is securely protected at all times.' },
];

const TECH = ['React', 'Vite', 'Tailwind CSS', 'Supabase', 'Node.js', 'Express', 'PostgreSQL', 'Lucide Icons'];

const TRUST_POINTS = [
  'Verified ownership claims',
  'Secure end-to-end messaging system',
  'User trust scoring system',
  'Data protection & privacy',
  'Community-driven verification',
];

/* ─── Live platform stats hook ───────────────────────────── */

function usePlatformStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const [
          { count: totalItems },
          { count: returnedItems },
          { count: activeUsers },
          { count: approvedClaims },
        ] = await Promise.all([
          supabase.from('items').select('*', { count: 'exact', head: true }).neq('status', 'removed'),
          supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'returned'),
          supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
          supabase.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        ]);

        if (cancelled) return;

        const reported  = totalItems   ?? 0;
        const returned  = returnedItems ?? 0;
        const users     = activeUsers   ?? 0;
        const approved  = approvedClaims ?? 0;
        const rate      = reported > 0 ? Math.round((returned / reported) * 100) : 0;

        setStats([
          { value: reported >= 1000 ? `${(reported / 1000).toFixed(1)}k+` : `${reported}+`, label: 'Items Reported' },
          { value: returned >= 1000 ? `${(returned / 1000).toFixed(1)}k+` : `${returned}+`, label: 'Items Returned' },
          { value: users >= 1000    ? `${(users    / 1000).toFixed(1)}k+` : `${users}+`,    label: 'Active Users'   },
          { value: `${rate}%`,                                                                label: 'Success Rate'   },
        ]);
      } catch (err) {
        console.error('[AboutPage] Stats fetch error:', err);
        // Fallback to placeholder dashes on error
        if (!cancelled) setStats([
          { value: '—', label: 'Items Reported' },
          { value: '—', label: 'Items Returned' },
          { value: '—', label: 'Active Users'   },
          { value: '—', label: 'Success Rate'   },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}

/* ─── Component ───────────────────────────────────────────── */

const AboutPage = () => {
  const { stats: platformStats, loading: statsLoading } = usePlatformStats();

  return (
    <div className="bg-slate-50 min-h-screen">

      {/* ── Back nav ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-app py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
      >
        {/* Decorative layer — matches homepage exactly */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle, #60a5fa, transparent 70%)' }} />
          <div className="absolute bottom-0 left-1/3 w-[360px] h-[360px] rounded-full opacity-10"
               style={{ background: 'radial-gradient(circle, #818cf8, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
               style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative container-app py-16 md:py-20 max-w-5xl">
          <p className="text-xs font-bold tracking-[0.2em] text-blue-300 uppercase mb-4">
            About the Platform
          </p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white">
            About Find&amp;Return
          </h1>
          <p className="text-lg text-blue-100 mt-2 max-w-xl leading-relaxed">
            A Trust-Based Platform For Reuniting Lost Items With Their Owners
          </p>
          <p className="text-blue-200 mt-3 max-w-2xl leading-relaxed">
            Find&amp;Return is a secure and community-driven platform designed to help people recover
            lost belongings quickly and safely. Our system focuses on trust, verification, and
            collaboration.
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 mt-8">
            {['Verified Claims', 'Secure Messaging', 'Community Trusted', 'Privacy Protected'].map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full
                           bg-white/10 border border-white/15 text-blue-100 text-sm font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          2. FOUNDER
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-100">
        <div className="container-app py-16 px-6 max-w-5xl">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-10">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <img
                src="/founder.jpg"
                alt="Sudharshan S"
                className="w-36 h-36 rounded-full border-4 border-white shadow-lg object-cover bg-slate-100"
              />
            </div>

            {/* Content */}
            <div className="text-center md:text-left">
              <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-2">
                Meet the Founder
              </p>
              <h2 className="text-2xl font-bold text-slate-900">Sudharshan S</h2>
              <p className="text-blue-600 font-medium mt-1">Founder &amp; Developer</p>
              <p className="text-slate-600 mt-4 leading-relaxed max-w-xl">
                I created Find&amp;Return to solve a real-world problem — people losing valuable
                belongings without a reliable way to recover them.
              </p>
              <p className="text-slate-600 mt-3 leading-relaxed max-w-xl">
                This platform focuses on trust, secure communication, and ownership verification
                to ensure items are safely returned to their rightful owners.
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                <a
                  href="https://github.com/sudharshan128"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white
                             rounded-lg hover:bg-slate-800 transition-all duration-200 text-sm font-semibold shadow-sm"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="mailto:sudharshan@example.com"
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200
                             rounded-lg hover:bg-slate-50 transition-all duration-200 text-sm font-semibold text-slate-700"
                >
                  <Mail className="w-4 h-4" />
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          3. MISSION
      ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="container-app py-16 px-6 max-w-3xl text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-3">
            Our Purpose
          </p>
          <h2 className="text-2xl font-bold text-slate-900">Our Mission</h2>
          <p className="text-slate-600 mt-4 leading-relaxed">
            Our mission is to create a trusted ecosystem where lost items can be returned to their
            rightful owners safely and efficiently. By combining modern technology with community
            collaboration, we aim to make lost item recovery simple, fast, and reliable.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          4. HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-100">
        <div className="container-app py-16 px-6 max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-3">
              The Process
            </p>
            <h2 className="text-2xl font-bold text-slate-900">How Find&amp;Return Works</h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connector line */}
            <div className="hidden md:block absolute top-10 left-[calc(16.666%+1.5rem)] right-[calc(16.666%+1.5rem)]
                            h-px border-t-2 border-dashed border-blue-100" />
            {HOW_IT_WORKS.map(({ step, icon, title, desc }) => (
              <div
                key={step}
                className="relative flex flex-col items-center text-center bg-white border border-slate-100
                           rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="relative z-10 w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100
                                flex items-center justify-center mb-4 shadow-sm">
                  {icon}
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white
                                   text-xs font-bold flex items-center justify-center shadow">
                    {step}
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          5. PLATFORM STATISTICS
      ══════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #1d4ed8 100%)' }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
             style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative container-app py-16 px-6 max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-300 uppercase mb-3">
              By the Numbers
            </p>
            <h2 className="text-2xl font-bold text-white">Platform Statistics</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {statsLoading
              ? /* skeleton */
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white/10 border border-white/15 rounded-xl p-6 text-center animate-pulse">
                    <div className="h-9 w-20 bg-white/20 rounded-lg mx-auto mb-3" />
                    <div className="h-4 w-24 bg-white/10 rounded mx-auto" />
                  </div>
                ))
              : (platformStats ?? []).map(({ value, label }) => (
                  <div
                    key={label}
                    className="bg-white/10 border border-white/15 rounded-xl p-6 text-center
                               hover:bg-white/15 transition-all duration-200"
                  >
                    <p className="text-3xl font-black text-white">{value}</p>
                    <p className="text-blue-200 mt-2 text-sm font-medium">{label}</p>
                  </div>
                ))
            }
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          6. CORE VALUES
      ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="container-app py-16 px-6 max-w-5xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-3">
              What We Stand For
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Core Values</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {VALUES.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm
                           hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              >
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          7. TECHNOLOGY
      ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-100">
        <div className="container-app py-16 px-6 max-w-4xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-3">
              Engineering Stack
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Built With</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TECH.map((name) => (
              <div
                key={name}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
                           text-center font-medium text-slate-700 text-sm
                           hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700
                           transition-all duration-200"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          8. TRUST
      ══════════════════════════════════════════════════════ */}
      <section className="bg-slate-50">
        <div className="container-app py-16 px-6 max-w-3xl">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase mb-3">
              Built for Confidence
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Why Trust Find&amp;Return</h2>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-8">
            <ul className="space-y-4">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-center gap-3 text-slate-700">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-50 border border-blue-100
                                   flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  </span>
                  <span className="font-medium">{point}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <div className="mt-8 pt-8 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm mb-4">Ready to get started?</p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-7 py-3 bg-blue-600 text-white font-bold
                           rounded-xl shadow-sm hover:bg-blue-700 hover:shadow-md transition-all duration-200
                           hover:-translate-y-0.5"
              >
                <RotateCcw className="w-4 h-4" />
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default AboutPage;
