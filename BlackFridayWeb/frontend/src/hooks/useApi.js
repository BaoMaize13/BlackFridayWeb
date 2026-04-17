import { useCallback, useMemo, useState } from "react";

import { mapErrorToMessage } from "../utils/errors";

export function useApi(apiFunction, options = {}) {
  const [state, setState] = useState({
    data: options.initialData ?? null,
    loading: Boolean(options.immediate),
    error: null
  });

  const execute = useCallback(
    async (...args) => {
      setState((current) => ({
        ...current,
        loading: true,
        error: null
      }));

      try {
        const data = await apiFunction(...args);
        setState({
          data,
          loading: false,
          error: null
        });
        return data;
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: mapErrorToMessage(error, options.fallbackMessage)
        }));
        throw error;
      }
    },
    [apiFunction, options.fallbackMessage]
  );

  const reset = useCallback(() => {
    setState({
      data: options.initialData ?? null,
      loading: false,
      error: null
    });
  }, [options.initialData]);

  return useMemo(
    () => ({
      ...state,
      execute,
      reset
    }),
    [state, execute, reset]
  );
}
