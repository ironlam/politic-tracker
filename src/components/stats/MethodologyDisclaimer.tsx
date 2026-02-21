interface MethodologyDisclaimerProps {
  children: React.ReactNode;
}

export function MethodologyDisclaimer({ children }: MethodologyDisclaimerProps) {
  return (
    <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4">
      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{children}</p>
    </div>
  );
}
