"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDebounce } from "use-debounce";
import { refreshCompaniesAction } from "../actions/mutations";

export function useCompanySearch<T extends { id: string; name: string }>(
  initial: T[],
  enabled: boolean,
) {
  const [q, setQ] = useState("");
  const [term] = useDebounce(q.trim(), 250);
  const query = useQuery({
    queryKey: ["jobboard", "company-search", term],
    enabled: enabled && !!term,
    retry: false,
    queryFn: async () => {
      const result = await refreshCompaniesAction({ q: term });
      if (!result?.data) throw new Error("Company search failed. Try again.");
      return result.data.companies;
    },
  });
  const waiting = term !== q.trim() || query.isLoading;
  const message = waiting ? "Searching companies" : query.error?.message;
  return {
    q,
    setQ,
    rows: q.trim() ? (waiting ? [] : (query.data ?? [])) : initial,
    message,
  };
}
