"use client";

import { useEffect, useState } from "react";

export function useStagedSteps(steps: string[], active: boolean, intervalMs = 2600): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }
    const t = setInterval(() => setStage((s) => Math.min(s + 1, steps.length - 1)), intervalMs);
    return () => clearInterval(t);
  }, [active, steps.length, intervalMs]);
  return stage;
}
