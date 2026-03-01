"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_GROUPS, NAV_TOP_LEVEL, CTA_COMPARER, CTA_ASSISTANT } from "@/config/navigation";
import {
  GitCompare,
  Bot,
  Map,
  MapPin,
  Radio,
  Newspaper,
  ShieldCheck,
  Scale,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { GlobalSearchTrigger } from "@/components/search";

const ICON_MAP: Record<string, LucideIcon> = {
  map: Map,
  mapPin: MapPin,
  live: Radio,
  newspaper: Newspaper,
  shieldCheck: ShieldCheck,
  scale: Scale,
  BookOpen: BookOpen,
};

// Get all focusable elements within a container
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(elements);
}

interface MobileMenuProps {
  /** Enabled feature flag names, passed from server component */
  enabledFlags?: string[];
}

export function MobileMenu({ enabledFlags = [] }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const flagSet = new Set(enabledFlags);
  const isVisible = (flag?: string) => !flag || flagSet.has(flag);

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isVisible(item.featureFlag)),
  })).filter((group) => group.items.length > 0);

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
            lastElement!.focus();
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement!.focus();
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
          setTimeout(() => focusableElements[0]!.focus(), 10);
        }
      }
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Close menu on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with navigation
  useEffect(() => setIsOpen(false), [pathname]);

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
            {/* Global search */}
            <div className="mb-4">
              <GlobalSearchTrigger variant="mobile" onBeforeOpen={() => setIsOpen(false)} />
            </div>

            {/* Transparency links (top priority) */}
            <div className="flex gap-2 mb-4">
              {NAV_TOP_LEVEL.map((item) => {
                const Icon = item.icon ? ICON_MAP[item.icon] : null;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "border border-border hover:bg-muted/50"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {Icon && <Icon className="h-5 w-5" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-2 mb-4">
              {isVisible(CTA_COMPARER.featureFlag) && (
                <Link
                  href={CTA_COMPARER.href}
                  onClick={() => setIsOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted/50"
                >
                  <GitCompare className="h-5 w-5" />
                  {CTA_COMPARER.label}
                </Link>
              )}
              {isVisible(CTA_ASSISTANT.featureFlag) && (
                <Link
                  href={CTA_ASSISTANT.href}
                  onClick={() => setIsOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-border font-medium rounded-lg hover:bg-muted/50"
                >
                  <Bot className="h-5 w-5" />
                  {CTA_ASSISTANT.label}
                </Link>
              )}
            </div>

            {/* Navigation groups */}
            {filteredGroups.map((group) => (
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
                              const Icon = ICON_MAP[item.icon!]!;
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
