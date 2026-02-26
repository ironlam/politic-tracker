"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { GraphNode, Cluster, RelationType } from "@/types/relations";
import { ALL_RELATION_TYPES } from "@/config/relations";
import { RelationsGraph } from "./RelationsGraph";
import { RelationFilters } from "./RelationFilters";
import { RelationLegend } from "./RelationLegend";

interface RelationsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  center: GraphNode;
  clusters: Cluster[];
  stats: {
    totalConnections: number;
    byType: Partial<Record<RelationType, number>>;
  };
}

export function RelationsDialog({
  isOpen,
  onClose,
  center,
  clusters,
  stats,
}: RelationsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<RelationType[]>([...ALL_RELATION_TYPES]);
  const [graphDimensions, setGraphDimensions] = useState({
    width: 800,
    height: 600,
  });

  // Handle resize
  const updateDimensions = useCallback(() => {
    setGraphDimensions({
      width: window.innerWidth - 32,
      height: window.innerHeight - 120,
    });
  }, []);

  // Open / close the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      dialog.showModal();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync dimensions on open
      setGraphDimensions({
        width: window.innerWidth - 32,
        height: window.innerHeight - 120,
      });
    } else {
      dialog.close();
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen, updateDimensions]);

  // Listen for native close event (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [isOpen, updateDimensions]);

  // Backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Filter clusters
  const filteredClusters = clusters.filter((c) => selectedTypes.includes(c.type));

  const activeTypeCounts: Partial<Record<RelationType, number>> = {};
  for (const type of selectedTypes) {
    if (stats.byType[type] !== undefined) {
      activeTypeCounts[type] = stats.byType[type];
    }
  }

  const filteredConnectionCount = Object.values(activeTypeCounts).reduce(
    (sum, n) => sum + (n ?? 0),
    0
  );

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="relations-dialog-title"
      onClick={handleBackdropClick}
      className="fixed inset-0 w-full h-full max-w-none max-h-none m-0 p-0 bg-background backdrop:bg-black/50 overflow-hidden"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="shrink-0 border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="relations-dialog-title" className="text-base font-semibold truncate">
              Relations de {center.fullName}
            </h2>
            <div className="hidden sm:flex items-center gap-2 flex-1 justify-center">
              <RelationFilters selectedTypes={selectedTypes} onChange={setSelectedTypes} compact />
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Mobile filters row */}
          <div className="sm:hidden mt-2">
            <RelationFilters selectedTypes={selectedTypes} onChange={setSelectedTypes} compact />
          </div>
        </div>

        {/* Graph area */}
        <div className="flex-1 overflow-hidden">
          <RelationsGraph
            center={center}
            clusters={filteredClusters}
            width={graphDimensions.width}
            height={graphDimensions.height}
          />
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 py-2 flex items-center justify-between gap-4">
          <RelationLegend activeTypes={activeTypeCounts} />
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-muted-foreground">
              {filteredConnectionCount} connexion
              {filteredConnectionCount !== 1 ? "s" : ""}
            </span>
            {!isMobile && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Ctrl+molette pour zoomer
              </span>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
