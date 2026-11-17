"use client";

import {
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info" | "default";

export type ToastOptions = {
  title?: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
};

type ToastRecord = {
  id: number;
  message: string;
  title?: string;
  description?: string;
  tone: ToastTone;
  duration: number;
};

let nextId = 1;
let toasts: ToastRecord[] = [];
const listeners = new Set<() => void>();
const EMPTY_TOASTS: ToastRecord[] = [];

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getToastsSnapshot() {
  return toasts;
}

function getServerToastsSnapshot() {
  return EMPTY_TOASTS;
}

function pushToast(
  message: string,
  options: ToastOptions = {},
): number {
  const id = nextId++;
  const entry: ToastRecord = {
    id,
    message,
    title: options.title,
    description: options.description,
    tone: options.tone ?? "default",
    duration: options.duration ?? 3200,
  };
  toasts = [...toasts, entry];
  emit();
  window.setTimeout(() => {
    dismissToast(id);
  }, entry.duration);
  return id;
}

function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Imperative toast API (Sonner-style). */
export function toast(
  message: string,
  options?: ToastOptions,
): number {
  return pushToast(message, options);
}

toast.success = (message: string, options?: ToastOptions) =>
  pushToast(message, { ...options, tone: "success" });

toast.error = (message: string, options?: ToastOptions) =>
  pushToast(message, { ...options, tone: "error" });

toast.info = (message: string, options?: ToastOptions) =>
  pushToast(message, { ...options, tone: "info" });

/** Alias used by older call sites. */
export function showToast(
  message: string,
  tone: ToastTone = "default",
  description?: string,
): number {
  return pushToast(message, { tone, description });
}

const TONE_CLASS: Record<ToastTone, string> = {
  default:
    "border-border bg-card text-card-foreground",
  success:
    "border-income/30 bg-income-muted text-income",
  error:
    "border-expense/30 bg-expense-muted text-expense",
  info:
    "border-primary/30 bg-primary-muted text-primary",
};

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    getToastsSnapshot,
    getServerToastsSnapshot,
  );

  const onDismiss = useCallback((id: number) => {
    dismissToast(id);
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end"
      aria-live="polite"
      aria-relevant="additions"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-soft animate-fade-slide-in",
            TONE_CLASS[item.tone],
          )}
        >
          <div className="min-w-0 flex-1">
            {item.title ? (
              <p className="text-sm font-semibold">{item.title}</p>
            ) : null}
            <p className={cn("text-sm", item.title ? "opacity-90" : "font-medium")}>
              {item.message}
            </p>
            {item.description ? (
              <p className="mt-0.5 text-sm opacity-80">{item.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-current/70 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export type { ReactNode as ToastReactNode };
