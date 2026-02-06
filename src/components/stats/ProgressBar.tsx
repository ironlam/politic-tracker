interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  hexColor?: string;
}

export function ProgressBar({ value, max, color, hexColor }: ProgressBarProps) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-muted rounded-full h-4 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color || ""}`}
        style={{
          width: `${percentage}%`,
          backgroundColor: hexColor,
        }}
      />
    </div>
  );
}
