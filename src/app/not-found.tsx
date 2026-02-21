import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      role="main"
      className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center bg-gradient-to-br from-primary/5 via-background to-accent/10"
    >
      <Image src="/logo.svg" alt="Poligraph" width={80} height={80} className="mb-6" />
      <h1 className="text-4xl font-bold mb-3">Page introuvable</h1>
      <p className="text-muted-foreground max-w-md mb-8">
        La page que vous recherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/politiques">Explorer les représentants</Link>
        </Button>
      </div>
    </main>
  );
}
