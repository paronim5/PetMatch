import React from 'react';
import { useNavigate } from 'react-router-dom';

const GOALS = [
  {
    icon: '🐾',
    title: 'Connect People Through Pets',
    desc: 'Pets say a lot about who you are. PetMatch uses your pets — their type, breed, age, and personality — as the foundation for finding genuinely compatible people.',
  },
  {
    icon: '🏠',
    title: 'Build a Responsible Community',
    desc: 'Every profile goes through AI photo validation to ensure pet photos are real. Rate limiting, blocking, and reporting tools keep the platform safe for everyone.',
  },
  {
    icon: '📍',
    title: 'Hyper-Local Discovery',
    desc: 'Using PostGIS geospatial queries, PetMatch surfaces people near you first — ideal for planning park meetups, playdates, or just finding a neighbour who loves the same breed.',
  },
  {
    icon: '⚡',
    title: 'Instant, Real Connections',
    desc: 'Real-time chat with WebSocket technology means no waiting around. When you match, you can start talking immediately — no email delays, no third-party app needed.',
  },
  {
    icon: '🎯',
    title: 'Meaningful Matching, Not Just Swiping',
    desc: 'Unlike generic dating apps, PetMatch filters by pet type, age range, and distance. Every swipe is intentional and every match is a shared passion.',
  },
  {
    icon: '📚',
    title: 'A School Project with Real Engineering',
    desc: 'PetMatch is a technical school project (TP) built to demonstrate full-stack engineering: async APIs, geospatial databases, AI integration, real-time features, and production-ready Docker infrastructure.',
  },
];

const TIMELINE = [
  { phase: 'Phase 1', title: 'Core Platform', desc: 'User auth, profile creation, swipe engine, basic matching.' },
  { phase: 'Phase 2', title: 'Real-Time Features', desc: 'WebSocket chat, live notifications, read receipts.' },
  { phase: 'Phase 3', title: 'AI & Safety', desc: 'TensorFlow photo validation, rate limiting, blocking system.' },
  { phase: 'Phase 4', title: 'Monetisation', desc: 'Stripe-powered Premium with boosts, rewinds, unlimited swipes.' },
  { phase: 'Phase 5', title: 'Polish & Deploy', desc: 'Performance optimisation, 3D landing page, Docker production deploy.' },
];

const ProjectGoal = () => {
  const navigate = useNavigate();

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
              Why We Built This
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Project{' '}
              <span className="bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
                Goal
              </span>
            </h1>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              PetMatch was created to prove that a shared love of animals is one of the best foundations for human connection —
              and to demonstrate that a student project can be built with the same quality as a production application.
            </p>
          </div>

          {/* Goals grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {GOALS.map((g, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-3xl p-7 hover:-translate-y-1 transition-all duration-300"
              >
                <span className="text-4xl block mb-4">{g.icon}</span>
                <h3 className="text-lg font-bold text-white mb-2">{g.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{g.desc}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="bg-gradient-to-b from-rose-500/10 to-orange-500/5 border border-rose-500/20 rounded-3xl p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-10 text-center">
              Development{' '}
              <span className="bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
                Roadmap
              </span>
            </h2>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-rose-500 to-orange-400 hidden md:block" />
              <div className="space-y-8">
                {TIMELINE.map((t, i) => (
                  <div key={i} className="flex gap-6 items-start">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center text-white font-black text-xs z-10">
                      {i + 1}
                    </div>
                    <div className="pt-2">
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-widest">{t.phase}</span>
                      <h4 className="text-lg font-bold text-white mt-0.5">{t.title}</h4>
                      <p className="text-white/50 text-sm mt-1">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectGoal;
