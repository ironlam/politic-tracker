"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_LINKS, FOOTER_LINKS } from "@/config/navigation";

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
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
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
  }, [isOpen]);

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
    <div className="md:hidden">
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
          className="absolute top-16 left-0 right-0 bg-background border-b shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-label="Menu de navigation"
        >
          <nav className="container mx-auto px-4 py-4" aria-label="Navigation mobile">
            <ul className="space-y-1" role="list">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-3 text-base font-medium rounded-lg transition-colors touch-target ${
                        isActive
                          ? "text-foreground bg-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Secondary links */}
            <div className="mt-4 pt-4 border-t">
              <p className="px-4 text-xs text-muted-foreground uppercase tracking-wider mb-2">Plus</p>
              <ul className="space-y-1" role="list">
                {FOOTER_LINKS.filter(l => l.href !== "/mentions-legales").map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
