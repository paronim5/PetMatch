import React, { useEffect, useState } from 'react';

interface ToastProps {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  onClose: (id: number) => void;
  onClick?: () => void;
}

const CONFIG = {
  success: {
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-100 text-emerald-600',
    svg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    bar: 'bg-red-500',
    icon: 'bg-red-100 text-red-600',
    svg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  warning: {
    bar: 'bg-amber-500',
    icon: 'bg-amber-100 text-amber-600',
    svg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  info: {
    bar: 'bg-rose-500',
    icon: 'bg-rose-100 text-rose-600',
    svg: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose, onClick }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in
    const showTimer = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(id), 300);
    }, 4700);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, [id, onClose]);

  const cfg = CONFIG[type];

  return (
    <div
      className={`pointer-events-auto w-full transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div
        role="alert"
        onClick={() => { if (onClick) { onClick(); setVisible(false); setTimeout(() => onClose(id), 300); } }}
        className={`flex items-start gap-3 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 overflow-hidden relative ${
          onClick ? 'cursor-pointer hover:shadow-2xl' : ''
        }`}
      >
        {/* Accent bar */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ml-2 ${cfg.icon}`}>
          {cfg.svg}
        </div>

        {/* Message */}
        <p className="flex-1 text-sm font-medium text-gray-800 pt-1 pr-2">{message}</p>

        {/* Close */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(false); setTimeout(() => onClose(id), 300); }}
          className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
