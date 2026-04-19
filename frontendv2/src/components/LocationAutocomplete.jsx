import React, { useState, useRef, useEffect } from 'react';

/**
 * Free location autocomplete using Nominatim (OpenStreetMap).
 * Searches on every keystroke (debounced 300ms).
 * Stores { lat, lon, city } — never the full address string.
 */

const getCleanLabel = (item) => {
  const a = item.address || {};
  const city = a.city || a.town || a.village || a.municipality || a.county || '';
  const country = a.country || '';
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  // fallback: first two comma-parts of display_name
  return item.display_name.split(',').slice(0, 2).join(',').trim();
};

const getCity = (item) =>
  item.address?.city ||
  item.address?.town ||
  item.address?.village ||
  item.address?.municipality ||
  item.address?.county ||
  item.display_name.split(',')[0].trim();

const LocationAutocomplete = ({ selectProps = {} }) => {
  const { value, onChange, placeholder = 'Search for your city...' } = selectProps;
  const [query, setQuery] = useState(value ? value.label : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value (e.g. set by "Use my current location")
  useEffect(() => {
    setQuery(value ? value.label : '');
  }, [value]);

  // Close dropdown on outside click/tap
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q.trim())}&format=json&addressdetails=1&limit=6`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val === '' && onChange) onChange(null);
    search(val);
  };

  const handleFocus = () => {
    if (results.length > 0) {
      setOpen(true);
    } else if (query.trim().length >= 2) {
      search(query);
    }
  };

  const handleSelect = (item) => {
    const city = getCity(item);
    const label = getCleanLabel(item);
    setQuery(label);
    setOpen(false);
    setResults([]);
    if (onChange) {
      onChange({ label, value: { lat: parseFloat(item.lat), lon: parseFloat(item.lon), city } });
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
        style={{
          width: '100%',
          padding: '14px 16px',
          borderRadius: '16px',
          border: 'none',
          backgroundColor: '#f9fafb',
          color: '#374151',
          fontSize: '14px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {loading && (
        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 12 }}>
          Searching...
        </div>
      )}
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 9999,
          listStyle: 'none',
          margin: 0,
          padding: '4px 0',
          maxHeight: 240,
          overflowY: 'auto',
        }}>
          {results.map((item) => (
            <li
              key={item.place_id}
              onMouseDown={() => handleSelect(item)}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(item); }}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: 13,
                color: '#374151',
                borderBottom: '1px solid #f3f4f6',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff1f2'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
            >
              <span style={{ fontWeight: 600 }}>{getCity(item)}</span>
              <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: 12 }}>
                {[item.address?.state, item.address?.country].filter(Boolean).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationAutocomplete;
