import type { FoundationProject } from "@/lib/foundation-project";
import { CheckIcon } from "@/components/ui/icons";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Firm Foundation project tracker. Pure presentational — no hooks — so it can
 * render from both the client-side Nexli portal overview and the server-side
 * firm dashboard.
 */
export function FoundationProjectCard({
  project,
  showDashboardLink = true,
}: {
  project: FoundationProject;
  /** Hide the "Open your firm dashboard" button when already on that dashboard. */
  showDashboardLink?: boolean;
}) {
  const doneCount = project.steps.filter((s) => s.done).length;
  const total = project.steps.length;
  const allDone = doneCount === total;
  // The first unfinished step is "current" and gets a highlighted ring.
  const currentIndex = project.steps.findIndex((s) => !s.done);

  return (
    <div className="glass-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-main)" }}>
            Your Firm Foundation project
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {project.firmName}
          </p>
        </div>
        <span className={allDone ? "badge badge-emerald" : "badge badge-blue"}>
          {allDone ? "Complete" : `${doneCount} of ${total} steps done`}
        </span>
      </div>

      {/* Step tracker: vertical on phones, horizontal from md up */}
      <ol className="flex flex-col md:flex-row md:items-start gap-3 md:gap-0">
        {project.steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const isLast = i === project.steps.length - 1;
          return (
            <li
              key={step.key}
              className="flex md:flex-col md:flex-1 items-start md:items-center gap-3 md:gap-2 md:text-center relative"
            >
              <div className="flex md:w-full items-center md:justify-center relative">
                {/* Connector (horizontal, md+) */}
                {!isLast && (
                  <span
                    aria-hidden
                    className="hidden md:block absolute left-1/2 top-1/2 w-full h-px -translate-y-1/2"
                    style={{
                      background: step.done
                        ? "var(--accent-blue)"
                        : "var(--card-border)",
                    }}
                  />
                )}
                <span
                  className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={
                    step.done
                      ? {
                          background: "var(--accent-blue)",
                          color: "#fff",
                          border: "1px solid var(--accent-blue)",
                        }
                      : {
                          background: "var(--card-bg)",
                          color: isCurrent ? "var(--accent-blue)" : "var(--text-muted)",
                          border: isCurrent
                            ? "2px solid var(--accent-blue)"
                            : "1px solid var(--card-border)",
                        }
                  }
                >
                  {step.done ? <CheckIcon className="w-4 h-4" /> : i + 1}
                </span>
              </div>
              <div className="min-w-0 md:px-1">
                <p
                  className="text-sm font-medium leading-snug"
                  style={{
                    color:
                      step.done || isCurrent ? "var(--text-main)" : "var(--text-muted)",
                  }}
                >
                  {step.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {step.done
                    ? step.at
                      ? formatDate(step.at)
                      : "Done"
                    : isCurrent
                      ? "In progress"
                      : "Up next"}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2 mt-6">
        {showDashboardLink && (
          <a
            href={project.dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline bg-blue-600 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-colors"
          >
            Open your firm dashboard
          </a>
        )}
        {project.agreementUrl && (
          <a
            href={project.agreementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline px-5 py-2.5 rounded-full font-bold text-sm transition-colors hover:border-blue-500/40"
            style={{
              color: "var(--text-main)",
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            Sign your agreement
          </a>
        )}
        {project.siteUrl && (
          <a
            href={project.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline px-5 py-2.5 rounded-full font-bold text-sm transition-colors hover:border-blue-500/40"
            style={{
              color: "var(--text-main)",
              background: "var(--input-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            View your website
          </a>
        )}
      </div>
    </div>
  );
}
