"use client";

import { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebouncedSearchInputProps {
  /** Current value from URL */
  value: string;
  /** Called with trimmed value after debounce */
  onSearch: (value: string) => void;
  /** Debounce delay in ms (default: 300) */
  delay?: number;
  placeholder?: string;
  className?: string;
  id?: string;
  label?: string;
}

export function DebouncedSearchInput({
  value,
  onSearch,
  delay = 300,
  placeholder = "Rechercher...",
  className,
  id,
  label,
}: DebouncedSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Sync input with URL on back/forward navigation
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (inputValue: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(inputValue.trim());
    }, delay);
  };

  const handleClear = () => {
    if (inputRef.current) inputRef.current.value = "";
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSearch("");
  };

  return (
    <div className={cn(className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground mb-1 block">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Effacer la recherche"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
