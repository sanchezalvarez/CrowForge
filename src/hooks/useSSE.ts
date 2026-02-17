import { useState, useCallback, useRef } from 'react';

const STREAM_TIMEOUT_MS = 120_000; // 2 minutes

function friendlyError(serverMsg: string): string {
    const lower = serverMsg.toLowerCase();
    if (lower.includes("timeout") || lower.includes("timed out"))
        return "Generation timed out — the AI model is too slow. Try reducing max tokens or using a smaller model.";
    if (lower.includes("json") || lower.includes("parse") || lower.includes("invalid"))
        return "The AI model returned malformed output. This often happens with smaller models — try lowering creativity or using a different model.";
    if (lower.includes("out of memory") || lower.includes("oom") || lower.includes("memory"))
        return "The AI model ran out of memory. Try a smaller or more quantized model.";
    if (lower.includes("model") && lower.includes("not found"))
        return "AI model file not found. Check your model path in settings.";
    if (lower.includes("connection") || lower.includes("refused"))
        return "Could not connect to the AI engine. Make sure the backend is running.";
    return serverMsg || "Generation failed on the server. Please try again.";
}

export interface AIDebugInfo {
    engine_name: string;
    final_system_prompt: string;
    final_user_prompt: string;
    generation_params: {
        temperature: number;
        top_p: number;
        max_tokens: number;
        seed: number | null;
    };
    latency_ms: number;
    token_estimate: number;
    response_chars: number;
}

export const useSSE = () => {
    const [streamedText, setStreamedText] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationFinished, setGenerationFinished] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<AIDebugInfo | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const startStream = useCallback((url: string) => {
        setStreamedText("");
        setIsGenerating(true);
        setGenerationFinished(false);
        setError(null);
        setDebugInfo(null);

        let done = false;
        const eventSource = new EventSource(url);

        const cleanup = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };

        // Timeout: close stream if no completion within limit
        cleanup();
        timeoutRef.current = setTimeout(() => {
            if (!done) {
                done = true;
                setError("Generation timed out. The AI engine may be overloaded. Please try again.");
                setIsGenerating(false);
                eventSource.close();
            }
        }, STREAM_TIMEOUT_MS);

        eventSource.onmessage = (event) => {
            const data = event.data;

            if (data === "[DONE]") {
                done = true;
                cleanup();
                setIsGenerating(false);
                setGenerationFinished(true);
                eventSource.close();
                return;
            }

            if (data.startsWith("[DEBUG]")) {
                try {
                    const payload = JSON.parse(data.slice(7));
                    setDebugInfo(payload);
                } catch { /* ignore parse errors */ }
                return;
            }

            if (data.startsWith("[ERROR]")) {
                done = true;
                cleanup();
                const serverMsg = data.slice(7).trim();
                setError(friendlyError(serverMsg));
                setIsGenerating(false);
                eventSource.close();
                return;
            }

            setStreamedText((prev) => prev + data);
        };

        eventSource.onerror = () => {
            if (!done) {
                done = true;
                cleanup();
                setError("Connection lost. Check that the backend is running and try again.");
                setIsGenerating(false);
            }
            eventSource.close();
        };

        return () => {
            done = true;
            cleanup();
            eventSource.close();
            setIsGenerating(false);
        };
    }, []);

    const reset = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setStreamedText("");
        setIsGenerating(false);
        setGenerationFinished(false);
        setError(null);
        setDebugInfo(null);
    }, []);

    return {
        streamedText,
        isGenerating,
        generationFinished,
        error,
        debugInfo,
        startStream,
        reset
    };
};
