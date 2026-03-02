import Link from "next/link";

interface CompareSide {
  label: string;
  sublabel?: string;
  photoUrl?: string | null;
  color?: string | null;
  href?: string;
}

interface CompareHeaderProps {
  left: CompareSide | null;
  right: CompareSide | null;
}

export function CompareHeader({ left, right }: CompareHeaderProps) {
  if (!left && !right) {
    return null;
  }

  const bothSelected = left !== null && right !== null;

  return (
    <>
      {/* VS separator */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex-1 h-px bg-border" />
        <span className="px-4 text-2xl font-display font-extrabold text-muted-foreground">
          VS
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Sticky mobile bar — only when both sides are selected */}
      {bothSelected && (
        <div className="md:hidden sticky top-16 z-30 -mx-4 px-4 py-2 mb-4 bg-background/80 backdrop-blur-md border-b">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: left.color || "#888" }}
              />
              {left.href ? (
                <Link
                  href={left.href}
                  prefetch={false}
                  className="font-medium truncate text-primary"
                >
                  {left.label}
                </Link>
              ) : (
                <span className="font-medium truncate">{left.label}</span>
              )}
            </span>
            <span className="text-muted-foreground font-bold shrink-0">VS</span>
            <span className="flex items-center gap-1.5 min-w-0 justify-end">
              {right.href ? (
                <Link
                  href={right.href}
                  prefetch={false}
                  className="font-medium truncate text-primary"
                >
                  {right.label}
                </Link>
              ) : (
                <span className="font-medium truncate">{right.label}</span>
              )}
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: right.color || "#888" }}
              />
            </span>
          </div>
        </div>
      )}
    </>
  );
}
