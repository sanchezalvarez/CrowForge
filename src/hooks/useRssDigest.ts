import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export interface DigestState {
  digest: string;
  isGenerating: boolean;
  lastGenerated: string;
  articleCount: number;
}

export function useRssDigest() {
  const [digest, setDigest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState("");
  const [articleCount, setArticleCount] = useState(0);
  const [error, setError] = useState("");

  const loadCached = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/rss/digest/cached`);
      if (res.data.digest) setDigest(res.data.digest);
      if (res.data.last_generated) setLastGenerated(res.data.last_generated);
      if (res.data.article_count) setArticleCount(res.data.article_count);
    } catch {
      // silent
    }
  }, []);

  const generateDigest = useCallback(async () => {
    setIsGenerating(true);
    setError("");
    setDigest("");

    // First fetch new articles
    try {
      await axios.post(`${API_BASE}/rss/fetch`);
    } catch {
      // continue even if fetch fails
    }

    // Then stream digest
    return new Promise<void>((resolve) => {
      const es = new EventSource(`${API_BASE}/rss/digest`);
      // Note: POST /rss/digest — but EventSource only does GET.
      // We use GET /rss/digest with a workaround: trigger via fetch streaming
      es.close();

      // Use fetch + ReadableStream for SSE POST
      let accumulated = "";
      fetch(`${API_BASE}/rss/digest`, { method: "POST" })
        .then((res) => {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          function read() {
            reader.read().then(({ done, value }) => {
              if (done) {
                setIsGenerating(false);
                setLastGenerated(new Date().toISOString());
                resolve();
                return;
              }
              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const chunk = line.slice(6);
                  if (chunk === "[DONE]") {
                    setIsGenerating(false);
                    setLastGenerated(new Date().toISOString());
                    resolve();
                    return;
                  }
                  if (chunk.startsWith("[ERROR]")) {
                    setError(chunk.slice(8));
                    setIsGenerating(false);
                    resolve();
                    return;
                  }
                  accumulated += chunk;
                  setDigest(accumulated);
                }
              }
              read();
            });
          }
          read();
        })
        .catch((e) => {
          setError(String(e));
          setIsGenerating(false);
          resolve();
        });
    });
  }, []);

  return { digest, isGenerating, lastGenerated, articleCount, error, loadCached, generateDigest };
}
