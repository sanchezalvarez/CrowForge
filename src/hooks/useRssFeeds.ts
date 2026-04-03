import { useState, useCallback } from "react";
import axios from "axios";
import { API_BASE } from "../lib/constants";

export interface RssFeed {
  id: number;
  url: string;
  title: string;
  description: string;
  is_active: number;
  created_at: string;
  last_fetched_at: string | null;
  article_count: number;
}

export function useRssFeeds() {
  const [feeds, setFeeds] = useState<RssFeed[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/rss/feeds`);
      setFeeds(res.data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const addFeed = useCallback(async (url: string, title = "") => {
    const res = await axios.post(`${API_BASE}/rss/feeds`, { url, title });
    await loadFeeds();
    return res.data;
  }, [loadFeeds]);

  const deleteFeed = useCallback(async (id: number) => {
    await axios.delete(`${API_BASE}/rss/feeds/${id}`);
    setFeeds((f) => f.filter((x) => x.id !== id));
  }, []);

  const toggleFeed = useCallback(async (id: number, is_active: boolean) => {
    await axios.patch(`${API_BASE}/rss/feeds/${id}`, { is_active });
    setFeeds((f) => f.map((x) => x.id === id ? { ...x, is_active: is_active ? 1 : 0 } : x));
  }, []);

  return { feeds, loading, loadFeeds, addFeed, deleteFeed, toggleFeed };
}
