"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { searchTokens, TypesenseToken } from "../lib/typesenseClient";

interface UseTypesenseSearchOptions {
  debounceMs?: number;
  limit?: number;
  initialQuery?: string;
}

export function useTypesenseSearch(
  externalQuery: string = "",
  options: UseTypesenseSearchOptions = {}
) {
  const { debounceMs = 300, limit = 20 } = options;

  const [results, setResults] = useState<TypesenseToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const searchResults = await searchTokens(searchQuery, limit);
        setResults(searchResults);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Search failed";
        setError(errorMessage);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  // Watch for external query changes and debounce search
  useEffect(() => {
    // Clear existing debounce timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new debounce timer
    debounceTimer.current = setTimeout(() => {
      performSearch(externalQuery);
    }, debounceMs);

    // Cleanup debounce timer on unmount
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [externalQuery, performSearch, debounceMs]);

  return {
    query: externalQuery,
    results,
    isLoading,
    error,
  };
}
