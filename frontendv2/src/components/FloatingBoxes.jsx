import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const BOXES = [
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

// Desktop: 2x2 grid around center
const DESKTOP_FINAL = [
  { left: 22, top: 28 },  // top-left
  { left: 78, top: 28 },  // top-right
  { left: 22, top: 72 },  // bottom-left
  { left: 78, top: 72 },  // bottom-right
];

// Mobile: vertical stack in center
const MOBILE_FINAL = [
  { left: 50, top: 16 },
  { left: 50, top: 38 },
  { left: 50, top: 60 },
  { left: 50, top: 82 },
];

const DESKTOP_EDGE = [
  { left: -22, top: -18 },
  { left: 122, top: -18 },
  { left: -22, top: 118 },
  { left: 122, top: 118 },
];

const MOBILE_EDGE = [
  { left: -80, top: 16 },
  { left: 180, top: 38 },
  { left: -80, top: 60 },
  { left: 180, top: 82 },
];

const FloatingBoxes = ({ scrollProgress, isMobile, fadeOutAt = 0.62 }) => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('idle');
  const triggered = useRef(false);
  const timers = useRef([]);
  const prevScrollRef = useRef(0);

  useEffect(() => {
    if (scrollProgress > 0.17 && !triggered.current) {
      triggered.current = true;
      setPhase('edge');
      const t = setTimeout(() => setPhase('final'), 80);
      timers.current.push(t);
    }
  }, [scrollProgress]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const globalOpacity = useMemo(() => {
    if (phase === 'idle') return 0;

    const goingUp = scrollProgress < prevScrollRef.current;

    // Scrolling UP: fade out early so boxes don't overlap sections below the hero
    if (goingUp && scrollProgress < 0.45) {
      return Math.max(0, (scrollProgress - 0.08) / 0.37);
    }

    // Near top: always hidden
    if (scrollProgress < 0.08) return 0;

    // Fade out when scrolling DOWN past the box zone
    if (scrollProgress > fadeOutAt) {
      return Math.max(0, 1 - (scrollProgress - fadeOutAt) / 0.08);
    }

    return 1;
  }, [scrollProgress, phase]);

  // Update previous scroll ref AFTER render so useMemo above reads the previous value
  useEffect(() => {
    prevScrollRef.current = scrollProgress;
  }, [scrollProgress]);

  const edgePositions = isMobile ? MOBILE_EDGE : DESKTOP_EDGE;
  const finalPositions = isMobile ? MOBILE_FINAL : DESKTOP_FINAL;

  const getPos = (i) => {
    if (phase === 'idle' || phase === 'edge') return edgePositions[i];
    return finalPositions[i];
  };

  const getTransition = (i) => {
    if (phase === 'final') {
      const delay = i * 0.09;
      return `left 0.9s ${delay}s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.9s ${delay}s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease`;
    }
    return 'none';
  };

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
              width: isMobile ? '88%' : '300px',
              maxWidth: isMobile ? '380px' : 'none',
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

export default FloatingBoxes;
