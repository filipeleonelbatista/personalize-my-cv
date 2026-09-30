import { describe, expect, it, vi, afterEach } from "vitest";
import { useStagedSteps } from "../lib/use-staged-steps";
import { act, renderHookForTest } from "./__mocks__/hook-harness";

describe("useStagedSteps", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances stages on a timer while active", async () => {
    vi.useFakeTimers();
    const { result } = renderHookForTest(() => useStagedSteps(["a", "b", "c"], true, 1000));
    expect(result.current).toBe(0);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(2);
  });

  it("resets when inactive", async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHookForTest(({ active }: { active: boolean }) => useStagedSteps(["a", "b"], active, 1000), {
      initialProps: { active: true },
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
    await act(async () => {
      rerender({ active: false });
    });
    expect(result.current).toBe(0);
  });
});
