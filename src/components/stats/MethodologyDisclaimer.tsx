"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MethodologyDisclaimerProps {
  children: React.ReactNode;
  /** Optional collapsible detail content */
  details?: React.ReactNode;
}

export function MethodologyDisclaimer({ children, details }: MethodologyDisclaimerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
      <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">{children}</p>
      {details && (
        <>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            aria-expanded={isOpen}
          >
            En savoir plus
            <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
          {isOpen && (
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 leading-relaxed space-y-1">
              {details}
            </div>
          )}
        </>
      )}
    </div>
  );
}
