import React, { useState } from 'react';
import { useNotification } from '../context/useNotification';
import { FaBell } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleNotificationClick = (n: { id: number; is_read: boolean; notification_type: string }) => {
      if (!n.is_read) {
          markAsRead(n.id);
      }
      setIsOpen(false);
      
      // Navigate based on type
      switch (n.notification_type) {
        case 'message':
        case 'match':
            navigate('/chat');
            break;
        case 'like':
        case 'super_like':
            navigate('/history');
            break;
        case 'profile_view':
            navigate('/profile');
            break;
        default:
            break;
      }
  };

  return (
    <div className="relative">
      <button 
        onClick={toggleOpen}
        className="p-2 text-gray-600 hover:text-rose-600 focus:outline-none"
      >
        <FaBell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 ring-1 ring-black ring-opacity-5">
          <div className="py-2">
            <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-rose-500 hover:text-rose-700">
                        Mark all read
                    </button>
                )}
            </div>
            <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-500 text-sm">
                        No notifications
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div 
                            key={n.id}
                            onClick={() => handleNotificationClick(n)}
                            className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 ${!n.is_read ? 'bg-rose-50' : 'bg-white'}`}
                        >
                            <div className="flex justify-between items-start">
                                <p className={`text-sm ${!n.is_read ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                    {n.title}
                                </p>
                                {!n.is_read && (
                                    <span className="h-2 w-2 bg-rose-500 rounded-full mt-1.5 flex-shrink-0"></span>
                                )}
                            </div>
                            <p className={`text-sm mt-1 ${!n.is_read ? 'text-gray-800' : 'text-gray-500'}`}>{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(n.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    ))
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
