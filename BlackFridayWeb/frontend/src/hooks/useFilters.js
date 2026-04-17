import { useCallback, useMemo, useState } from "react";

export function useFilters(initialFilters) {
  const [filters, setFilters] = useState(initialFilters);

  const updateFilter = useCallback((name, value) => {
    setFilters((current) => ({
      ...current,
      [name]: value
    }));
  }, []);

  const assignFilters = useCallback((patch) => {
    setFilters((current) => ({
      ...current,
      ...patch
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return useMemo(
    () => ({
      filters,
      updateFilter,
      assignFilters,
      resetFilters
    }),
    [filters, updateFilter, assignFilters, resetFilters]
  );
}
