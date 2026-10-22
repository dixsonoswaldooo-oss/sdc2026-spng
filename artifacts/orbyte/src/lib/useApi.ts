import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { getDataSource, getVersion, getWorkspace, subscribe } from '@/api/client';

/** The mock Orbyte workspace (company, people, credits); updates when the Google Sheet is read. */
export function useWorkspace() {
  useSyncExternalStore(subscribe, getVersion);
  return getWorkspace();
}

/** Whether the demo runs on the Google Sheet or the built-in data, and why if the sheet failed. */
export function useDataSource() {
  useSyncExternalStore(subscribe, getVersion);
  return getDataSource();
}

interface ApiState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/**
 * Loads data from a client function, e.g. useApi(getProjection, ids).
 * Reloads when the arguments change, when retry() is called, and after any change made through the client
 * (an approval anywhere updates every screen). Old data stays on screen while reloading.
 */
export function useApi<A extends unknown[], T>(load: (...args: A) => Promise<T>, ...args: A) {
  const changes = useSyncExternalStore(subscribe, getVersion);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ApiState<T>>({ loading: true });
  const key = JSON.stringify(args); // stable dependency for the argument values

  useEffect(() => {
    let current = true;
    setState((s) => ({ ...s, loading: true }));
    load(...(JSON.parse(key) as A)).then(
      (data) => current && setState({ data, loading: false }),
      (error: Error) => current && setState((s) => ({ ...s, error, loading: false })),
    );
    return () => {
      current = false;
    };
  }, [load, key, changes, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
