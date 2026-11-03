import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api';

/** Runs load() on mount and whenever deps change; reload() runs it again on demand. */
export function useResource(load, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableLoad = useCallback(load, deps);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    stableLoad()
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((err) => !cancelled && setState((s) => ({ data: s.data, error: errorMessage(err), loading: false })));
    return () => {
      cancelled = true;
    };
  }, [stableLoad, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
