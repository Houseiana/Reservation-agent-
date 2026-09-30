"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export interface AsyncResult<T> extends AsyncState<T> {
  refetch: () => void;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

export interface UseAsyncOptions {
  /**
   * When false, the fetch is skipped — previous data is kept. Use this
   * to gate calls to a tab/page that isn't currently active so the
   * network only fires when the user opens that view.
   */
  enabled?: boolean;
}

/**
 * useAsync — run an async function (typically an api/* call) and expose
 * { data, error, loading, refetch }. Cancels in-flight requests on
 * dependency change / unmount via AbortController.
 *
 *   const { data: bookings, loading } = useAsync(
 *     (signal) => listBookings({}, signal),
 *     [],
 *     { enabled: page === "bookings" },
 *   );
 */
export function useAsync<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncOptions = {},
): AsyncResult<T> {
  const { enabled = true } = options;
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    const ctrl = new AbortController();
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current(ctrl.signal)
      .then((data) => {
        if (!alive) return;
        setState({ data, error: null, loading: false });
      })
      .catch((err: Error) => {
        if (!alive || err.name === "AbortError") return;
        setState((s) => ({ data: s.data, error: err, loading: false }));
      });
    return () => {
      alive = false;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);
  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setState((s) => ({
      ...s,
      data: typeof updater === "function" ? (updater as (p: T | null) => T)(s.data) : updater,
    }));
  }, []);

  return { ...state, refetch, setData };
}
