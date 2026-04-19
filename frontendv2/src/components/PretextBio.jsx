import { useRef, useLayoutEffect, useState } from 'react';
import { prepareRichInline, walkRichInlineLineRanges, materializeRichInlineLineRange } from '@chenglou/pretext/rich-inline';

const LINE_H = 20;
const BODY_FONT = '400 13px Inter, ui-sans-serif, system-ui, sans-serif';
const BOLD_FONT = '700 13px Inter, ui-sans-serif, system-ui, sans-serif';

/**
 * Parses the bio string into rich inline items.
 * Bios are stored as: "<bio text>\n\nInterests: word1, word2, ..."
 * Interest keywords get rendered bold + violet, everything else is normal.
 */
function parseBioItems(bio) {
  const sepIdx = bio.indexOf('\n\nInterests:');
  if (sepIdx === -1) return [{ text: bio, font: BODY_FONT, kw: false }];

  const bodyText = bio.slice(0, sepIdx) + '  Interests: ';
  const rest = bio.slice(sepIdx + '\n\nInterests:'.length).trim();
  const keywords = rest.split(',').map(s => s.trim()).filter(Boolean);

  const items = [{ text: bodyText, font: BODY_FONT, kw: false }];
  keywords.forEach((word, i) => {
    items.push({ text: word, font: BOLD_FONT, break: 'never', kw: true });
    if (i < keywords.length - 1) {
      items.push({ text: ', ', font: BODY_FONT, kw: false });
    }
  });
  return items;
}

/**
 * Rich inline bio renderer using pretext for accurate layout.
 * Interest keywords are highlighted in bold violet.
 * maxLines controls truncation — pretext measures exact line breaks,
 * no need for CSS line-clamp hacks or DOM getBoundingClientRect calls.
 */
const PretextBio = ({ bio, maxLines = 3, className = '' }) => {
  const containerRef = useRef(null);
  const dataRef = useRef({ lines: null, items: [] });
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !bio) return;

    const layout = () => {
      const w = el.offsetWidth;
      if (w === 0) return;

      const parsedItems = parseBioItems(bio);
      let prepared;
      try {
        prepared = prepareRichInline(parsedItems);
      } catch (e) {
        console.warn('[PretextBio] prepare error', e);
        return;
      }

      const collected = [];
      walkRichInlineLineRanges(prepared, w, (range) => {
        if (collected.length < maxLines) {
          collected.push(materializeRichInlineLineRange(prepared, range));
        }
      });

      dataRef.current = { lines: collected, items: parsedItems };
      setTick(n => n + 1);
    };

    layout();
    const obs = new ResizeObserver(layout);
    obs.observe(el);
    return () => obs.disconnect();
  }, [bio, maxLines]);

  if (!bio) return null;

  const { lines, items } = dataRef.current;

  // First paint — invisible placeholder reserves space for measurement
  if (!lines) {
    return (
      <div ref={containerRef} className={`invisible text-sm ${className}`}>
        {bio.split('\n')[0]}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative text-sm ${className}`}
      style={{ height: lines.length * LINE_H }}
    >
      {lines.map((line, li) => (
        <div
          key={li}
          className="absolute left-0 flex items-baseline leading-none overflow-hidden"
          style={{ top: li * LINE_H, height: LINE_H }}
        >
          {line.fragments.map((frag, fi) => (
            <span
              key={fi}
              style={{ paddingLeft: frag.gapBefore || 0 }}
              className={items[frag.itemIndex]?.kw ? 'font-bold text-violet-300' : 'text-white/60'}
            >
              {frag.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

export default PretextBio;
