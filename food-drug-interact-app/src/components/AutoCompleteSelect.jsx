import React, { useState, useEffect, useRef } from 'react';

/**
 * AutoCompleteSelect - a lightweight autocomplete dropdown.
 * Shows suggestions once the user has typed at least 3 characters.
 * Props:
 *  - items: array of objects { id, name, category }
 *  - value: currently selected id
 *  - onChange: (id) => void
 *  - placeholder: input placeholder text
 */
export default function AutoCompleteSelect({ items, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const inputRef = useRef(null);

  // Set query to the current selected name for display when value changes externally
  useEffect(() => {
    const selected = items.find((i) => i.id === value);
    if (selected) setQuery(selected.name);
  }, [value, items]);

  const filtered = query.length >= 3
    ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : [];

  const handleSelect = (id, name) => {
    onChange(id);
    setQuery(name);
    setShowList(false);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) {
        setShowList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div style={{ position: 'relative' }} ref={inputRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowList(true);
        }}
        onFocus={() => setShowList(true)}
        style={{
          width: '100%',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--panel-border)',
          fontSize: '15px',
          fontWeight: 500,
        }}
      />
      {showList && filtered.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          maxHeight: '180px',
          overflowY: 'auto',
          background: 'var(--bg-primary)',
          border: '1px solid var(--panel-border)',
          borderRadius: 'var(--radius-md)',
          marginTop: '4px',
          zIndex: 10,
          listStyle: 'none',
          padding: 0,
        }}>
          {filtered.map((item) => (
            <li
              key={item.id}
              onClick={() => handleSelect(item.id, item.name)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid var(--panel-border)',
              }}
            >
              {item.name} ({item.category})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
