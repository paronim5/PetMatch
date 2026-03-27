//todo create dark theme

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import FloatingBoxes from '../components/FloatingBoxes';

// --- CONFIGURATION CONSTANTS ---
const MOBILE_BREAKPOINT = 768; 
const SCROLL_DURATION = 2000; 
const SCROLL_OFFSET = 500;  

// Pathing/Parallax Configuration based on device
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
 }
};

// Cat model component
function CatModel({ scrollProgress, isMobile }) {
 const catRef = useRef();
 const mixerRef = useRef();
 const { scene, animations } = useGLTF('/cat.glb');
 const { start, end } = isMobile ? CONFIG.mobile.catPath : CONFIG.desktop.catPath;

 // Setup animation mixer
 useEffect(() => {
   if (animations && animations.length > 0 && scene) {
    mixerRef.current = new THREE.AnimationMixer(scene);
   }
   return () => {
    if (mixerRef.current) mixerRef.current.stopAllAction();
   };
 }, [scene, animations]);

 // Update animation and position based on scroll
 useFrame(() => {
   // 1. Animation Speed Control
   if (mixerRef.current && animations && animations.length > 0) {
    const action = mixerRef.current.clipAction(animations[0]);
    const duration = action.getClip().duration;
    
      // NEW ADJUSTMENT: Use 2.0 as the factor to ensure the animation plays 2 times 
      // over the full scroll progression (0 to 1).
    const animationRepeatCount = 2.0; 
      
      // Calculate total time progress (0 to 2 * duration)
    const totalTime = scrollProgress * duration * animationRepeatCount; 
      
      // Use modulo to wrap the time back to 0 when it exceeds the duration, 
      // effectively making the animation loop once halfway through the scroll.
      // The cat is moving slower because it takes the full scroll (200vh + feature section)
      // to complete two loops, whereas before it only took the scroll to complete ~1.5 loops.
      const time = totalTime % duration;
      
    action.time = time;
    action.play(); 
    mixerRef.current.setTime(time); 
   }
   
   // 2. Position Interpolation (Moves cat along the 3D line)
   if (catRef.current) {
    catRef.current.position.lerpVectors(start, end, scrollProgress);
   }
 });
 
 return (
   <primitive 
    ref={catRef}
    object={scene} 
    scale={isMobile ? 7 : 5}
    rotation={[0, -Math.PI / 2, 0]} 
   />
 );
}

// Scene component (No changes needed)
function Scene({ scrollProgress, isMobile }) {
 return (
   <>
    <ambientLight intensity={0.6} />
    <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
    <pointLight position={[-10, -10, -5]} intensity={0.3} />
    <CatModel scrollProgress={scrollProgress} isMobile={isMobile} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#90ee90" opacity={0.0} transparent /> 
    </mesh>
   </>
 );
}

