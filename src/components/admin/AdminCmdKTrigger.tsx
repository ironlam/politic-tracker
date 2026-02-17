"use client";

export function AdminCmdKTrigger() {
  return (
    <button
      className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors"
      onClick={() => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
        );
      }}
    >
      <span className="text-xs">Rechercher</span>
      <kbd className="text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border">
        ⌘K
      </kbd>
    </button>
  );
}
