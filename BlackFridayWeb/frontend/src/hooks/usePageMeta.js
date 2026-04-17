import { useMemo } from "react";
import { useMatches } from "react-router-dom";

import { PAGE_META } from "../constants/pageMeta";

export function usePageMeta() {
  const matches = useMatches();

  return useMemo(() => {
    const leaf = matches.at(-1);
    const pageKey = leaf?.handle?.pageKey ?? "dashboard";
    return {
      pageKey,
      ...PAGE_META[pageKey]
    };
  }, [matches]);
}