const LandingPage = () => {
 const navigate = useNavigate();
 const [scrollProgress, setScrollProgress] = useState(0);
 const [typingText, setTypingText] = useState('');
 const [typingIndex, setTypingIndex] = useState(0);
 const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
 const [bgShouldLoad, setBgShouldLoad] = useState(false);
 const [bgLoaded, setBgLoaded] = useState(false);
 const [showScene, setShowScene] = useState(false);
 const heroRef = useRef(null);
 
 const messages = [
   'Find your perfect pet companion.',
   'Connect with loving animals.',
   'Make a difference in their lives.'
 ];

 // Device Detection and Window Resize Listener
 useEffect(() => {
   const handleResize = () => {
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
   };
   handleResize();
   window.addEventListener('resize', handleResize);
   return () => window.removeEventListener('resize', handleResize);
 }, []);

 // Dynamic Configuration Selection
 const currentConfig = isMobile ? CONFIG.mobile : CONFIG.desktop;
 
 // Typing animation
 useEffect(() => {
   const currentMessage = messages[typingIndex];
   let charIndex = 0;
   const typingInterval = setInterval(() => {
    if (charIndex <= currentMessage.length) {
      setTypingText(currentMessage.slice(0, charIndex));
      charIndex++;
    } else {
      clearInterval(typingInterval);
      setTimeout(() => {
       setTypingIndex((prev) => (prev + 1) % messages.length);
      }, 2000);
    }
   }, 50);
   return () => clearInterval(typingInterval);
 }, [typingIndex]);

 // Scroll tracking
 useEffect(() => {
  const handleScroll = () => {
   const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
   const progress = window.scrollY / scrollHeight;
    setScrollProgress(Math.min(Math.max(progress, 0), 1));
   };
   
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
 }, []);

 useEffect(() => {
  const target = heroRef.current;
  if (!target) {
    setBgShouldLoad(true);
    setShowScene(true);
    return;
  }
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        setBgShouldLoad(true);
        setShowScene(true);
        observer.disconnect();
      }
    },
    { root: null, threshold: 0.1 }
  );
  observer.observe(target);
  return () => observer.disconnect();
 }, []);

 // Custom Easing Function
 const easeInOutQuad = (t) => {
   return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
 };

 // Custom Scroll Animation Function
 const scrollToSection = () => {
   const section = document.getElementById('floating-boxes-start');
   if (!section) return;

   const startPosition = window.scrollY;
   const targetPosition = section.getBoundingClientRect().top + startPosition + SCROLL_OFFSET; 
   const startTime = performance.now();

   const animateScroll = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / SCROLL_DURATION, 1);
    
    const easedProgress = easeInOutQuad(progress);
    
    const newScrollY = startPosition + (targetPosition - startPosition) * easedProgress;
    
    window.scrollTo(0, newScrollY);

    if (progress < 1) {
      window.requestAnimationFrame(animateScroll);
    }
   };

   window.requestAnimationFrame(animateScroll);
 };

 // Logic for Fixed Background vs. Parallax
 const parallaxTransform = isMobile 
   ? `translateY(-${scrollProgress * currentConfig.parallaxScrollFactor}px)`
   : 'translateY(0)'; 

 return (
  <div className="relative" style={{ minHeight: '300vh' }}>
    
    {/* --- SCROLL PROGRESS INDICATOR --- */}
    <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
      <div 
       className="h-full bg-gradient-to-r from-secondary to-primary transition-all"
       style={{ width: `${scrollProgress * 100}%` }}
      />
    </div>

    <div 
      className={`fixed top-0 left-0 w-full ${isMobile ? 'h-[150vh]' : 'h-full'}`} 
      style={{
       backgroundImage: bgShouldLoad
         ? `url('${currentConfig.bgPath}')`
         : 'linear-gradient(180deg, #fee2e2 0%, #fef3c7 40%, #ecfeff 100%)',
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
      <img
        src={currentConfig.bgPath}
        alt=""
        loading="eager"
        decoding="async"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onLoad={() => setBgLoaded(true)}
      />
    )}

    {showScene && (
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <Canvas 
         camera={{ 
           position: [0, isMobile ? 0 : -1, 10], 
           fov: isMobile ? 30 : 22
         }} 
         shadows
        >
         <Scene scrollProgress={scrollProgress} isMobile={isMobile} />
        </Canvas>
      </div>
    )}
    
    {/* Floating Info Boxes (Needs isMobile prop passed) */}
    <FloatingBoxes scrollProgress={scrollProgress} isMobile={isMobile} />

    {/* Header */}
    <header className="absolute top-0 right-0 p-4 md:p-6 z-30">
      <div className="flex space-x-3">
       <button 
         className="bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-colors shadow-lg min-h-[48px]"
         onClick={() => navigate('/signup')}
       >
         Sign Up
       </button>
       <button 
         className="bg-rose-500 text-white px-6 py-3 rounded-lg hover:bg-rose-600 transition-colors shadow-lg min-h-[48px]"
         onClick={() => navigate('/login')}
       >
         Login
       </button>
      </div>
    </header>

    <section ref={heroRef} className="flex flex-col items-center justify-center min-h-screen text-center px-4 relative z-10">
      <div className="bg-white bg-opacity-90 backdrop-blur-sm rounded-2xl p-8 md:p-12 max-w-4xl shadow-2xl mx-4">
       <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary mb-6 animate-pulse">
         Welcome to PetMatch
       </h1>
       <p className="text-lg md:text-2xl text-gray-700 mb-8 h-16 flex items-center justify-center">
         <span>{typingText}</span>
         <span className="animate-pulse ml-1 text-primary">|</span>
       </p>
       <button 
         onClick={scrollToSection}
         className="bg-gradient-to-r from-secondary to-primary text-white px-6 py-3 md:px-8 md:py-4 rounded-full text-lg md:text-xl font-semibold hover:scale-105 transition-transform shadow-lg active:scale-95"
       >
         Start Your Journey
       </button>
      </div>
    </section>

    {/* Spacer for Floating Boxes Animation */}
    <div id="floating-boxes-start" className="h-[200vh]"></div>

    {/* Features Section */}
    <section className="relative z-10 py-16 md:py-20 px-4 bg-white/80 backdrop-blur-md rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
      <div className="max-w-6xl mx-auto">
       <h2 className="text-3xl md:text-4xl font-bold text-center text-primary mb-8 md:mb-12">Why Choose PetMatch?</h2>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
         {[
          { icon: '🏠', title: 'Find Your Match', desc: 'Browse thousands of adorable pets waiting for homes' },
          { icon: '❤️', title: 'Safe & Secure', desc: 'Verified shelters and responsible adoption process' },
          { icon: '🎉', title: 'Support Network', desc: 'Connect with pet owners and get expert advice' }
         ].map((feature, i) => (
          <div key={i} className="bg-white rounded-xl p-6 md:p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
            <div className="text-5xl md:text-6xl mb-4">{feature.icon}</div>
            <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-3">{feature.title}</h3>
            <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
          </div>
         ))}
       </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="relative z-10 bg-gray-900 text-white py-12">
      <div className="max-w-6xl mx-auto px-4 text-center">
       <p>&copy; 2024 PetMatch. All rights reserved.</p>
      </div>
    </footer>
   </div>
 );
};

export default LandingPage;
