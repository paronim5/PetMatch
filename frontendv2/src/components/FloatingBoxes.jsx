import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export const BOXES = [
  {
    icon: '🎯',
    title: 'Project Goal',
    desc: 'Why PetMatch exists and what we set out to build.',
    path: '/project-goal',
    accent: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-400/30',
    titleColor: 'text-rose-400',
  },
  {
    icon: '⚡',
    title: 'Technology',
    desc: 'The modern stack powering every feature under the hood.',
    path: '/technology',
    accent: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-400/30',
    titleColor: 'text-orange-400',
  },
  {
    icon: '🐾',
    title: 'Features',
    desc: "Everything you can do once you're matched.",
    path: '/features',
    accent: 'from-pink-500/20 to-pink-500/5',
    border: 'border-pink-400/30',
    titleColor: 'text-pink-400',
  },
  {
    icon: '✉️',
    title: 'Contact',
    desc: 'Questions, ideas or feedback — reach out.',
    path: '/contact',
    accent: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-400/30',
    titleColor: 'text-violet-400',
  },
];

// ── Mobile: static in-flow cards with scroll-reveal ───────────────────────────
const MobileFloatingBoxes = () => {
  const navigate   = useNavigate();
  const refs       = useRef([]);
  const [visible, setVisible] = useState([false, false, false, false]);

  useEffect(() => {
    const observers = BOXES.map((_, i) => {
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible(v => { const n = [...v]; n[i] = true; return n; });
            obs.disconnect();
          }
        },
        { threshold: 0.15 }
      );
      if (refs.current[i]) obs.observe(refs.current[i]);
      return obs;
    });
    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <section className="relative z-10 py-10 px-4 bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col gap-3 max-w-sm mx-auto">
        {BOXES.map((box, i) => (
          <div
            key={i}
            ref={el => { refs.current[i] = el; }}
            style={{
              opacity: visible[i] ? 1 : 0,
              transform: visible[i] ? 'translateY(0)' : 'translateY(28px)',
              transition: `opacity 0.55s ${i * 0.1}s ease, transform 0.55s ${i * 0.1}s ease`,
            }}
            onClick={() => navigate(box.path)}
            className={`bg-gradient-to-b ${box.accent} border ${box.border} backdrop-blur-xl rounded-2xl p-5 cursor-pointer active:scale-95 transition-transform duration-150`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{box.icon}</span>
              <h3 className={`text-base font-black ${box.titleColor}`}>{box.title}</h3>
            </div>
            <p className="text-white/55 text-sm leading-relaxed">{box.desc}</p>
            <div className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${box.titleColor}`}>
              Explore
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Desktop: flying-in fixed overlay ─────────────────────────────────────────
const DESKTOP_FINAL = [
  { left: 22, top: 28 },
  { left: 78, top: 28 },
  { left: 22, top: 72 },
  { left: 78, top: 72 },
];
const DESKTOP_EDGE = [
  { left: -22, top: -18 },
  { left: 122, top: -18 },
  { left: -22, top: 118 },
  { left: 122, top: 118 },
];

const DesktopFloatingBoxes = ({ scrollProgress, fadeOutAt }) => {
  const navigate    = useNavigate();
  const [phase, setPhase] = useState('idle');
  const triggered   = useRef(false);
  const timers      = useRef([]);
  const prevScrollRef = useRef(0);

  useEffect(() => {
    if (scrollProgress > 0.17 && !triggered.current) {
      triggered.current = true;
      setPhase('edge');
      const t = setTimeout(() => setPhase('final'), 80);
      timers.current.push(t);
    }
  }, [scrollProgress]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const globalOpacity = useMemo(() => {
    if (phase === 'idle') return 0;
    const goingUp = scrollProgress < prevScrollRef.current;
    if (goingUp && scrollProgress < 0.45) {
      return Math.max(0, (scrollProgress - 0.08) / 0.37);
    }
    if (scrollProgress < 0.08) return 0;
    if (scrollProgress > fadeOutAt) {
      return Math.max(0, 1 - (scrollProgress - fadeOutAt) / 0.08);
    }
    return 1;
  }, [scrollProgress, phase, fadeOutAt]);

  useEffect(() => { prevScrollRef.current = scrollProgress; }, [scrollProgress]);

  const getPos = (i) =>
    (phase === 'idle' || phase === 'edge') ? DESKTOP_EDGE[i] : DESKTOP_FINAL[i];

  const getTransition = (i) =>
    phase === 'final'
      ? `left 0.9s ${i * 0.09}s cubic-bezier(0.34,1.56,0.64,1), top 0.9s ${i * 0.09}s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease`
      : 'none';

  const isInteractive = phase === 'final' && globalOpacity > 0.1;

  return (
    <>
      {BOXES.map((box, i) => {
        const pos = getPos(i);
        return (
          <div
            key={i}
            style={{
              position: 'fixed',
              left: `${pos.left}%`,
              top: `${pos.top}%`,
              transform: 'translate(-50%, -50%)',
              opacity: phase === 'idle' ? 0 : globalOpacity,
              width: '300px',
              transition: getTransition(i),
              zIndex: 50,
              pointerEvents: isInteractive ? 'auto' : 'none',
              willChange: 'left, top',
            }}
            onClick={() => isInteractive && navigate(box.path)}
            className={`bg-gradient-to-b ${box.accent} border ${box.border} backdrop-blur-xl rounded-3xl p-7 cursor-pointer shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-200`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-4xl">{box.icon}</span>
              <h3 className={`text-xl font-black ${box.titleColor}`}>{box.title}</h3>
            </div>
            <p className="text-white/55 text-sm leading-relaxed">{box.desc}</p>
            <div className={`mt-4 flex items-center gap-1.5 text-xs font-bold ${box.titleColor}`}>
              Explore
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        );
      })}
    </>
  );
};

// ── Public component — picks the right variant ────────────────────────────────
const FloatingBoxes = ({ scrollProgress, isMobile, fadeOutAt = 0.62 }) => {
  if (isMobile) return <MobileFloatingBoxes />;
  return <DesktopFloatingBoxes scrollProgress={scrollProgress} fadeOutAt={fadeOutAt} />;
};

export default FloatingBoxes;
