import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LINKS = [
  {
    icon: '💻',
    label: 'GitHub',
    value: 'github.com/paronim5',
    href: 'https://github.com/paronim5',
    accent: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
  },
  {
    icon: '📷',
    label: 'Instagram',
    value: '@paroniim_',
    href: 'https://www.instagram.com/paroniim_',
    accent: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/10',
  },
  {
    icon: '💼',
    label: 'LinkedIn',
    value: 'Pavel Kosov',
    href: 'https://www.linkedin.com/in/pavel-kosov-9242283b3/',
    accent: 'text-sky-400',
    border: 'border-sky-500/20',
    bg: 'bg-sky-500/10',
  },
  {
    icon: '🏫',
    label: 'School',
    value: 'SPŠ Ječná, Prague',
    href: 'https://www.spsejecna.cz',
    accent: 'text-orange-400',
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/10',
  },
];

const Contact = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    // In a real app this would POST to the backend
    setSent(true);
  };

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
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-300 text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              Get In Touch
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-4">
              Say{' '}
              <span className="bg-gradient-to-r from-rose-400 to-orange-300 bg-clip-text text-transparent">
                Hello
              </span>
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Have a question, idea, or bug report? We'd love to hear from you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Links */}
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-white mb-6">Find Us</h2>
              {LINKS.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-4 ${l.bg} border ${l.border} rounded-2xl p-5 hover:-translate-y-0.5 transition-all duration-200 group`}
                >
                  <span className="text-3xl">{l.icon}</span>
                  <div>
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest">{l.label}</p>
                    <p className={`font-semibold ${l.accent} group-hover:underline text-sm mt-0.5`}>{l.value}</p>
                  </div>
                </a>
              ))}

              {/* About */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-4">
                <p className="text-white/50 text-sm leading-relaxed">
                  PetMatch is a school final project (TP) developed by <span className="text-white/80 font-semibold">Pavel Kosov</span> at SPŠ Ječná, Prague.
                  Built as a demonstration of full-stack engineering — not a commercial product.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              {sent ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
                  <span className="text-6xl">🐾</span>
                  <h3 className="text-2xl font-black text-white">Message sent!</h3>
                  <p className="text-white/50 text-sm">We'll get back to you as soon as possible.</p>
                  <button
                    onClick={() => { setSent(false); setForm({ name: '', email: '', message: '' }); }}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-white mb-2">Send a Message</h2>

                  {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Name</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email</label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Message</label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      rows={5}
                      placeholder="What's on your mind?"
                      className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-transparent transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-orange-400 text-white rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-rose-900/40"
                  >
                    Send Message
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
