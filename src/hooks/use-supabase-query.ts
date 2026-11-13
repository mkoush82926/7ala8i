import { useState, useEffect, useCallback, useRef } from "react";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  /** True while any request is in flight (first load or refetch). */
  loading: boolean;
  /** True only until the first request settles — use it to gate full-page skeletons. */
  initialLoading: boolean;
  /** True while a refetch runs with previous data still on screen. */
  refreshing: boolean;
  refetch: () => void;
}

interface QueryOptions {
  enabled?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

type QueryFnResult<T> = { data: T | null; error: { message: string } | null };

/**
 * Custom hook for Supabase queries with loading, error, retry, and refetch.
 *
 * - Previous data stays on screen while a refetch runs (no flashing skeletons).
 * - Responses from superseded requests (e.g. an older search term that comes
 *   back late) are discarded, so the UI never shows results for stale input.
 * - Pending retries are cancelled on unmount / dependency change.
 *
 * @param queryFn - Async function that returns `{ data, error }` (Supabase shape)
 * @param deps - Dependency array to re-run the query
 * @param options - Optional config for retry and enabled state
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<QueryFnResult<T>>,
  deps: unknown[] = [],
  options: QueryOptions = {},
): QueryState<T> {
  const { enabled = true, retryCount = 1, retryDelay = 2000 } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [settledOnce, setSettledOnce] = useState(false);

  const retriesRef = useRef(0);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always call the latest queryFn without making it a dependency.
  const queryFnRef = useRef(queryFn);
  useEffect(() => {
    queryFnRef.current = queryFn;
  });

  const clearRetry = () => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const execute = useCallback(async () => {
    clearRetry();
    const requestId = ++requestIdRef.current;
    const isCurrent = () => mountedRef.current && requestId === requestIdRef.current;

    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const scheduleRetry = () => {
      retriesRef.current++;
      retryTimerRef.current = setTimeout(() => {
        if (isCurrent()) execute();
      }, retryDelay);
    };

    try {
      const result = await queryFnRef.current();
      if (!isCurrent()) return;

      if (result.error) {
        if (retriesRef.current < retryCount) {
          scheduleRetry();
          return;
        }
        setError(result.error.message || "Request failed");
        setData(null);
      } else {
        setData(result.data);
        retriesRef.current = 0;
      }
    } catch (err) {
      if (!isCurrent()) return;
      if (retriesRef.current < retryCount) {
        scheduleRetry();
        return;
      }
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setData(null);
    }

    if (isCurrent()) {
      setLoading(false);
      setSettledOnce(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, retryCount, retryDelay]);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    execute();
    return () => {
      mountedRef.current = false;
      clearRetry();
    };
  }, [execute]);

  const refetch = useCallback(() => {
    retriesRef.current = 0;
    execute();
  }, [execute]);

  const initialLoading = enabled && !settledOnce;

  return {
    data,
    error,
    loading,
    initialLoading,
    refreshing: loading && settledOnce,
    refetch,
  };
}
