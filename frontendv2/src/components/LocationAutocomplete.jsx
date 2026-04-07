import React, { useState, useRef, useEffect } from 'react';

/**
 * Free location autocomplete using Nominatim (OpenStreetMap).
 * Drop-in replacement for react-google-places-autocomplete.
 * onChange receives: { label: string, value: { lat, lon, city } }
 */
const LocationAutocomplete = ({ selectProps = {} }) => {
  const { value, onChange, placeholder = 'Search for your city...', styles = {} } = selectProps;
  const [query, setQuery] = useState(value ? value.label : '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    if (value) setQuery(value.label);
    else setQuery('');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q) => {
    clearTimeout(debounceRef.current);
    if (!q || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&featuretype=city`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleInput = (e) => {
    setQuery(e.target.value);
    search(e.target.value);
    if (onChange && e.target.value === '') onChange(null);
  };

  const handleSelect = (item) => {
    const city =
      item.address?.city ||
      item.address?.town ||
      item.address?.village ||
      item.address?.county ||
      item.display_name.split(',')[0];
    const label = item.display_name;
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
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
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
              {item.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LocationAutocomplete;
