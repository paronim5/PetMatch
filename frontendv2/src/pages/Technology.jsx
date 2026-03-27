import React from 'react';
import { useNavigate } from 'react-router-dom';

const STACK = [
  {
    category: 'Frontend',
    color: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-500/30',
    accent: 'text-rose-400',
    icon: '⚛️',
    items: [
      { name: 'React 19', desc: 'Component-based UI with hooks and concurrent features' },
      { name: 'Vite', desc: 'Lightning-fast build tool with hot module replacement' },
      { name: 'Three.js + React Three Fiber', desc: '3D cat model animation on the landing page' },
      { name: 'Tailwind CSS', desc: 'Utility-first CSS for rapid, consistent styling' },
      { name: 'React Router v6', desc: 'Client-side navigation and protected routes' },
    ],
  },
  {
    category: 'Backend',
    color: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-500/30',
    accent: 'text-orange-400',
    icon: '⚡',
    items: [
      { name: 'FastAPI (Python)', desc: 'High-performance async REST API with auto-generated OpenAPI docs' },
      { name: 'PostgreSQL + PostGIS', desc: 'Relational database with geospatial extensions for location-based matching' },
      { name: 'SQLAlchemy ORM', desc: 'Database models, relationships, and query builder' },
      { name: 'Alembic', desc: 'Database schema migrations' },
      { name: 'slowapi', desc: 'Rate limiting to prevent abuse and protect endpoints' },
    ],
  },
  {
    category: 'Real-Time & AI',
    color: 'from-pink-500/20 to-pink-500/5',
    border: 'border-pink-500/30',
    accent: 'text-pink-400',
    icon: '🤖',
    items: [
      { name: 'WebSockets', desc: 'Real-time bidirectional communication for chat and notifications' },
      { name: 'TensorFlow / OpenCV', desc: 'AI-powered photo validation — detects pets vs. invalid images' },
      { name: 'Prometheus Metrics', desc: 'Application performance monitoring and observability' },
    ],
  },
  {
    category: 'Auth & Payments',
    color: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-500/30',
    accent: 'text-violet-400',
    icon: '🔐',
    items: [
      { name: 'JWT Authentication', desc: 'Stateless token-based auth with secure refresh flow' },
      { name: 'Google OAuth 2.0', desc: 'One-click sign-in with Google accounts' },
      { name: 'Stripe', desc: 'Secure payment processing for Premium subscriptions' },
    ],
  },
  {
    category: 'Infrastructure',
    color: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-500/30',
    accent: 'text-sky-400',
    icon: '🐳',
    items: [
      { name: 'Docker + Docker Compose', desc: 'Containerised services for consistent dev and production environments' },
      { name: 'Nginx', desc: 'Reverse proxy routing frontend, backend API, WebSockets, and static files' },
      { name: "Let's Encrypt / Certbot", desc: 'Automatic TLS certificate management for HTTPS' },
    ],
  },
];

const Technology = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-gray-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
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
              Under the Hood
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Technology{' '}
              <span className="bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
                Stack
              </span>
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              PetMatch is built with modern, production-grade technologies designed for performance, scalability, and developer experience.
            </p>
          </div>

          {/* Stack grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {STACK.map((section) => (
              <div
                key={section.category}
                className={`bg-gradient-to-b ${section.color} border ${section.border} rounded-3xl p-8`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{section.icon}</span>
                  <h2 className={`text-xl font-bold ${section.accent}`}>{section.category}</h2>
                </div>
                <ul className="space-y-4">
                  {section.items.map((item) => (
                    <li key={item.name} className="flex gap-3">
                      <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current ${section.accent}`} />
                      <div>
                        <p className="font-semibold text-white text-sm">{item.name}</p>
                        <p className="text-white/50 text-sm mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Architecture note */}
          <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl mx-auto">
              The entire application runs inside Docker containers orchestrated by Docker Compose. Nginx sits in front of everything,
              routing traffic to the React frontend and FastAPI backend, upgrading WebSocket connections, and serving static assets —
              all behind TLS in production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Technology;
