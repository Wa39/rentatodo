import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/** Agreed with the backend: poll every 15s while the screen is open. */
export const POLL_INTERVAL_MS = 15_000;

/**
 * Runs `callback` immediately on focus and then on an interval, stopping
 * when the screen loses focus or unmounts. This is the project's
 * substitute for push notifications (out of scope by design).
 */
export function usePolling(callback: () => void, intervalMs: number = POLL_INTERVAL_MS) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useFocusEffect(
    useCallback(() => {
      callbackRef.current();
      const id = setInterval(() => callbackRef.current(), intervalMs);
      return () => clearInterval(id);
    }, [intervalMs]),
  );
}
