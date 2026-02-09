"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Map,
  MapPin,
  Radio,
  Newspaper,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/config/navigation";

const ICON_MAP: Record<string, LucideIcon> = {
  map: Map,
  mapPin: MapPin,
  live: Radio,
  newspaper: Newspaper,
  shieldCheck: ShieldCheck,
};

interface NavDropdownProps {
  group: NavGroup;
}

// Global state to track which dropdown is open (only one at a time)
let closeAllDropdowns: (() => void)[] = [];

export function NavDropdown({ group }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname();

  // Check if any item in the group is active
  const isGroupActive = group.items.some((item) => pathname.startsWith(item.href));

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
  }, []);

  const openDropdown = useCallback(() => {
    // Close all other dropdowns first
    closeAllDropdowns.forEach((close) => close());
    setIsOpen(true);
  }, []);

  // Register this dropdown's close function
  useEffect(() => {
    closeAllDropdowns.push(closeDropdown);
    return () => {
      closeAllDropdowns = closeAllDropdowns.filter((fn) => fn !== closeDropdown);
    };
  }, [closeDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown when pressing Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Close dropdown when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    openDropdown();
  };

  const handleMouseLeave = () => {
    // Small delay before closing to allow moving to dropdown content
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
          "hover:text-foreground hover:bg-accent",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          isGroupActive ? "text-foreground" : "text-muted-foreground"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {group.label}
        <ChevronDown
          className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[280px] bg-popover border rounded-lg shadow-lg py-2 z-50">
          {group.items.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "block px-4 py-2.5 hover:bg-accent transition-colors",
                  isActive && "bg-accent"
                )}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex items-center gap-2">
                  {item.icon &&
                    ICON_MAP[item.icon] &&
                    (() => {
                      const Icon = ICON_MAP[item.icon!];
                      return <Icon className="h-4 w-4 text-muted-foreground" />;
                    })()}
                  <span className={cn("font-medium", isActive && "text-primary")}>
                    {item.label}
                  </span>
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
