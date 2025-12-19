import React, { useMemo } from 'react';
import TypingText from './TypingText';
import { useNavigate } from 'react-router-dom';

// IMPORTANT: Ensure the parent component (LandingPage) passes the isMobile prop:
// <FloatingBoxes scrollProgress={scrollProgress} isMobile={isMobile} />

const FloatingBoxes = ({ scrollProgress, isMobile }) => {
 const navigate = useNavigate();
 
 // Define scroll thresholds for animation phases
 const START_EXPAND = 0.25;
 const END_EXPAND = 0.55;
 const START_FADE = 0.60; // ADJUSTED: Start fading out earlier
 const END_FADE = 0.75;    // NEW: Define the end point of the fade

 // Calculate local progress for expansion (0 to 1)
 const expandProgress = useMemo(() => {
   if (scrollProgress < START_EXPAND) return 0;
   if (scrollProgress > END_EXPAND) return 1;
   return (scrollProgress - START_EXPAND) / (END_EXPAND - START_EXPAND);
 }, [scrollProgress]);

 // Calculate global opacity/visibility for the entire group
 const globalOpacity = useMemo(() => {
   if (scrollProgress < 0.20) return 0;

   // Fade in initially
   if (scrollProgress >= 0.20 && scrollProgress < START_EXPAND) {
    return (scrollProgress - 0.20) / (START_EXPAND - 0.20);
   }
   
   // Fade out as scroll progresses past the active area
   if (scrollProgress > START_FADE) {
     // MODIFIED: Using new END_FADE constant
     const fade = 1 - (scrollProgress - START_FADE) / (END_FADE - START_FADE);
     return Math.max(0, fade);
   }
   return 1;
 }, [scrollProgress]);

 const pointerEvents = globalOpacity > 0.1 ? 'auto' : 'none';

 // Typing should only start when expansion starts
 const shouldType = scrollProgress > START_EXPAND;

 // Lerp function
 const lerp = (start, end, alpha) => start + (end - start) * alpha;
 
 // Central starting position for all boxes
 const CENTER_TOP = 60; 
 const CENTER_LEFT = 50;

 // --- RESPONSIVE DESTINATION COORDINATES ---
 // Desktop: Wider spread
 const DESKTOP_LEFT_DEST = 15;
 const DESKTOP_RIGHT_DEST = 85;
 const DESKTOP_TOP_DEST = 20;
 const DESKTOP_BOTTOM_DEST = 80;

 // Mobile: Stacked Center Layout
 const MOBILE_CENTER_LEFT = 50;
 const MOBILE_START_TOP = 20; // First box position
 const MOBILE_VERTICAL_SPACING = 25; // Vertical space between stacked boxes (%)

 // Box styles base
 const boxStyleBase = {
   position: 'fixed',
   transform: 'translate(-50%, -50%)',
   width: isMobile ? '80%' : '300px', // Wider box for mobile
   maxWidth: isMobile ? '400px' : 'none',
   padding: '30px',
   background: 'rgba(255, 255, 255, 0.15)',
   backdropFilter: 'blur(12px)',
   border: '1px solid rgba(255, 255, 255, 0.3)',
   color: 'black', 
   borderRadius: '20px',
   boxShadow: '0 10px 40px 0 rgba(31, 38, 135, 0.45)',
   textAlign: 'left',
   zIndex: 50, 
   transition: 'top 0.4s ease-out, left 0.4s ease-out, opacity 0.5s ease-out, transform 0.2s ease', 
   cursor: 'pointer',
   pointerEvents: pointerEvents,
 };

 const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.";
 
 // Array defining the final state of each box
 const boxConfigs = useMemo(() => [
   { 
    // Box 1: Top Left (Desktop) / Top Center (Mobile)
    leftDest: isMobile ? MOBILE_CENTER_LEFT : DESKTOP_LEFT_DEST, 
    topDest: isMobile ? MOBILE_START_TOP : DESKTOP_TOP_DEST,
    mobileStackIndex: 0,
    path: '/project-goal'
   },
   { 
    // Box 2: Top Right (Desktop) / Second Center (Mobile)
    leftDest: isMobile ? MOBILE_CENTER_LEFT : DESKTOP_RIGHT_DEST, 
    topDest: isMobile ? MOBILE_START_TOP + MOBILE_VERTICAL_SPACING * 1 : DESKTOP_TOP_DEST,
    mobileStackIndex: 1,
    path: '/technology'
   },
   { 
    // Box 3: Bottom Left (Desktop) / Third Center (Mobile)
    leftDest: isMobile ? MOBILE_CENTER_LEFT : DESKTOP_LEFT_DEST, 
    topDest: isMobile ? MOBILE_START_TOP + MOBILE_VERTICAL_SPACING * 2 : DESKTOP_BOTTOM_DEST,
    mobileStackIndex: 2,
    path: '/features'
   },
   { 
    // Box 4: Bottom Right (Desktop) / Fourth Center (Mobile)
    leftDest: isMobile ? MOBILE_CENTER_LEFT : DESKTOP_RIGHT_DEST, 
    topDest: isMobile ? MOBILE_START_TOP + MOBILE_VERTICAL_SPACING * 3 : DESKTOP_BOTTOM_DEST,
    mobileStackIndex: 3,
    path: '/contact'
   },
 ], [isMobile]);

 // --- Animation Calculation ---
 const calculateBoxStyle = (config) => {
   // 1. Calculate Positional Lerp (Desktop & Mobile)
   const currentLeft = lerp(CENTER_LEFT, config.leftDest, expandProgress);
   const currentTop = lerp(CENTER_TOP, config.topDest, expandProgress);
   
   let boxOpacity = globalOpacity;

   // 2. Mobile Sequential Fade-In Logic
   if (isMobile) {
    const index = config.mobileStackIndex;
    const delay = 0.1 * index; // 0.1, 0.2, 0.3, 0.4
    const duration = 0.3;
    
    // Calculate local progress for this box's independent fade/move
    const localProgress = Math.min(
       Math.max(0, expandProgress - delay) / duration,
       1
    );
    
    // Box opacity fades in sequentially
    boxOpacity = localProgress;
    
    // Position remains stacked. We just use the 'progress' from global lerp
    // The quick `transition` CSS property handles the movement.
   }
   
   // Apply global fade-out when scrolling past
   boxOpacity = Math.min(boxOpacity, globalOpacity);

   return {
    ...boxStyleBase, 
    left: `${currentLeft}%`, 
    top: `${currentTop}%`,
    opacity: boxOpacity,
    // If opacity is 0, disable pointer events
    pointerEvents: boxOpacity > 0.1 ? pointerEvents : 'none',
   };
 };

 return (
   <>
    {boxConfigs.map((config, index) => (
      <div 
       key={index}
       style={calculateBoxStyle(config)}
       onClick={() => navigate(config.path)}
       className="hover:scale-105 transition-transform duration-200 hover:z-50"
      >
       <h3 className="text-2xl font-bold mb-3 text-rose-600">
         {index === 0 ? "Project Goal" : 
         index === 1 ? "Technology" :
         index === 2 ? "Features" : "Contact"}
       </h3>
       <p className="text-base font-medium">
         {shouldType && calculateBoxStyle(config).opacity > 0.5 ? 
            <TypingText text={lorem} speed={20 + index * 3} /> : ""}
       </p>
      </div>
    ))}
   </>
 );
};

export default FloatingBoxes;