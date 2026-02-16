/**
 * Subtle hexagonal SVG pattern for backgrounds.
 * Stroke-only hexagons evoking "L'Hexagone" (France).
 * Used on hero and footer only.
 */
export function HexPattern({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
    >
      <defs>
        <pattern
          id="hex-pattern"
          x="0"
          y="0"
          width="56"
          height="100"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(1.5)"
        >
          <path
            d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
          <path
            d="M28 0L28 -34L0 -50L0 -16L28 0L56 -16L56 -50L28 -34"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hex-pattern)" />
    </svg>
  );
}
