import React, { createContext, useEffect, useState, useRef, useCallback } from 'react';
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
  isLoadingNotifications: boolean;
  hasNewNotifications: boolean;
  acknowledgeNewNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

type HistoryLocationState = { focusUserId: number };

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const pollTimeout = useRef<number | undefined>(undefined);
  const failureCount = useRef(0);
  const isMounted = useRef(true);
  const navigate = useNavigate();

  const getToken = () => localStorage.getItem('token');

  const addToast = useCallback((
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    onClick?: () => void
  ) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type, onClick }]);
  }, []);

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchNotifications = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      setIsLoadingNotifications(true);
      const res = await fetch(`${API_URL}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: NotificationItem[] = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  // Build WebSocket URL without token in URL — use subprotocol header instead
  const buildWsUrl = () => {
    if (API_URL.startsWith('http')) {
      return API_URL.replace(/^http/, 'ws') + '/ws';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${API_URL}/ws`;
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data) as {
        type: string;
        data?: {
          notification?: {
            id: number;
            is_read?: boolean;
            title?: string;
            message?: string;
            created_at?: string;
            type: string;
            related_user_id?: number | null;
          };
        };
      };

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
        setHasNewNotifications(true);

        let onClick: (() => void) | undefined;
        if (incoming.type === 'like' || incoming.type === 'super_like') {
          const targetUserId = incoming.related_user_id;
          onClick = () => navigate(targetUserId ? '/history' : '/history', {
            state: { focusUserId: targetUserId } as HistoryLocationState,
          });
        } else if (incoming.type === 'match' || incoming.type === 'message') {
          onClick = () => navigate('/chat');
        }

        addToast(incoming.title || 'New Notification', 'info', onClick);
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  }, [navigate, addToast]);

  const connectWs = useCallback(() => {
    if (!isMounted.current) return;
    const token = getToken();
    if (!token) return;

    // Always close the previous socket before opening a new one
    if (ws.current) {
      ws.current.onclose = null; // prevent recursive reconnect on manual close
      ws.current.onerror = null;
      ws.current.close();
      ws.current = null;
    }

    // Pass token as query param (required by FastAPI WS endpoint)
    const url = `${buildWsUrl()}?token=${token}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (!isMounted.current) { socket.close(); return; }
      setIsConnected(true);
      reconnectAttempts.current = 0;
      fetchNotifications();
    };

    socket.onmessage = handleMessage;

    socket.onclose = () => {
      if (!isMounted.current) return;
      setIsConnected(false);
      ws.current = null;
      // Exponential backoff reconnect: 2s, 4s, 8s … capped at 60s
      const delay = Math.min(2000 * Math.pow(2, reconnectAttempts.current), 60000);
      reconnectAttempts.current += 1;
      reconnectTimeout.current = window.setTimeout(connectWs, delay);
    };

    socket.onerror = () => {
      // onerror is always followed by onclose, so reconnect happens there
      setIsConnected(false);
    };
  }, [fetchNotifications, handleMessage]);

  // Initial connection
  useEffect(() => {
    isMounted.current = true;
    const token = getToken();
    if (!token) return;

    // Verify token is valid before connecting
    fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) { localStorage.removeItem('token'); return; }
        connectWs();
      })
      .catch(() => {/* network error — skip WS for now */});

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimeout.current);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connectWs]);

  // Polling fallback (for when WS is down)
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let active = true;

    const scheduleNext = (ok: boolean) => {
      if (!active) return;
      failureCount.current = ok ? 0 : Math.min(failureCount.current + 1, 5);
      const delay = Math.min(30000 * Math.pow(2, failureCount.current), 300000) + (Math.random() - 0.5) * 5000;
      pollTimeout.current = window.setTimeout(poll, Math.max(5000, delay));
    };

    const poll = async () => {
      const t = getToken();
      if (!t) return;
      try {
        const res = await fetch(`${API_URL}/notifications/unread?limit=10`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (!res.ok) { scheduleNext(false); return; }
        const data = await res.json() as { count: number };
        setUnreadCount(prev => {
          if (data.count > prev) {
            setHasNewNotifications(true);
            fetchNotifications();
          }
          return data.count;
        });
        scheduleNext(true);
      } catch {
        scheduleNext(false);
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(pollTimeout.current);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: number) => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setHasNewNotifications(false);
    } catch (e) {
      console.error(e);
    }
  };

  const acknowledgeNewNotifications = () => setHasNewNotifications(false);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      markAsRead,
      markAllAsRead,
      isConnected,
      refreshNotifications: fetchNotifications,
      addToast,
      isLoadingNotifications,
      hasNewNotifications,
      acknowledgeNewNotifications,
    }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={removeToast}
            onClick={toast.onClick}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
