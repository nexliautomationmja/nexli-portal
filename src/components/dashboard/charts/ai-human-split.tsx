"use client";

interface AiHumanSplitProps {
  aiCount: number;
  humanCount: number;
}

export function AiHumanSplit({ aiCount, humanCount }: AiHumanSplitProps) {
  const total = aiCount + humanCount;

  if (total === 0) {
    return (
      <div
        className="text-xs text-center py-4"
        style={{ color: "var(--text-muted)" }}
      >
        No response data
      </div>
    );
  }

  const aiPct = Math.round((aiCount / total) * 100);
  const humanPct = 100 - aiPct;

  return (
    <div>
      <div
        className="h-3 rounded-full flex overflow-hidden"
        style={{ background: "var(--glass-border)" }}
      >
        {aiPct > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${aiPct}%`, background: "#8b5cf6" }}
          />
        )}
        {humanPct > 0 && (
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${humanPct}%`, background: "#3b82f6" }}
          />
        )}
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span style={{ color: "#8b5cf6" }} className="font-medium">
          AI: {aiCount} ({aiPct}%)
        </span>
        <span style={{ color: "#3b82f6" }} className="font-medium">
          Human: {humanCount} ({humanPct}%)
        </span>
      </div>
    </div>
  );
}
