import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from './api';

type Options<T> = { interval?: number; pollMs?: number; initial?: T; deps?: unknown[] };

export function useApiData<T>(url: string | null, options: Options<T> = {}) {
  const [data, setData] = useState<T | undefined>(options.initial);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');
  const request = useRef(0);
  const poll = options.pollMs ?? options.interval;

  const reload = useCallback(async (silent = false) => {
    if (!url) {
      setLoading(false);
      return undefined;
    }
    const id = ++request.current;
    if (!silent) setLoading(true);
    setError('');
    try {
      const value = await api<T>(url);
      if (request.current === id) setData(value);
      return value;
    } catch (cause) {
      if (request.current === id) setError(errorText(cause));
      return undefined;
    } finally {
      if (request.current === id && !silent) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
    if (!url || !poll) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload(true);
    }, poll);
    return () => window.clearInterval(timer);
    // Explicit deps let callers force a reload when a tab or prerequisite changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, url, poll, ...(options.deps ?? [])]);

  return { data, setData, loading, error, reload };
}
