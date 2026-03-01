import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/stats/ProgressBar";

/**
 * Component playground — dev-only route for previewing UI components.
 * Accessible at /dev in development, redirects to / in production.
 */
export default function DevPlayground() {
  if (process.env.NODE_ENV === "production") {
    redirect("/");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12">
      <div>
        <h1 className="text-3xl font-display font-extrabold tracking-tight">
          Component Playground
        </h1>
        <p className="text-muted-foreground mt-1">
          Apercu des composants UI — visible uniquement en développement.
        </p>
      </div>

      {/* Buttons */}
      <Section title="Button">
        <div className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      {/* Badges */}
      <Section title="Badge">
        <div className="flex flex-wrap gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">Judiciaire</Badge>
          <Badge className="bg-green-100 text-green-800 border-green-200">Publié</Badge>
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">Député</Badge>
        </div>
      </Section>

      {/* Cards */}
      <Section title="Card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Card standard</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Contenu de la carte avec texte descriptif.
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader>
              <h3 className="font-semibold">Card accent judiciaire</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bordure amber pour le thème judiciaire.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* StatCards */}
      <Section title="StatCard">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            count={577}
            label="Députés"
            description="Assemblée nationale"
            accent={{ border: "#2563EB", bg: "#2563EB0a" }}
          />
          <StatCard count={348} label="Sénateurs" accent={{ border: "#7C3AED", bg: "#7C3AED0a" }} />
          <StatCard
            count={42}
            label="Affaires"
            description="Procédures en cours"
            accent={{ border: "#D97706", bg: "#D977060a" }}
          />
          <StatCard
            count={12}
            label="Partis"
            accent={{ border: "#059669", bg: "#0596690a" }}
            isActive
          />
        </div>
      </Section>

      {/* ProgressBar */}
      <Section title="ProgressBar">
        <div className="space-y-4 max-w-md">
          <div>
            <p className="text-sm mb-1">Participation — 78%</p>
            <ProgressBar value={78} max={100} hexColor="#2563EB" label="Participation" />
          </div>
          <div>
            <p className="text-sm mb-1">Votes pour — 289/577</p>
            <ProgressBar value={289} max={577} hexColor="#16A34A" label="Votes pour" />
          </div>
          <div>
            <p className="text-sm mb-1">Votes contre — 210/577</p>
            <ProgressBar value={210} max={577} hexColor="#DC2626" label="Votes contre" />
          </div>
          <div>
            <p className="text-sm mb-1">Vide — 0%</p>
            <ProgressBar value={0} max={100} hexColor="#6B7280" label="Vide" />
          </div>
        </div>
      </Section>

      {/* Skeleton */}
      <Section title="Skeleton">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Loading states</p>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Colors */}
      <Section title="Couleurs thématiques">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ColorSwatch color="bg-primary" label="Primary (liens)" />
          <ColorSwatch color="bg-amber-500" label="Judiciaire" />
          <ColorSwatch color="bg-green-500" label="Succès / Pour" />
          <ColorSwatch color="bg-red-500" label="Destructive / Contre" />
          <ColorSwatch color="bg-muted" label="Muted" textClass="text-muted-foreground" />
          <ColorSwatch
            color="bg-secondary"
            label="Secondary"
            textClass="text-secondary-foreground"
          />
        </div>
      </Section>

      {/* Typography */}
      <Section title="Typographie">
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Heading 1 — font-display extrabold
          </h1>
          <h2 className="text-2xl font-bold">Heading 2 — bold</h2>
          <h3 className="text-xl font-semibold">Heading 3 — semibold</h3>
          <p className="text-base">Body text — base</p>
          <p className="text-sm text-muted-foreground">
            Small muted — descriptions, labels secondaires
          </p>
          <p className="text-xs text-muted-foreground">Extra small — metadata, timestamps</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 pb-2 border-b">{title}</h2>
      {children}
    </section>
  );
}

function ColorSwatch({
  color,
  label,
  textClass = "text-white",
}: {
  color: string;
  label: string;
  textClass?: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${color}`}>
      <span className={`text-sm font-medium ${textClass}`}>{label}</span>
    </div>
  );
}
