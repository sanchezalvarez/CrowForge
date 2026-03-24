import { useState, useCallback } from "react";
import axios from "axios";

const API_BASE = "http://127.0.0.1:8000";

export interface DigestState {
  digest: string;
  isGenerating: boolean;
  lastGenerated: string;
  articleCount: number;
}

/** Parse SSE stream buffer. Splits by double-newline (event boundaries),
 *  joins multi-line `data:` fields with \n so markdown newlines are preserved. */
function parseSseBuffer(buf: string): { chunks: string[]; remainder: string } {
  const parts = buf.split("\n\n");
  const remainder = parts.pop() ?? "";
  const chunks: string[] = [];
  for (const part of parts) {
    const dataLines = part.split("\n").filter((l) => l.startsWith("data: "));
    if (dataLines.length > 0) {
      chunks.push(dataLines.map((l) => l.slice(6)).join("\n"));
    }
  }
  return { chunks, remainder };
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

    // Fetch new articles from all feeds (parallel on backend)
    try {
      await axios.post(`${API_BASE}/rss/fetch`);
    } catch {
      // continue even if fetch partially fails
    }

    // Stream digest via proper SSE POST
    return new Promise<void>((resolve) => {
      let accumulated = "";
      let sseBuffer = "";

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

              sseBuffer += decoder.decode(value, { stream: true });
              const { chunks, remainder } = parseSseBuffer(sseBuffer);
              sseBuffer = remainder;

              for (const chunk of chunks) {
                if (chunk === "[DONE]") {
                  setIsGenerating(false);
                  setLastGenerated(new Date().toISOString());
                  resolve();
                  return;
                }
                if (chunk.startsWith("[ERROR]")) {
                  setError(chunk.slice(7).trim());
                  setIsGenerating(false);
                  resolve();
                  return;
                }
                accumulated += chunk;
                setDigest(accumulated);
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
