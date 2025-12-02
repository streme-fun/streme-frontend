"use client";

import { useRef, useState, useEffect } from "react";
import { useTypesenseSearch } from "../hooks/useTypesenseSearch";
import Link from "next/link";
import SafeImage from "./SafeImage";
import { TypesenseToken } from "../lib/typesenseClient";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSelectToken?: (contractAddress: string) => void;
  showSuggestions?: boolean;
  onSearchResultsChange?: (results: TypesenseToken[]) => void;
}

export function SearchBar({
  value,
  onChange,
  onSelectToken,
  showSuggestions = true,
  onSearchResultsChange,
}: SearchBarProps) {
  const { results, isLoading } = useTypesenseSearch(value, {
    debounceMs: 200,
    limit: 8,
  });

  // Notify parent of search results (onSearchResultsChange is stable due to useCallback in parent)
  useEffect(() => {
    if (onSearchResultsChange) {
      onSearchResultsChange(results);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    // Show dropdown when user types
    if (newValue.trim().length > 0) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const handleSelectToken = (contractAddress: string) => {
    if (onSelectToken) {
      onSelectToken(contractAddress);
    }
    setShowDropdown(false);
  };

  const shouldShowDropdown =
    showSuggestions && showDropdown && value.trim().length > 0;

  return (
    <div className="form-control w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search by Token or User"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (value.trim().length > 0) {
              setShowDropdown(true);
            }
          }}
          className="input input-bordered w-full pr-10 text-base
            focus:input-primary transition-all duration-200
            placeholder:text-base-content/50"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none opacity-50">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {shouldShowDropdown && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-base-100 border border-base-300 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm opacity-60">
                Searching...
              </div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-base-300">
                {results.map((token) => (
                  <Link
                    key={token.id}
                    href={`/token/${token.contract_address}`}
                  >
                    <div
                      onClick={() => handleSelectToken(token.contract_address)}
                      className="p-3 hover:bg-base-200 cursor-pointer transition-colors flex items-center gap-3"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full overflow-hidden flex items-center justify-center">
                        {token.img_url ? (
                          <SafeImage
                            src={token.img_url}
                            alt={token.name}
                            width={32}
                            height={32}
                            className="object-cover"
                            unoptimized={
                              token.img_url?.includes(".gif") ||
                              token.img_url?.includes("imagedelivery.net")
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-sm">
                            ${token.symbol?.slice(0, 1) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{token.name}</div>
                        <div className="text-xs opacity-60 truncate">
                          {token.symbol}
                          {token.username && ` • @${token.username}`}
                        </div>
                      </div>
                      {token.market_cap !== undefined && (
                        <div className="flex-shrink-0 text-xs opacity-60 font-mono">
                          $
                          {token.market_cap >= 1000000
                            ? `${(token.market_cap / 1000000).toFixed(1)}M`
                            : token.market_cap >= 1000
                            ? `${(token.market_cap / 1000).toFixed(1)}K`
                            : token.market_cap.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm opacity-60">
                No tokens found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
