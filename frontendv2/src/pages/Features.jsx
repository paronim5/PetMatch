import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  {
    icon: '🐾',
    title: 'Pet-Powered Matching',
    desc: 'Swipe through profiles of people who share your love for animals. Our algorithm considers your pet type, breed, and lifestyle to surface the most compatible matches.',
    tag: 'Core',
    accent: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/20',
    tagColor: 'bg-rose-500/20 text-rose-300',
  },
  {
    icon: '💬',
    title: 'Real-Time Chat',
    desc: 'Connect instantly with your matches via WebSocket-powered messaging. Send text, share pet photos, and never miss a message with live read receipts.',
    tag: 'Social',
    accent: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-500/20',
    tagColor: 'bg-orange-500/20 text-orange-300',
  },
  {
    icon: '📍',
    title: 'Location-Based Discovery',
    desc: 'Find pet lovers near you with PostGIS-powered geospatial queries. Set your preferred distance radius and discover matches in your city or neighbourhood.',
    tag: 'Discovery',
    accent: 'from-pink-500/20 to-pink-500/5',
    border: 'border-pink-500/20',
    tagColor: 'bg-pink-500/20 text-pink-300',
  },
  {
    icon: '🤖',
    title: 'AI Photo Validation',
    desc: 'Every profile photo is automatically scanned by our TensorFlow model to confirm it contains a pet. This ensures authentic profiles and a trustworthy community.',
    tag: 'AI',
    accent: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-500/20',
    tagColor: 'bg-violet-500/20 text-violet-300',
  },
  {
    icon: '🔔',
    title: 'Live Notifications',
    desc: "Get real-time push notifications for new matches, incoming messages, and profile likes — delivered via WebSocket with automatic reconnect and polling fallback.",
    tag: 'Real-Time',
    accent: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-500/20',
    tagColor: 'bg-sky-500/20 text-sky-300',
  },
  {
    icon: '⭐',
    title: 'Premium Subscription',
    desc: 'Unlock unlimited swipes, see who liked you, rewind your last swipe, and activate a Boost to appear at the top of everyone\'s feed — powered by Stripe.',
    tag: 'Premium',
    accent: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-500/20',
    tagColor: 'bg-amber-500/20 text-amber-300',
  },
  {
    icon: '🔒',
    title: 'Safe & Secure',
    desc: 'JWT authentication, Google OAuth, rate limiting on every endpoint, and the ability to block users — keeping the community safe and your data protected.',
    tag: 'Security',
    accent: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-500/20',
    tagColor: 'bg-emerald-500/20 text-emerald-300',
  },
  {
    icon: '🎯',
    title: 'Match Preferences',
    desc: 'Filter by pet type (cats, dogs, rabbits…), pet age range, and maximum distance. The more specific your preferences, the better your matches.',
    tag: 'Customisation',
    accent: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/20',
    tagColor: 'bg-rose-500/20 text-rose-300',
  },
];

const Features = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState(null);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => { window.location.href = '/'; }}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="text-lg font-black">
            Pet<span className="text-rose-400">Match</span>
          </span>
          <div className="w-16" />
        </div>
      </div>

      <div className="pt-24 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              What We Offer
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Everything You{' '}
              <span className="bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
                Need
              </span>
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              PetMatch combines the fun of swiping with the depth of real pet compatibility — here's what makes it special.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`bg-gradient-to-b ${f.accent} border ${f.border} rounded-3xl p-8 cursor-pointer hover:-translate-y-1 transition-all duration-300 ${active === i ? 'ring-2 ring-white/20' : ''}`}
                onClick={() => setActive(active === i ? null : i)}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">{f.icon}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${f.tagColor}`}>{f.tag}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 bg-gradient-to-r from-rose-600 to-orange-500 rounded-3xl p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Ready to find your match?</h2>
            <p className="text-white/80 mb-6">Join thousands of pet lovers already on PetMatch.</p>
            <button
              onClick={() => navigate('/signup')}
              className="px-8 py-3.5 bg-white text-rose-600 rounded-2xl font-black hover:scale-105 transition-transform shadow-xl"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Features;
