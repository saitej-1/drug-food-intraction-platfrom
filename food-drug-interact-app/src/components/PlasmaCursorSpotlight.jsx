import React, { useEffect, useState, useRef } from 'react';

export default function PlasmaCursorSpotlight() {
  const spotlightRef = useRef(null);
  const dotRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const spotlight = useRef({ x: 0, y: 0 });
  const dot = useRef({ x: 0, y: 0 });
  
  const [isVisible, setIsVisible] = useState(false);
  const [isHoveringClickable, setIsHoveringClickable] = useState(false);

  useEffect(() => {
    // 1. Detect if screen supports hover (touch vs mouse cursor)
    const hasMouse = window.matchMedia('(pointer: fine)').matches;
    if (!hasMouse) return; // Disable cursor effects on touchscreen devices

    const handleMouseMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      setIsVisible(true);
      
      // Check if mouse is hovering over interactive elements (buttons, selects, tabs, cards)
      const target = e.target;
      const isInteractive = target.closest('button') || 
                            target.closest('select') || 
                            target.closest('input') || 
                            target.closest('.nav-tab') || 
                            target.closest('.glass-panel') && target.closest('.glass-panel').style.cursor === 'pointer' ||
                            target.closest('option');
      
      setIsHoveringClickable(!!isInteractive);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // 2. Physics animation loop
    let frameId;
    const update = () => {
      // Lerp spotlight backlight position (large soft glow - slower, heavier spring)
      spotlight.current.x += (mouse.current.x - spotlight.current.x) * 0.08;
      spotlight.current.y += (mouse.current.y - spotlight.current.y) * 0.08;

      // Lerp laser pointer dot (fast spring)
      dot.current.x += (mouse.current.x - dot.current.x) * 0.25;
      dot.current.y += (mouse.current.y - dot.current.y) * 0.25;

      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate3d(${spotlight.current.x - 150}px, ${spotlight.current.y - 150}px, 0)`;
      }
      if (dotRef.current) {
        // Grow dot when hovering over clickable items
        const scaleVal = isHoveringClickable ? 2.5 : 1.0;
        dotRef.current.style.transform = `translate3d(${dot.current.x - 4}px, ${dot.current.y - 4}px, 0) scale(${scaleVal})`;
      }

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      cancelAnimationFrame(frameId);
    };
  }, [isHoveringClickable]);

  // Hide component entirely on touch devices
  const hasMouse = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  if (!hasMouse) return null;

  return (
    <>
      {/* 1. Large Plasma Spotlight Backlight (zIndex: -1, behind card containers but in front of bloodstream background) */}
      <div
        ref={spotlightRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(214, 60, 55, 0.12) 0%, rgba(214, 60, 55, 0) 70%)',
          pointerEvents: 'none',
          zIndex: -1,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
          transform: 'translate3d(-999px, -999px, 0)',
          willChange: 'transform'
        }}
      />

      {/* 2. Small laser pointer dot (zIndex: 9999, foreground overlay) */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-brand)',
          boxShadow: isHoveringClickable 
            ? '0 0 16px rgba(214, 60, 55, 0.8), 0 0 32px rgba(214, 60, 55, 0.4)' 
            : '0 0 8px var(--color-brand)',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: isVisible ? 0.8 : 0,
          transition: 'opacity 0.3s ease, background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: 'translate3d(-999px, -999px, 0) scale(1)',
          willChange: 'transform'
        }}
      />
    </>
  );
}
