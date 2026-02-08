import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GitCompare, MapPin, Map, BarChart3, ChevronRight } from "lucide-react";

const tools = [
  {
    href: "/comparer",
    icon: GitCompare,
    title: "Comparer",
    description: "Comparez 2 représentants : mandats, votes, patrimoine",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  {
    href: "/carte",
    icon: Map,
    title: "Carte de France",
    description: "Visualisez les élus de chaque département",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    href: "/mon-depute",
    icon: MapPin,
    title: "Mon député",
    description: "Trouvez votre député par code postal",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    href: "/statistiques",
    icon: BarChart3,
    title: "Statistiques",
    description: "Analyses détaillées : votes, affaires, presse",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
];

export function QuickTools() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Outils</h2>
          <p className="text-muted-foreground">Accès rapide aux fonctionnalités clés</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href} className="block group">
                <Card className="h-full border-2 border-transparent hover:border-primary/20 transition-all hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div
                      className={`inline-flex p-3 rounded-xl ${tool.bgColor} mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className={`h-6 w-6 ${tool.color}`} />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      {tool.title}
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </h3>
                    <p className="text-sm text-muted-foreground">{tool.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
