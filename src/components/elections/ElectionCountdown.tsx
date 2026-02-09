"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface ElectionCountdownProps {
  targetDate: string;
  electionTitle: string;
  electionIcon: string;
  dateConfirmed: boolean;
}

function computeTimeLeft(target: Date) {
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function ElectionCountdown({
  targetDate,
  electionTitle,
  electionIcon,
  dateConfirmed,
}: ElectionCountdownProps) {
  const [mounted, setMounted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(new Date(targetDate)));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const target = new Date(targetDate);
    const interval = setInterval(() => {
      setTimeLeft(computeTimeLeft(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) {
    return null;
  }

  const units = [
    { value: timeLeft.days, label: "jours" },
    { value: timeLeft.hours, label: "heures" },
    { value: timeLeft.minutes, label: "minutes" },
    { value: timeLeft.seconds, label: "secondes" },
  ];

  return (
    <div
      role="timer"
      aria-label={`Compte à rebours pour ${electionTitle}`}
      className="bg-gradient-to-br from-primary/10 via-background to-accent/10 border rounded-2xl p-6 md:p-8 mb-8"
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
        Prochaine élection
      </p>
      <h2 className="text-2xl md:text-3xl font-bold mb-4">
        {electionIcon} {electionTitle}
      </h2>

      {!dateConfirmed && (
        <div className="mb-4">
          <Badge variant="outline">Dates provisoires</Badge>
        </div>
      )}

      <div className="grid grid-cols-4 max-w-md mx-auto gap-2 md:gap-4 mb-4">
        {units.map((unit) => (
          <div key={unit.label} className="text-center">
            <p className="text-3xl md:text-4xl font-bold tabular-nums">{unit.value}</p>
            <p className="text-xs text-muted-foreground">{unit.label}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground text-center">{formatDate(targetDate)}</p>
    </div>
  );
}
