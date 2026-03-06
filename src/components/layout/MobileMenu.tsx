"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NAV_GROUPS, NAV_TOP_LEVEL, NAV_TOOLS, CTA_ASSISTANT } from "@/config/navigation";
import {
  ArrowLeftRight,
  Bot,
  Map,
  MapPin,
  Radio,
  Newspaper,
  ShieldCheck,
  Scale,
  BookOpen,
  Calendar,
  CalendarDays,
  BarChart3,
  Vote,
  Landmark,
  Search,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  map: Map,
  mapPin: MapPin,
  live: Radio,
  newspaper: Newspaper,
  shieldCheck: ShieldCheck,
  scale: Scale,
  BookOpen: BookOpen,
  calendar: Calendar,
  calendarDays: CalendarDays,
  barChart: BarChart3,
  vote: Vote,
  landmark: Landmark,
  arrowLeftRight: ArrowLeftRight,
};

/** Tricolor owl icon — Poligraph brand for Mon Observatoire */
function OwlIconMobile({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="10" cy="8" rx="7" ry="5.5" fill="#002654" />
      <path d="M4.5 4.5L3 1.5c1 .3 2.2 1.3 2.8 2.5z" fill="#002654" />
      <path d="M15.5 4.5L17 1.5c-1 .3-2.2 1.3-2.8 2.5z" fill="#002654" />
      <ellipse cx="10" cy="14.5" rx="5.5" ry="5" fill="#002654" />
      <ellipse cx="10" cy="15.5" rx="3.5" ry="3.2" fill="white" />
      <circle cx="7.5" cy="8" r="2.2" fill="white" />
      <circle cx="7.8" cy="7.8" r="1.2" fill="#4A9FD9" />
      <circle cx="8.1" cy="7.5" r="0.5" fill="white" />
      <circle cx="12.5" cy="8" r="2.2" fill="white" />
      <circle cx="12.2" cy="7.8" r="1.2" fill="#4A9FD9" />
      <circle cx="11.9" cy="7.5" r="0.5" fill="white" />
      <path d="M10 10l-1.2 1.8h2.4z" fill="#ED2939" />
    </svg>
  );
}

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

  const filteredTools = NAV_TOOLS.filter((item) => isVisible(item.featureFlag));

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
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement!.focus();
          }
        } else {
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
      if (menuRef.current) {
        const focusableElements = getFocusableElements(menuRef.current);
        if (focusableElements.length > 0) {
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
      {/* Header icon bar */}
      <div className="flex items-center gap-0.5">
        <Link
          href="/recherche"
          className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
          aria-label="Rechercher sur Poligraph"
        >
          <Search className="w-5 h-5" aria-hidden="true" />
        </Link>

        {/* Tool icons (filtered by feature flags) */}
        {filteredTools.map((tool) => {
          if (tool.icon === "telescope") {
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
                aria-label={tool.label}
              >
                <OwlIconMobile className="w-5 h-5" />
              </Link>
            );
          }
          const Icon = tool.icon ? ICON_MAP[tool.icon] : null;
          if (!Icon) return null;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="p-2 rounded-lg hover:bg-accent transition-colors touch-target"
              aria-label={tool.label}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
            </Link>
          );
        })}

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
            {/* Top-level links (hero row) */}
            <div className="flex gap-2 mb-4">
              {NAV_TOP_LEVEL.filter((item) => isVisible(item.featureFlag)).map((item) => {
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
                    {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Assistant IA CTA */}
            {isVisible(CTA_ASSISTANT.featureFlag) && (
              <Link
                href={CTA_ASSISTANT.href}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 mb-4 border border-border font-medium rounded-lg hover:bg-muted/50"
              >
                <Bot className="h-5 w-5" aria-hidden="true" />
                {CTA_ASSISTANT.label}
              </Link>
            )}

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
                              return <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />;
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
