import { useMemo, useState } from "react";

export function useObjectState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);

  const helpers = useMemo(
    () => ({
      set<K extends keyof T>(key: K, value: T[K]) {
        setState((current) => ({ ...current, [key]: value }));
      },
      replace(next: T) {
        setState(next);
      },
    }),
    [],
  );

  return [state, helpers] as const;
}
