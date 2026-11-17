"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/money";

type CountUpMoneyProps = {
  valueMinor: number;
  currency: string;
  className?: string;
  durationMs?: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CountUpMoney({
  valueMinor,
  currency,
  className = "",
  durationMs = 700,
}: CountUpMoneyProps) {
  const [display, setDisplay] = useState(valueMinor);
  const fromRef = useRef(valueMinor);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = valueMinor;
      // Defer so setState is not synchronous in the effect body.
      void Promise.resolve().then(() => setDisplay(valueMinor));
      return;
    }

    const from = fromRef.current;
    const to = valueMinor;
    if (from === to) {
      void Promise.resolve().then(() => setDisplay(to));
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
      fromRef.current = to;
    };
  }, [durationMs, valueMinor]);

  return (
    <span className={className}>{formatMoney(display, currency)}</span>
  );
}
