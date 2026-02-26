import { useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

let toasts: Toast[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((l) => l());
}

const MAX_TOASTS = 10;

export function toast(message: string, variant: ToastVariant = "success") {
  const id = nextId++;
  toasts = [...toasts, { id, message, variant }];
  // Keep only the most recent toasts to prevent memory buildup
  if (toasts.length > MAX_TOASTS) {
    toasts = toasts.slice(-MAX_TOASTS);
  }
  emit();
  timers.set(id, setTimeout(() => {
    timers.delete(id);
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3500));
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) { clearTimeout(timer); timers.delete(id); }
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function getSnapshot() {
  return toasts;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useToastState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
