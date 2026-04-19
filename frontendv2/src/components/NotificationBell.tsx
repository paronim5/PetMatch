import React, { useState } from 'react';
import { useNotification } from '../context/useNotification';
import { FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, hasNewNotifications, acknowledgeNewNotifications } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) acknowledgeNewNotifications();
  };

  const handleNotificationClick = (n: { id: number; is_read: boolean; notification_type: string }) => {
    if (!n.is_read) markAsRead(n.id);
    setIsOpen(false);
    switch (n.notification_type) {
      case 'message': case 'match': navigate('/chat'); break;
      case 'like': case 'super_like': navigate('/history'); break;
      case 'profile_view': navigate('/profile'); break;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className={`relative w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-gray-800 ${hasNewNotifications ? 'animate-bounce' : ''}`}
      >
        <FaBell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`px-4 py-3 cursor-pointer border-b border-gray-800 last:border-0 transition-colors ${!n.is_read ? 'bg-violet-500/5 hover:bg-violet-500/10' : 'hover:bg-gray-800'}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className={`text-sm ${!n.is_read ? 'font-bold text-white' : 'text-gray-300'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <div className="w-2 h-2 bg-violet-400 rounded-full flex-shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
