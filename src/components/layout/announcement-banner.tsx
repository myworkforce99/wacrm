'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('wacrm-banner-v1-dismissed');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!dismissed);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm text-white"
      style={{ background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)' }}
    >
      <span>🚀</span>
      <span>
        Agent Demo Mode — Explore freely. No login required.{' '}
        <button className="ml-2 rounded-full border border-white/40 px-3 py-0.5 text-xs font-semibold hover:bg-white/10">
          Start free →
        </button>
      </span>
      <button
        className="ml-auto p-1 hover:opacity-70"
        onClick={() => {
          localStorage.setItem('wacrm-banner-v1-dismissed', '1');
          setVisible(false);
        }}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
