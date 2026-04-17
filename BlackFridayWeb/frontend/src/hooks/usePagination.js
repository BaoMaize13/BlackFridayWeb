import { useCallback, useMemo, useState } from "react";

export function usePagination(initialState = {}) {
  const [pagination, setPagination] = useState({
    page: initialState.page ?? 1,
    pageSize: initialState.pageSize ?? 10,
    total: initialState.total ?? 0
  });

  const setPage = useCallback((page) => {
    setPagination((current) => ({ ...current, page }));
  }, []);

  const setPageSize = useCallback((pageSize) => {
    setPagination((current) => ({ ...current, pageSize, page: 1 }));
  }, []);

  const setTotal = useCallback((total) => {
    setPagination((current) => ({ ...current, total }));
  }, []);

  const reset = useCallback(() => {
    setPagination({
      page: initialState.page ?? 1,
      pageSize: initialState.pageSize ?? 10,
      total: initialState.total ?? 0
    });
  }, [initialState.page, initialState.pageSize, initialState.total]);

  return useMemo(
    () => ({
      ...pagination,
      totalPages: Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize)),
      setPage,
      setPageSize,
      setTotal,
      reset
    }),
    [pagination, setPage, setPageSize, setTotal, reset]
  );
}
