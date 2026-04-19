import { useEffect, useRef } from 'react';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';

const LINES = ['FIND YOUR', 'PERFECT MATCH'];

// Cat path matches CatScene config in LandingPage
const CAT_PATH = {
  desktop: { zStart: -13, zEnd: 12, fov: 22 },
  mobile:  { zStart: -25, zEnd:  5, fov: 30 },
};
const CAMERA_Z = 10;

const PretextCatText = ({ scrollProgress, isMobile }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const sp = scrollProgress;

    // Text fades in then out as cat approaches and passes through
    const textAlpha =
      sp < 0.03 ? 0 :
      sp < 0.12 ? (sp - 0.03) / 0.09 :
      sp < 0.42 ? 1 :
      sp < 0.52 ? 1 - (sp - 0.42) / 0.10 :
      0;

    if (textAlpha <= 0.005) return;

    const fontSize = isMobile ? 36 : 72;
    const lineH = Math.round(fontSize * 1.25);
    const font = `900 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
    const blockH = LINES.length * lineH;
    const blockCenterY = H * 0.70;
    const blockStartY = blockCenterY - blockH / 2;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = textAlpha;
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0,    'rgba(109, 40, 217, 0.9)');
    grad.addColorStop(0.35, 'rgba(196, 181, 253, 1.0)');
    grad.addColorStop(0.65, 'rgba(196, 181, 253, 1.0)');
    grad.addColorStop(1,    'rgba(109, 40, 217, 0.9)');
    ctx.fillStyle = grad;

    LINES.forEach((lineText, i) => {
      try {
        const prepared = prepareWithSegments(lineText, font);
        const { lines } = layoutWithLines(prepared, W * 2, lineH);
        lines.forEach((line) => {
          const metrics = ctx.measureText(line.text);
          const x = (W - metrics.width) / 2;
          const y = blockStartY + (i + 1) * lineH;
          ctx.fillText(line.text, x, y);
        });
      } catch {
        const metrics = ctx.measureText(lineText);
        ctx.fillText(lineText, (W - metrics.width) / 2, blockStartY + (i + 1) * lineH);
      }
    });

    // Project cat 3D z-position to screen-space hole radius
    const path = isMobile ? CAT_PATH.mobile : CAT_PATH.desktop;
    const catZ = path.zStart + (path.zEnd - path.zStart) * sp;
    const distToCamera = CAMERA_Z - catZ;
    const fovRad = path.fov * (Math.PI / 180);
    const f = (H / 2) / Math.tan(fovRad / 2);
    const catHalfSize = isMobile ? 1.5 : 2.2;

    const holeR = distToCamera > 0.2
      ? Math.max(0, (catHalfSize * f) / distToCamera)
      : W;

    if (holeR > 4) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;

      const cx = W / 2;
      const cy = blockCenterY;
      const segs = 20;

      ctx.beginPath();
      for (let k = 0; k <= segs; k++) {
        const angle = (k / segs) * Math.PI * 2;
        // subtle jitter locked to k so it doesn't shimmer on every scroll tick
        const jitter = 1 + Math.sin(k * 4.1 + Math.round(sp * 40) * 0.5) * 0.18;
        const x = cx + holeR * 1.5 * jitter * Math.cos(angle);
        const y = cy + holeR * 1.1 * jitter * Math.sin(angle);
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }, [scrollProgress, isMobile]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default PretextCatText;
