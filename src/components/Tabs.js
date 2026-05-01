// Accessible tab navigation with roving tabindex + arrow-key navigation.

import React, { useRef } from 'react';

const Tabs = ({ tabs, activeId, onChange }) => {
  const refs = useRef({});

  const handleKeyDown = (e) => {
    const ids = tabs.map((t) => t.id);
    const i = ids.indexOf(activeId);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    onChange(ids[next]);
    requestAnimationFrame(() => {
      const el = refs.current[ids[next]];
      if (el) el.focus();
    });
  };

  return (
    <div
      role="tablist"
      aria-label="Sections"
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-1 bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-xl p-1 shadow"
    >
      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[t.id] = el; }}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`tabpanel-${t.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium motion-safe:transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-300 ${
              selected
                ? 'bg-purple-600 text-white shadow'
                : 'text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-gray-700'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
