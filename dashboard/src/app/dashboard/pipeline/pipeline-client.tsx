"use client";

import { useState, useEffect } from "react";
import { KanbanIcon } from "@/components/ui/icons";

interface Pipeline {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

interface Opportunity {
  id: string;
  name: string;
  monetaryValue?: number;
  pipelineStageId: string;
  status: string;
  createdAt: string;
  contact?: { id: string; name: string };
}

export function PipelineClient() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => {
    fetch("/api/dashboard/ghl")
      .then((r) => r.json())
      .then((data) => {
        setPipelines(data.pipelines || []);
        if (data.pipelines?.length > 0) {
          setSelectedPipeline(data.pipelines[0].id);
        }
      })
      .catch(() => setPipelines([]))
      .finally(() => setLoading(false));
  }, []);

  // Load opportunities when pipeline changes
  useEffect(() => {
    if (!selectedPipeline) return;
    setLoading(true);
    const params = new URLSearchParams({ pipelineId: selectedPipeline });
    fetch(`/api/dashboard/ghl/opportunities?${params}`)
      .then((r) => r.json())
      .then((data) => setOpportunities(data.opportunities || []))
      .catch(() => setOpportunities([]))
      .finally(() => setLoading(false));
  }, [selectedPipeline]);

  const currentPipeline = pipelines.find((p) => p.id === selectedPipeline);

  function formatCurrency(value: number) {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-main)" }}>
            Pipeline
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Track opportunities through your sales pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--glass-border)]" style={{ background: "var(--glass-bg)" }}>
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "kanban" ? "bg-blue-500/20 text-blue-400" : ""
              }`}
              style={{ color: view === "kanban" ? undefined : "var(--text-muted)" }}
            >
              Board
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === "list" ? "bg-blue-500/20 text-blue-400" : ""
              }`}
              style={{ color: view === "list" ? undefined : "var(--text-muted)" }}
            >
              List
            </button>
          </div>

          {/* Pipeline selector */}
          {pipelines.length > 1 && (
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm outline-none"
              style={{ color: "var(--text-main)" }}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-16 text-center" style={{ color: "var(--text-muted)" }}>
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading pipeline...</p>
        </div>
      ) : !currentPipeline ? (
        <div className="glass-card p-16">
          <div className="empty-state">
            <KanbanIcon className="empty-state-icon" />
            <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>No pipelines found</p>
            <p className="text-xs mt-1">Connect your GHL Location ID in Settings.</p>
          </div>
        </div>
      ) : view === "kanban" ? (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {currentPipeline.stages.map((stage) => {
            const stageOpps = opportunities.filter(
              (o) => o.pipelineStageId === stage.id
            );
            const stageValue = stageOpps.reduce(
              (sum, o) => sum + (o.monetaryValue || 0),
              0
            );

            return (
              <div
                key={stage.id}
                className="min-w-[280px] flex-shrink-0"
              >
                {/* Stage header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="section-header mb-0">
                      {stage.name}
                    </h3>
                    <span className="badge badge-gray">
                      {stageOpps.length}
                    </span>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs font-semibold text-emerald-400">
                      {formatCurrency(stageValue)}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {stageOpps.length === 0 ? (
                    <div
                      className="border-2 border-dashed border-[var(--glass-border)] rounded-lg p-6 text-center"
                    >
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        No opportunities
                      </p>
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className="glass-card rounded-lg p-4 hover:border-blue-500/20 transition-colors cursor-pointer"
                      >
                        <p className="text-sm font-medium mb-1" style={{ color: "var(--text-main)" }}>
                          {opp.name}
                        </p>
                        {opp.contact && (
                          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                            {opp.contact.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          {opp.monetaryValue ? (
                            <span className="text-xs font-bold text-emerald-400">
                              {formatCurrency(opp.monetaryValue)}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className={`badge ${
                            opp.status === "open"
                              ? "badge-blue"
                              : opp.status === "won"
                              ? "badge-emerald"
                              : "badge-gray"
                          }`}>
                            {opp.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="glass-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => {
                const stage = currentPipeline.stages.find(
                  (s) => s.id === opp.pipelineStageId
                );
                return (
                  <tr key={opp.id}>
                    <td className="font-medium">
                      {opp.name}
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)" }}>
                        {opp.contact?.name || "—"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-gray">
                        {stage?.name || "Unknown"}
                      </span>
                    </td>
                    <td className="font-semibold text-emerald-400">
                      {opp.monetaryValue ? formatCurrency(opp.monetaryValue) : "—"}
                    </td>
                    <td>
                      <span className={`badge capitalize ${
                        opp.status === "open" ? "badge-blue"
                          : opp.status === "won" ? "badge-emerald"
                          : "badge-gray"
                      }`}>
                        {opp.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
