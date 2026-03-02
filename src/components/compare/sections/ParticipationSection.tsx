interface ParticipationSideData {
  total: number;
  pour: number;
  contre: number;
  abstention: number;
  absent: number;
  nonVotant: number;
  presenceRate: number; // 0-100
}

interface ParticipationSectionProps {
  left: ParticipationSideData;
  right: ParticipationSideData;
  leftLabel: string;
  rightLabel: string;
}

export function ParticipationSection({
  left,
  right,
  leftLabel,
  rightLabel,
}: ParticipationSectionProps) {
  if (left.total === 0 && right.total === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-display font-semibold mb-4">Participation aux votes</h3>
      <div className="grid md:grid-cols-2 gap-6">
        <ParticipationSide data={left} label={leftLabel} />
        <ParticipationSide data={right} label={rightLabel} />
      </div>
    </section>
  );
}

const BREAKDOWN_SEGMENTS: {
  key: keyof Pick<ParticipationSideData, "pour" | "contre" | "abstention" | "absent">;
  label: string;
  color: string;
  textColor: string;
}[] = [
  { key: "pour", label: "Pour", color: "bg-green-500", textColor: "text-green-600" },
  { key: "contre", label: "Contre", color: "bg-red-500", textColor: "text-red-600" },
  { key: "abstention", label: "Abstention", color: "bg-yellow-500", textColor: "text-yellow-600" },
  { key: "absent", label: "Absent", color: "bg-gray-400", textColor: "text-gray-500" },
];

function ParticipationSide({ data, label }: { data: ParticipationSideData; label: string }) {
  if (data.total === 0) {
    return (
      <div className="bg-muted rounded-lg p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <p className="text-muted-foreground text-sm text-center py-2">Aucun vote enregistré</p>
      </div>
    );
  }

  // Active votes = total minus absent and nonVotant
  const activeVotes = data.pour + data.contre + data.abstention;

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>

      {/* Presence rate */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-bold">{data.presenceRate}%</span>
        <span className="text-sm text-muted-foreground">de présence</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {activeVotes} vote{activeVotes > 1 ? "s" : ""} exprimé{activeVotes > 1 ? "s" : ""} sur{" "}
        {data.total} scrutin{data.total > 1 ? "s" : ""}
      </p>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
        {BREAKDOWN_SEGMENTS.map(({ key, color, label: segLabel }) => {
          const count = data[key];
          if (count === 0) return null;
          return (
            <div
              key={key}
              className={color}
              style={{ width: `${(count / data.total) * 100}%` }}
              title={`${segLabel} : ${count}`}
            />
          );
        })}
      </div>

      {/* Individual counts */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
        {BREAKDOWN_SEGMENTS.map(({ key, label: segLabel, color, textColor }) => {
          const count = data[key];
          return (
            <span key={key} className="flex items-center gap-1.5 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-muted-foreground">{segLabel}</span>
              <span className={`font-medium ${textColor}`}>{count}</span>
            </span>
          );
        })}
        {data.nonVotant > 0 && (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            <span className="text-muted-foreground">Non-votant</span>
            <span className="font-medium text-gray-500">{data.nonVotant}</span>
          </span>
        )}
      </div>
    </div>
  );
}
