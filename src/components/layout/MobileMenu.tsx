"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_GROUPS, CTA_COMPARER, CTA_MON_DEPUTE, CHAT_LINK } from "@/config/navigation";
import {
  MapPin,
  GitCompare,
  MessageSquare,
  Map,
  Radio,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  map: Map,
  live: Radio,
  newspaper: Newspaper,
};

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(elements);
}

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard navigation (Escape to close, Tab for focus trap)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }

      // Focus trap: keep Tab navigation within the menu
      if (event.key === "Tab" && isOpen && menuRef.current) {
        const focusableElements = getFocusableElements(menuRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          // Shift+Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [isOpen]
  );

  // Add/remove keyboard listener when menu opens/closes
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Focus first link when menu opens
      if (menuRef.current) {
        const focusableElements = getFocusableElements(menuRef.current);
        if (focusableElements.length > 0) {
          // Small delay to ensure DOM is ready
          setTimeout(() => focusableElements[0].focus(), 10);
        }
      }
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      {/* Hamburger button */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-menu"
        >
          {isOpen ? (
            // X icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            // Menu icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          id="mobile-menu"
          className="absolute top-16 left-0 right-0 bg-background border-b shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <nav className="container mx-auto px-4 py-4" aria-label="Navigation mobile">
            {/* CTA Buttons */}
            <div className="flex gap-2 mb-4">
              <Link
                href={CTA_MON_DEPUTE.href}
                onClick={() => setIsOpen(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground font-medium rounded-lg"
              >
                <MapPin className="h-5 w-5" />
                {CTA_MON_DEPUTE.label}
              </Link>
              <Link
                href={CTA_COMPARER.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted/50"
              >
                <GitCompare className="h-5 w-5" />
                <span className="sr-only sm:not-sr-only">{CTA_COMPARER.label}</span>
              </Link>
              <Link
                href={CHAT_LINK.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted/50"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="sr-only">{CHAT_LINK.label}</span>
              </Link>
            </div>

            {/* Navigation groups */}
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <p className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  {group.label}
                </p>
                <ul className="space-y-1" role="list">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setIsOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 text-base rounded-lg transition-colors ${
                            isActive
                              ? "text-foreground bg-accent font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          }`}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {item.icon &&
                            ICON_MAP[item.icon] &&
                            (() => {
                              const Icon = ICON_MAP[item.icon!];
                              return <Icon className="h-5 w-5 shrink-0" />;
                            })()}
                          <div>
                            <span>{item.label}</span>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
