import { useEffect, useState } from "react";

function currentMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Subscribes to the wall clock and returns the current local time as minutes
 * past midnight. Re-renders the consumer at most once per minute, on the
 * minute boundary — so countdowns stay accurate without needlessly rerendering
 * the whole subtree every second.
 */
export function useNowMinutes(): number {
  const [now, setNow] = useState<number>(currentMinutes);

  useEffect(() => {
    // Align the first tick to the next minute boundary so updates land near
    // :00 of every minute rather than drifting based on mount time.
    const msUntilNextMinute = 60_000 - (Date.now() % 60_000);

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      setNow(currentMinutes());
      intervalId = setInterval(() => setNow(currentMinutes()), 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return now;
}
