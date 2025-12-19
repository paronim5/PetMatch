import React, { createContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import Toast from '../components/Toast';

interface NotificationItem {
  id: number;
  user_id?: number;
  notification_type: string;
  title?: string | null;
  message?: string | null;
  is_read: boolean;
  related_user_id?: number | null;
  related_match_id?: number | null;
  related_message_id?: number | null;
  created_at: string;
}

interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  onClick?: () => void;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  isConnected: boolean;
  refreshNotifications: () => void;
  addToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error', onClick?: () => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem('token');

  const addToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', onClick?: () => void) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type, onClick }]);
  };

  const removeToast = (id: number) => {
      setToasts(prev => prev.filter(t => t.id !== id));
  };


  const fetchNotifications = async () => {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_URL}/notifications/`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
            const data: NotificationItem[] = await res.json();
            setNotifications(data);
            setUnreadCount(data.filter((n) => !n.is_read).length);
        }
    } catch (e) {
        console.error(e);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const establishConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          localStorage.removeItem('token');
          setIsConnected(false);
          return;
        }
      } catch {
        return;
      }

      let wsUrl = '';
      if (API_URL.startsWith('http')) {
        wsUrl = API_URL.replace(/^http/, 'ws') + '/ws';
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}${API_URL}/ws`;
      }
      wsUrl += `?token=${token}`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        (async () => {
          try {
            const res = await fetch(`${API_URL}/notifications/`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data: NotificationItem[] = await res.json();
              setNotifications(data);
              setUnreadCount(data.filter((n) => !n.is_read).length);
            }
          } catch (e) {
            console.error(e);
          }
        })();
      };

      ws.current.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as { type: string; data?: { notification?: { id: number; is_read?: boolean; title?: string; message?: string; created_at?: string; type: string } } };
          
          if (parsed.type === 'new_notification' && parsed.data?.notification) {
            const incoming = parsed.data.notification;
            const notif: NotificationItem = {
              id: incoming.id,
              notification_type: incoming.type,
              title: incoming.title ?? null,
              message: incoming.message ?? null,
              is_read: incoming.is_read ?? false,
              created_at: incoming.created_at ?? new Date().toISOString(),
            };
            setNotifications(prev => [notif, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Show Toast
            let onClick: (() => void) | undefined;
            if (incoming.type === 'like' || incoming.type === 'super_like') {
                onClick = () => navigate('/history');
            } else if (incoming.type === 'match') {
                onClick = () => navigate('/chat'); // Or /matching
            } else if (incoming.type === 'message') {
                onClick = () => navigate('/chat');
            }

            addToast(incoming.title || 'New Notification', 'info', onClick);
          }
        } catch (e) {
          console.error('WS Parse Error', e);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
      };
      ws.current.onerror = () => {
        // ... (Error handling remains similar but simplified for brevity in this replace)
         try {
          if (API_URL === '/api') {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const direct = `${protocol}//localhost:8000/api/v1/ws?token=${token}`;
            ws.current = new WebSocket(direct);
            ws.current.onopen = () => {
              setIsConnected(true);
            };
            ws.current.onclose = () => setIsConnected(false);
            ws.current.onmessage = (event) => {
              try {
                const parsed = JSON.parse(event.data) as { type: string; data?: { notification?: { id: number; is_read?: boolean; title?: string; message?: string; created_at?: string; type: string } } };
                if (parsed.type === 'new_notification' && parsed.data?.notification) {
                  const incoming = parsed.data.notification;
                  const notif: NotificationItem = {
                    id: incoming.id,
                    notification_type: incoming.type,
                    title: incoming.title ?? null,
                    message: incoming.message ?? null,
                    is_read: incoming.is_read ?? false,
                    created_at: incoming.created_at ?? new Date().toISOString(),
                  };
                  setNotifications(prev => [notif, ...prev]);
                  setUnreadCount(prev => prev + 1);
                  
                  let onClick: (() => void) | undefined;
                  if (incoming.type === 'like' || incoming.type === 'super_like') {
                      onClick = () => navigate('/history');
                  } else if (incoming.type === 'match') {
                      onClick = () => navigate('/chat');
                  } else if (incoming.type === 'message') {
                      onClick = () => navigate('/chat');
                  }
                  
                  addToast(incoming.title || 'New Notification', 'info', onClick);
                }
              } catch (err) {
                console.error(err);
              }
            };
          }
        } catch (err) {
          console.error(err);
        }
      };

      return () => {
        if (ws.current) ws.current.close();
      };
    };

    establishConnection();
  }, []);

  const markAsRead = async (id: number) => {
      const token = getToken();
      if (!token) return;
      try {
          await fetch(`${API_URL}/notifications/${id}/read`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
          });
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
          setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
          console.error(e);
      }
  };

  const markAllAsRead = async () => {
      const token = getToken();
      if (!token) return;
      try {
          await fetch(`${API_URL}/notifications/read-all`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` }
          });
          setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
          setUnreadCount(0);
      } catch (e) {
          console.error(e);
      }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      isConnected,
      refreshNotifications: fetchNotifications,
      addToast
    }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
              <Toast 
                  key={toast.id}
                  id={toast.id}
                  message={toast.message}
                  type={toast.type}
                  onClose={removeToast}
              />
          ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
