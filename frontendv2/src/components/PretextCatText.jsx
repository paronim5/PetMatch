import { useEffect, useRef } from 'react';

const LINES = [
  'Find your perfect pet companion.',
  'Connect with loving animals today.',
  'Make a difference in their lives.',
  'Smarter matching powered by AI.',
  'Join fifty thousand happy families.',
];

const ROW_TEXT = LINES.join('   ✦   ') + '   ✦   ';

const ROW_DEFS = [
  { speed:  52, fontSize: 13, color: 'rgba(196,181,253,0.55)' },
  { speed: -68, fontSize: 16, color: 'rgba(255,255,255,0.70)' },
  { speed:  60, fontSize: 13, color: 'rgba(196,181,253,0.55)' },
  { speed: -55, fontSize: 16, color: 'rgba(255,255,255,0.70)' },
  { speed:  72, fontSize: 13, color: 'rgba(196,181,253,0.55)' },
  { speed: -62, fontSize: 16, color: 'rgba(255,255,255,0.70)' },
  { speed:  50, fontSize: 13, color: 'rgba(196,181,253,0.45)' },
];

const ROW_LINE_H  = 38;
const CENTER_FRAC = 0.78;  // lower on screen — where the cat runs through

const CAMERA_Z = 10;

const easeOutCubic  = t => 1 - Math.pow(1 - t, 3);
const easeInOutQuad = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutBack   = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

const FADE_IN_START  = 0.05;
const FADE_IN_END    = 0.16;
const FADE_OUT_START = 0.52;
const FADE_OUT_END   = 0.63;
const HOLE_START     = 0.30;
const HOLE_RESET     = 0.04;
const BULGE_START    = 0.18;
const MAX_BULGE      = 48;   // px radial displacement at peak
const BULGE_SIGMA    = 220;  // Gaussian spread in px
const BREAK_DUR      = 0.025; // snap-back duration when hole punches

