import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import FloatingBoxes from '../components/FloatingBoxes';
import PretextTitle from '../components/PretextTitle';
import PretextCatText from '../components/PretextCatText';

const CatScene = lazy(() => import('../components/CatScene'));

const MOBILE_BREAKPOINT = 768;
const SCROLL_DURATION = 2000;

const CONFIG = {
  mobile: {
    bgPath: '/landingpagebg864x1184.png',
    parallaxScrollFactor: 100,
    catPath: {
      start: new THREE.Vector3(0, -0.5, -25),
      end: new THREE.Vector3(0, -5.5, 5),
    },
  },
  desktop: {
    bgPath: '/landingpagebg1920x1080.png',
    parallaxScrollFactor: 0,
    catPath: {
      start: new THREE.Vector3(0, -1.5, -13),
      end: new THREE.Vector3(0, -5, 12),
    },
  },
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [typingText, setTypingText] = useState('');
  const [typingIndex, setTypingIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [bgShouldLoad, setBgShouldLoad] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [showScene, setShowScene] = useState(false);
  const [fadeOutAt, setFadeOutAt] = useState(0.62);
  const heroRef = useRef(null);
  const statsRef = useRef(null);

  const messages = [
    'Find your perfect pet companion.',
    'Connect with loving animals.',
    'Make a difference in their lives.',
  ];

  // Debounced resize
  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT), 150);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => { window.removeEventListener('resize', handleResize); clearTimeout(timer); };
  }, []);

  const currentConfig = isMobile ? CONFIG.mobile : CONFIG.desktop;

  // Typing animation
  useEffect(() => {
    const msg = messages[typingIndex];
    let i = 0;
    const interval = setInterval(() => {
      if (i <= msg.length) { setTypingText(msg.slice(0, i)); i++; }
      else { clearInterval(interval); setTimeout(() => setTypingIndex(p => (p + 1) % messages.length), 2000); }
    }, 50);
    return () => clearInterval(interval);
  }, [typingIndex]);

  // RAF-throttled passive scroll
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          setScrollProgress(Math.min(Math.max(window.scrollY / h, 0), 1));
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // IntersectionObserver to trigger bg + 3D load
  useEffect(() => {
    const target = heroRef.current;
    if (!target) { setBgShouldLoad(true); setShowScene(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setBgShouldLoad(true); setShowScene(true); observer.disconnect(); }
    }, { threshold: 0.1 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Recalculate fade-out threshold whenever the stats section position changes (e.g. on resize)
  useEffect(() => {
    const update = () => {
      if (!statsRef.current) return;
      const totalScrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScrollable <= 0) return;
      // Start fading boxes out 80px before the stats section enters the viewport
      const threshold = (statsRef.current.offsetTop - window.innerHeight - 80) / totalScrollable;
      setFadeOutAt(Math.max(0.3, Math.min(0.75, threshold)));
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => window.removeEventListener('resize', update);
  }, []);

  const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  const scrollToSection = () => {
    // Scroll to ~38% of total scrollable height — center of the floating boxes zone
    const totalScrollable = document.documentElement.scrollHeight - window.innerHeight;
    const target = totalScrollable * 0.38;
    const start = window.scrollY;
    const t0 = performance.now();
    const animate = now => {
      const p = Math.min((now - t0) / SCROLL_DURATION, 1);
      window.scrollTo(0, start + (target - start) * easeInOutQuad(p));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  const parallaxTransform = isMobile
    ? `translateY(-${scrollProgress * currentConfig.parallaxScrollFactor}px)`
    : 'translateY(0)';

  return (
    <div className="relative" style={{ minHeight: '300vh' }}>

      {/* Scroll progress bar */}
      <div className="fixed top-0 left-0 w-full h-[3px] z-50">
        <div
          className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400 transition-none"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {/* Background */}
      <div
        className={`fixed top-0 left-0 w-full ${isMobile ? 'h-[150vh]' : 'h-full'}`}
        style={{
          backgroundImage: bgShouldLoad
            ? `url('${currentConfig.bgPath}')`
            : 'linear-gradient(135deg, #1a0a0e 0%, #3b1219 40%, #1e0a1a 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          filter: bgLoaded ? 'none' : 'blur(20px)',
          opacity: bgLoaded ? 1 : 0.9,
          zIndex: -1,
          transform: parallaxTransform,
          transition: 'transform 0.1s linear, filter 0.4s ease-out, opacity 0.4s ease-out',
        }}
      />
      {bgShouldLoad && (
        <img src={currentConfig.bgPath} alt="" loading="eager" decoding="async"
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          onLoad={() => setBgLoaded(true)} />
      )}

      {/* Pretext scroll text — renders behind cat; cat punches hole through it */}
      {showScene && (
        <PretextCatText scrollProgress={scrollProgress} isMobile={isMobile} />
      )}

      {/* 3D Cat — lazy loaded, renders on top of PretextCatText */}
      {showScene && (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <Suspense fallback={null}>
            <CatScene
              scrollProgress={scrollProgress}
              isMobile={isMobile}
              catPath={currentConfig.catPath}
              cameraPos={isMobile ? [0, 0, 10] : [0, -1, 10]}
              fov={isMobile ? 30 : 22}
            />
          </Suspense>
        </div>
      )}

      <FloatingBoxes scrollProgress={scrollProgress} isMobile={isMobile} fadeOutAt={fadeOutAt} />

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 p-4 md:p-6 z-30 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-white tracking-tight drop-shadow-lg">
            Pet<span className="text-violet-400">Match</span>
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white border border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-5 py-2.5 rounded-full text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-lg shadow-violet-900/40"
          >
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero */}
      <section ref={heroRef} className="flex flex-col items-center justify-center min-h-screen text-center px-4 relative z-10">
        <div className="max-w-3xl mx-auto px-3 sm:px-4">
          {/* Glassmorphism card */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 sm:p-8 md:p-14 shadow-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              Find Your Match
            </div>

            <div className="mb-6">
              <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-1">
                Welcome to
              </p>
              <PretextTitle
                text="PetMatch"
                fontSize={isMobile ? 48 : 76}
              />
            </div>

            <p className="text-lg md:text-xl text-white/70 mb-10 h-8 flex items-center justify-center">
              <span className="font-medium">{typingText}</span>
              <span className="ml-1 text-violet-400 animate-pulse font-light">|</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/signup')}
                className="px-5 sm:px-8 py-3 sm:py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl text-base sm:text-lg font-bold hover:scale-105 transition-all shadow-xl shadow-violet-900/40 active:scale-95"
              >
                Get Started Free
              </button>
              <button
                onClick={scrollToSection}
                className="px-5 sm:px-8 py-3 sm:py-4 bg-white/10 border border-white/20 text-white rounded-2xl text-base sm:text-lg font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
              >
                Learn More
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6">
            {[
              { value: '10K+', label: 'Happy Matches' },
              { value: '500+', label: 'Shelters' },
              { value: '98%', label: 'Satisfaction' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-2 sm:p-4">
                <div className="text-lg sm:text-2xl md:text-3xl font-black text-white">{s.value}</div>
                <div className="text-xs text-white/50 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="floating-boxes-start" className="h-[200vh]" />

      {/* Stats section */}
      <section ref={statsRef} className="relative z-10 py-20 px-4 bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              The Numbers{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                Speak
              </span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Thousands of pet lovers are already finding their perfect match.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '50K+', label: 'Pet Lovers', icon: '🐾', sub: 'and growing daily' },
              { value: '95%', label: 'Match Rate', icon: '💘', sub: 'successful connections' },
              { value: '200+', label: 'Cities', icon: '📍', sub: 'across the country' },
              { value: '4.8★', label: 'App Rating', icon: '⭐', sub: 'from happy users' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center hover:-translate-y-1 transition-all duration-300">
                <div className="text-4xl mb-3">{s.icon}</div>
                <div className="text-3xl md:text-4xl font-black text-white">{s.value}</div>
                <div className="text-sm font-bold text-white/70 mt-1">{s.label}</div>
                <div className="text-xs text-white/30 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Testimonial strip */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { quote: 'Met my best friend because we both have golden retrievers. PetMatch just gets it.', name: 'Tereza K.', pet: '🐕 Golden Retriever owner' },
              { quote: "Found someone who loves cats as much as I do. We've been inseparable since day one.", name: 'Martin H.', pet: '🐱 Persian Cat owner' },
              { quote: 'The location filter is a game changer — we live 5 minutes apart and met at the park!', name: 'Lucie M.', pet: '🐇 Rabbit owner' },
            ].map((t, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <p className="text-white/70 text-sm leading-relaxed italic mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-white font-bold text-sm">{t.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">{t.pet}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features-section" className="relative z-10 py-20 px-4 bg-gradient-to-b from-gray-950 to-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              Why Choose{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-300 bg-clip-text text-transparent">
                PetMatch?
              </span>
            </h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              The smarter way to connect pets with loving homes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '🏠',
                title: 'Find Your Match',
                desc: 'Browse thousands of adorable pets waiting for loving homes.',
                accent: 'from-violet-500/20 to-violet-500/5',
                border: 'border-violet-500/20',
              },
              {
                icon: '❤️',
                title: 'Safe & Secure',
                desc: 'Verified shelters and a responsible, AI-powered adoption process.',
                accent: 'from-purple-500/20 to-purple-500/5',
                border: 'border-purple-500/20',
              },
              {
                icon: '🎉',
                title: 'Support Network',
                desc: 'Connect with experienced pet owners and get expert advice.',
                accent: 'from-indigo-500/20 to-indigo-500/5',
                border: 'border-indigo-500/20',
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`bg-gradient-to-b ${f.accent} border ${f.border} rounded-3xl p-8 hover:-translate-y-1 transition-all duration-300`}
              >
                <div className="text-5xl mb-5">{f.icon}</div>
                <h3 className="text-xl font-bold text-white mb-3">{f.title}</h3>
                <p className="text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative z-10 py-16 px-4 bg-gradient-to-r from-violet-700 to-purple-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Ready to find your perfect pet?</h2>
          <p className="text-white/80 text-lg mb-8">Join thousands of happy families who found their match.</p>
          <button
            onClick={() => navigate('/signup')}
            className="px-10 py-4 bg-white text-violet-700 rounded-2xl text-lg font-black hover:scale-105 transition-transform shadow-xl"
          >
            Start Matching Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-950 text-white/40 py-10 text-center text-sm">
        <p>&copy; 2024 PetMatch. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
