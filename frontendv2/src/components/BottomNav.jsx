import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaFire, FaComments, FaHeart, FaUser } from 'react-icons/fa';

const BottomNav = () => {
  const { pathname } = useLocation();
  const links = [
    { to: '/matching', icon: FaFire, label: 'Discover' },
    { to: '/chat', icon: FaComments, label: 'Chat' },
    { to: '/history', icon: FaHeart, label: 'Likes' },
    { to: '/profile', icon: FaUser, label: 'Profile' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-30">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {links.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all ${active ? 'text-violet-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Icon size={active ? 22 : 20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
