"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/Button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    setPending((current) => {
      current?.resolve(result);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close, pending]);

  const value = useMemo(() => ({ confirm }), [confirm]);
  const tone = pending?.tone ?? "danger";

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center animate-fade-in"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={pending.description ? descId : undefined}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft animate-fade-slide-in"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id={titleId}
              className="font-heading text-lg font-semibold tracking-tight"
            >
              {pending.title}
            </h2>
            {pending.description ? (
              <p
                id={descId}
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                {pending.description}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                ref={confirmRef}
                type="button"
                variant={tone === "danger" ? "danger" : "primary"}
                className="min-h-11"
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
