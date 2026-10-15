import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotifications,
  markRead,
  markAllRead,
  subscribeNotifications,
} from './notifications.js';

export function useNotifications(userId) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) return undefined;
    fetchNotifications()
      .then(setItems)
      .catch((e) => console.warn('[notif]', e.message));
    return subscribeNotifications(userId, (n) => setItems((prev) => [n, ...prev]));
  }, [userId]);

  const unread = items.filter((n) => !n.read_at).length;

  const read = useCallback((id) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read_at: now } : x)));
    markRead(id).catch(() => {});
  }, []);

  const readAll = useCallback(() => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? now })));
    markAllRead().catch(() => {});
  }, []);

  return { items, unread, read, readAll };
}