// Draw a tiled row char-by-char with per-character convex displacement
function drawRowConvex(ctx, text, font, baseY, offset, W, color, alpha, catX, catY, bulgePx) {
  if (alpha < 0.005) return;
  ctx.font = font;
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(text).width;
  if (textW < 1) return;
  const norm = ((offset % textW) + textW) % textW;

  let tileX = -norm;
  while (tileX < W + textW) {
    let x = tileX;
    for (const char of text) {
      const charW    = ctx.measureText(char).width;
      const charMidX = x + charW / 2;

      let dispX = 0, dispY = 0;
      if (bulgePx > 0.5) {
        const dx   = charMidX - catX;
        const dy   = baseY    - catY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const g    = Math.exp(-(dist * dist) / (2 * BULGE_SIGMA * BULGE_SIGMA));
        const mag  = bulgePx * g;
        if (dist > 1) { dispX = (dx / dist) * mag; dispY = (dy / dist) * mag; }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle   = color;
      ctx.fillText(char, x + dispX, baseY + dispY);
      x += charW;
    }
    tileX += textW;
  }
}

const PretextCatText = ({ scrollProgress, isMobile }) => {
  const canvasRef  = useRef(null);
  const prevSzRef  = useRef('');
  const holesRef   = useRef([]);
  const offsetsRef = useRef(ROW_DEFS.map(() => 0));
  const spRef      = useRef(scrollProgress);
  const rafRef     = useRef(null);

  useEffect(() => { spRef.current = scrollProgress; }, [scrollProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastTs = null;

    const render = (ts) => {
      if (!lastTs) lastTs = ts;
      const dt  = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs    = ts;

      const sp  = spRef.current;
      const dpr = window.devicePixelRatio || 1;
      const W   = window.innerWidth;
      const H   = window.innerHeight;
      const sz  = `${W}x${H}`;

      if (prevSzRef.current !== sz) {
        prevSzRef.current = sz;
        canvas.width        = W * dpr;
        canvas.height       = H * dpr;
        canvas.style.width  = `${W}px`;
        canvas.style.height = `${H}px`;
        holesRef.current    = [];
      }

      ROW_DEFS.forEach((def, i) => { offsetsRef.current[i] += def.speed * dt; });

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      if (sp < HOLE_RESET) holesRef.current = [];

      if (sp <= FADE_IN_START || sp >= FADE_OUT_END) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }

      // Global fade
      let fade = 1;
      if (sp < FADE_IN_END)    fade = easeOutCubic((sp - FADE_IN_START) / (FADE_IN_END - FADE_IN_START));
      if (sp > FADE_OUT_START) fade = 1 - easeInOutQuad((sp - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START));
      fade = Math.max(0, Math.min(1, fade));

      // ── Cat 3D projection ────────────────────────────────────────────────
      const zStart = isMobile ? -25 : -13;
      const zEnd   = isMobile ?   5 :  12;
      const yStart = isMobile ? -0.5 : -1.5;
      const yEnd   = isMobile ? -5.5 : -5.0;
      const camY   = isMobile ?  0   : -1;
      const fovDeg = isMobile ?  30  :  22;

      const catZ      = zStart + (zEnd - zStart) * sp;
      const catWorldY = yStart + (yEnd - yStart) * sp;
      const perspDist = CAMERA_Z - catZ;
      const f         = (H / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);

      const catScreenY = perspDist > 0.3
        ? H / 2 - (catWorldY - camY) * f / perspDist
        : H * 0.75;

      const catWorldHalfSize = isMobile ? 0.35 : 0.42;
      const catHoleR = perspDist > 0.3
        ? Math.max(0, (catWorldHalfSize * f) / perspDist)
        : W;

      const cx = W / 2;
      const cy = catScreenY + catHoleR * 0.45;

      const bulgePx = 0;

      // ── Draw rows ────────────────────────────────────────────────────────
      ctx.globalCompositeOperation = 'source-over';

      const totalBandH = (ROW_DEFS.length - 1) * ROW_LINE_H;
      const bandTop    = H * CENTER_FRAC - totalBandH / 2;

      ROW_DEFS.forEach((def, i) => {
        const rowY = bandTop + i * ROW_LINE_H;
        const font = `700 ${def.fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
        const baseAlpha = def.color.includes('196') ? 0.55 : 0.70;
        drawRowConvex(
          ctx, ROW_TEXT, font, rowY,
          offsetsRef.current[i], W,
          def.color, fade * baseAlpha,
          cx, cy, bulgePx
        );
      });

      // ── Accumulate torn-paper holes ──────────────────────────────────────
      if (sp >= HOLE_START && catHoleR > 8) {
        const last  = holesRef.current[holesRef.current.length - 1];
        const moved = !last
          || Math.abs(last.cy - cy) > 18
          || last.r < catHoleR * 0.95;

        if (moved) {
          const seed = holesRef.current.length * 17.3;
          const segs = 60;
          const pts  = [];
          for (let k = 0; k <= segs; k++) {
            const a  = (k / segs) * Math.PI * 2;
            const n1 = Math.sin(k * 2.7 + seed * 3.1) * 0.28;
            const n2 = Math.sin(k * 6.3 + seed * 7.4) * 0.16;
            const n3 = Math.sin(k * 13.1 + seed * 12.9) * 0.09;
            const n4 = Math.sin(k * 27.3 + seed * 5.7) * 0.04;
            const st    = Math.sin(k * 19.1 + seed * 8.6);
            const spike = st > 0.78 ? ((st - 0.78) / 0.22) * 0.55 : 0;
            const r = catHoleR * (1 + n1 + n2 + n3 + n4 + spike);
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
          }
          holesRef.current.push({ cx, cy, r: catHoleR, pts });
        }
      }
      if (sp < HOLE_START) holesRef.current = [];

      // ── Punch torn holes ─────────────────────────────────────────────────
      if (holesRef.current.length > 0) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
        ctx.fillStyle   = 'black';
        holesRef.current.forEach(h => {
          ctx.beginPath();
          h.pts.forEach((pt, pi) => pi === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          ctx.closePath();
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isMobile]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 pointer-events-none"
      style={{ zIndex: 2 }}
    />
  );
};

export default PretextCatText;
