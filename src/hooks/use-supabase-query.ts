import { useState, useEffect, useCallback, useRef } from "react";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

interface QueryOptions {
  enabled?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Custom hook for Supabase queries with loading, error, retry, and refetch.
 *
 * @param queryFn - Async function that returns `{ data, error }` (Supabase shape)
 * @param deps - Dependency array to re-run the query
 * @param options - Optional config for retry and enabled state
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[] = [],
  options: QueryOptions = {},
): QueryState<T> {
  const { enabled = true, retryCount = 1, retryDelay = 2000 } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await queryFn();

      if (!mountedRef.current) return;

      if (result.error) {
        if (retriesRef.current < retryCount) {
          retriesRef.current++;
          setTimeout(() => {
            if (mountedRef.current) execute();
          }, retryDelay);
          return;
        }
        setError(result.error.message);
        setData(null);
      } else {
        setData(result.data);
        retriesRef.current = 0;
      }
    } catch (err) {
      if (!mountedRef.current) return;

      if (retriesRef.current < retryCount) {
        retriesRef.current++;
        setTimeout(() => {
          if (mountedRef.current) execute();
        }, retryDelay);
        return;
      }
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setData(null);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  const refetch = useCallback(() => {
    retriesRef.current = 0;
    execute();
  }, [execute]);

  return { data, error, loading, refetch };
}
