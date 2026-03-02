interface PatrimoineDeclaration {
  year: number;
  type: string;
  details: unknown;
}

interface PatrimoineSideData {
  declarations: PatrimoineDeclaration[];
}

interface PatrimoineSectionProps {
  left: PatrimoineSideData;
  right: PatrimoineSideData;
  leftLabel: string;
  rightLabel: string;
}

export function PatrimoineSection({ left, right, leftLabel, rightLabel }: PatrimoineSectionProps) {
  if (left.declarations.length === 0 && right.declarations.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Patrimoine (HATVP)</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <PatrimoineSide data={left} label={leftLabel} />
        <PatrimoineSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

function PatrimoineSide({ data, label }: { data: PatrimoineSideData; label: string }) {
  if (data.declarations.length === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucune déclaration</p>
      </div>
    );
  }

  const count = data.declarations.length;
  const years = data.declarations.map((d) => d.year);
  const latestYear = Math.max(...years);
  const types = [...new Set(data.declarations.map((d) => d.type))];

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <p className="text-2xl font-bold mb-3">
        {count} déclaration{count > 1 ? "s" : ""}
      </p>
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Dernière déclaration</span>
          <span className="font-medium">{latestYear}</span>
        </li>
        <li className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground shrink-0">Type{types.length > 1 ? "s" : ""}</span>
          <span className="font-medium text-right">{types.join(", ")}</span>
        </li>
      </ul>
    </div>
  );
}
