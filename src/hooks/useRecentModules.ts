import { useState, useEffect } from 'react';

const STORAGE_KEY = 'neoconcepto_recent_modules';
const MAX_RECENT = 3;

export function useRecentModules() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setRecentIds(JSON.parse(stored));
      } catch {
        setRecentIds([]);
      }
    }
  }, []);

  const addRecent = (moduleId: string) => {
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== moduleId);
      const updated = [moduleId, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return { recentIds, addRecent };
}
