"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxFilterProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  id?: string;
  label?: string;
}

export function ComboboxFilter({
  options,
  value,
  onChange,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  className,
  id,
  label,
}: ComboboxFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground mb-1 block">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center justify-between h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer hover:border-primary/50 transition-colors",
          !value && "text-muted-foreground"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Effacer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-md">
          {/* Search input */}
          <div className="p-2 border-b">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          {/* Options list */}
          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
            aria-label={label || placeholder}
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">Aucun résultat</li>
            )}
            {filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors",
                    isSelected && "bg-muted font-medium"
                  )}
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isSelected ? "text-primary" : "invisible"
                    )}
                  />
                  <span>{option.label}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
