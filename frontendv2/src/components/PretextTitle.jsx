import { useEffect, useRef } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

/**
 * Canvas-rendered animated shimmer title using pretext for accurate layout.
 * No DOM reflow — pretext measures text via the browser's font engine directly.
 */
const PretextTitle = ({ text, fontSize = 56, className = '' }) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let observer;

    const init = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d');
      const font = `900 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
      const lineH = Math.round(fontSize * 1.15);
      const containerW = canvas.parentElement?.offsetWidth || 400;
      if (containerW === 0) return;

      let prepared, lines, height;
      try {
        prepared = prepareWithSegments(text, font);
        ({ lines, height } = layoutWithLines(prepared, containerW, lineH));
      } catch (e) {
        console.warn('[PretextTitle] layout error', e);
        return;
      }

      canvas.width = containerW * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${containerW}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      let offset = 0;

      const draw = () => {
        ctx.clearRect(0, 0, containerW, height);
        ctx.font = font;
        ctx.textBaseline = 'alphabetic';

        const sweep = offset % (containerW * 2.5);
        const g = ctx.createLinearGradient(sweep - containerW, 0, sweep + containerW * 1.5, 0);
        g.addColorStop(0,   '#4c1d95');
        g.addColorStop(0.3, '#7c3aed');
        g.addColorStop(0.5, '#c4b5fd');
        g.addColorStop(0.7, '#7c3aed');
        g.addColorStop(1,   '#4c1d95');

        ctx.fillStyle = g;
        lines.forEach((line, i) => {
          ctx.fillText(line.text, 0, (i + 1) * lineH - Math.round(lineH * 0.12));
        });

        offset += 1.0;
        rafRef.current = requestAnimationFrame(draw);
      };

      rafRef.current = requestAnimationFrame(draw);
    };

    init();

    observer = new ResizeObserver(init);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer?.disconnect();
    };
  }, [text, fontSize]);

  return <canvas ref={canvasRef} className={className} style={{ display: 'block' }} />;
};

export default PretextTitle;
