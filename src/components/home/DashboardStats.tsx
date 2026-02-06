import Link from "next/link";
import {
  Users,
  Landmark,
  Building2,
  Globe2,
  Briefcase,
  Vote,
  Gavel,
  FileText,
  Newspaper,
} from "lucide-react";

interface StatsData {
  politicianCount: number;
  deputeCount: number;
  senateurCount: number;
  mepCount: number;
  gouvernementCount: number;
  voteCount: number;
  affairCount: number;
  declarationCount: number;
  articleCount: number;
}

interface DashboardStatsProps {
  stats: StatsData;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const personStats = [
    {
      value: stats.politicianCount,
      label: "Politiques",
      href: "/politiques",
      icon: Users,
      description: "Total des représentants",
    },
    {
      value: stats.deputeCount,
      label: "Députés",
      href: "/politiques?mandate=DEPUTE",
      icon: Landmark,
      description: "Assemblée nationale",
      highlight: true,
    },
    {
      value: stats.senateurCount,
      label: "Sénateurs",
      href: "/politiques?mandate=SENATEUR",
      icon: Building2,
      description: "Sénat",
      highlight: true,
    },
    {
      value: stats.mepCount,
      label: "Eurodéputés",
      href: "/politiques?mandate=DEPUTE_EUROPEEN",
      icon: Globe2,
      description: "Parlement européen",
      highlight: true,
    },
    {
      value: stats.gouvernementCount,
      label: "Gouvernement",
      href: "/politiques?mandate=MINISTRE",
      icon: Briefcase,
      description: "Membres actuels",
      highlight: true,
    },
  ];

  const dataStats = [
    {
      value: stats.voteCount,
      label: "Votes",
      href: "/votes",
      icon: Vote,
      description: "Scrutins parlementaires",
    },
    {
      value: stats.affairCount,
      label: "Affaires",
      href: "/affaires",
      icon: Gavel,
      description: "Affaires documentées",
      variant: "warning" as const,
    },
    {
      value: stats.declarationCount,
      label: "Déclarations",
      href: "/politiques",
      icon: FileText,
      description: "Déclarations HATVP",
    },
    {
      value: stats.articleCount,
      label: "Articles",
      href: "/presse",
      icon: Newspaper,
      description: "Revue de presse",
    },
  ];

  return (
    <section className="py-12 md:py-16 border-y bg-card">
      <div className="container mx-auto px-4">
        {/* Row 1: People */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-6 mb-6">
          {personStats.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              href={stat.href}
              icon={stat.icon}
              description={stat.description}
              highlight={stat.highlight}
            />
          ))}
        </div>

        {/* Row 2: Data */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
          {dataStats.map((stat) => (
            <StatCard
              key={stat.label}
              value={stat.value}
              label={stat.label}
              href={stat.href}
              icon={stat.icon}
              description={stat.description}
              variant={stat.variant}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface StatCardProps {
  value: number;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  highlight?: boolean;
  variant?: "default" | "warning";
}

function StatCard({
  value,
  label,
  href,
  icon: Icon,
  description,
  highlight,
  variant = "default",
}: StatCardProps) {
  return (
    <Link
      href={href}
      className="group text-center p-4 rounded-xl hover:bg-muted/50 transition-all hover:shadow-md border border-transparent hover:border-border"
    >
      <div className="flex justify-center mb-2">
        <div
          className={`p-2 rounded-lg transition-colors ${
            variant === "warning"
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              : highlight
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p
        className={`text-2xl sm:text-3xl font-bold tabular-nums transition-transform group-hover:scale-105 ${
          variant === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : highlight
              ? "text-primary"
              : ""
        }`}
      >
        {value.toLocaleString("fr-FR")}
      </p>
      <p className="text-sm font-medium mt-1">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
        {description}
      </p>
    </Link>
  );
}
