"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { computeDriftReport, DriftReport, FeatureDrift } from "@/lib/drift";
import { generateDemoData } from "@/lib/demoData";

type Rows = Record<string, unknown>[];

const severityStyles: Record<string, string> = {
  stable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  moderate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  severe: "bg-red-500/15 text-red-400 border-red-500/30",
};

const severityLabel: Record<string, string> = {
  stable: "Stable",
  moderate: "Moderate",
  severe: "Severe",
};

function parseCSV(file: File): Promise<Rows> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res.data as Rows),
      error: (err) => reject(err),
    });
  });
}

export default function Home() {
  const [baseline, setBaseline] = useState<Rows | null>(null);
  const [current, setCurrent] = useState<Rows | null>(null);
  const [baselineName, setBaselineName] = useState("");
  const [currentName, setCurrentName] = useState("");
  const [report, setReport] = useState<DriftReport | null>(null);
  const [selected, setSelected] = useState<FeatureDrift | null>(null);
  const [error, setError] = useState("");

  const runAnalysis = useCallback((b: Rows, c: Rows) => {
    try {
      const r = computeDriftReport(b, c);
      setReport(r);
      setSelected(r.features[0] ?? null);
      setError("");
    } catch {
      setError("Failed to analyze data. Check that both CSVs share columns.");
    }
  }, []);

  const handleFile = async (file: File, which: "baseline" | "current") => {
    try {
      const rows = await parseCSV(file);
      if (which === "baseline") {
        setBaseline(rows);
        setBaselineName(file.name);
        if (current) runAnalysis(rows, current);
      } else {
        setCurrent(rows);
        setCurrentName(file.name);
        if (baseline) runAnalysis(baseline, rows);
      }
    } catch {
      setError("Could not parse that CSV file.");
    }
  };

  const loadDemo = () => {
    const { baseline: b, current: c } = generateDemoData();
    setBaseline(b);
    setCurrent(c);
    setBaselineName("loan_training_data.csv (demo)");
    setCurrentName("loan_production_logs.csv (demo)");
    runAnalysis(b, c);
  };

  const downloadReport = () => {
    if (!report) return;
    const lines = [
      `# ModelPulse Drift Report`,
      `Generated: ${report.timestamp}`,
      ``,
      `Overall drift score: ${report.overallScore}/100`,
      `Baseline rows: ${report.baselineRows} | Current rows: ${report.currentRows}`,
      `Severe: ${report.severeCount} | Moderate: ${report.moderateCount} | Stable: ${report.stableCount}`,
      ``,
      `| Feature | Type | PSI | KS | JS Divergence | Severity |`,
      `|---|---|---|---|---|---|`,
      ...report.features.map(
        (f) =>
          `| ${f.feature} | ${f.type} | ${f.psi.toFixed(4)} | ${
            f.ksStatistic !== null ? f.ksStatistic.toFixed(4) : "—"
          } | ${f.jsDivergence.toFixed(4)} | ${severityLabel[f.severity]} |`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelpulse_drift_report.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center font-bold text-white">
              M
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">ModelPulse</h1>
              <p className="text-xs text-zinc-400">
                ML drift monitoring &amp; observability
              </p>
            </div>
          </div>
          {report && (
            <button
              onClick={downloadReport}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800 transition"
            >
              ⬇ Export report
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Upload section */}
        <section className="grid gap-4 md:grid-cols-3">
          {(["baseline", "current"] as const).map((which) => (
            <label
              key={which}
              className="cursor-pointer rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6 hover:border-violet-500 transition block"
            >
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f, which);
                }}
              />
              <p className="text-sm font-medium">
                {which === "baseline" ? "📦 Baseline data" : "🚀 Production data"}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {which === "baseline"
                  ? baselineName || "Upload training-time CSV"
                  : currentName || "Upload production logs CSV"}
              </p>
            </label>
          ))}
          <button
            onClick={loadDemo}
            className="rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-left hover:opacity-90 transition"
          >
            <p className="text-sm font-semibold">✨ Try the demo</p>
            <p className="mt-1 text-xs text-violet-100">
              Loan-default model hit by an economic shift
            </p>
          </button>
        </section>

        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </p>
        )}

        {report && (
          <>
            {/* Summary cards */}
            <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <p className="text-xs text-zinc-400">Overall drift score</p>
                <p
                  className={`mt-1 text-3xl font-bold ${
                    report.overallScore > 25
                      ? "text-red-400"
                      : report.overallScore > 10
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {report.overallScore}
                </p>
                <p className="text-xs text-zinc-500">out of 100</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <p className="text-xs text-zinc-400">🔴 Severe features</p>
                <p className="mt-1 text-3xl font-bold text-red-400">
                  {report.severeCount}
                </p>
                <p className="text-xs text-zinc-500">PSI ≥ 0.25</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <p className="text-xs text-zinc-400">⚠️ Moderate features</p>
                <p className="mt-1 text-3xl font-bold text-amber-400">
                  {report.moderateCount}
                </p>
                <p className="text-xs text-zinc-500">0.1 ≤ PSI &lt; 0.25</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <p className="text-xs text-zinc-400">✅ Stable features</p>
                <p className="mt-1 text-3xl font-bold text-emerald-400">
                  {report.stableCount}
                </p>
                <p className="text-xs text-zinc-500">PSI &lt; 0.1</p>
              </div>
            </section>

            {/* Feature table + distribution chart */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Table */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-800">
                  <h2 className="text-sm font-semibold">
                    Feature drift ranking
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Click a feature to inspect its distribution shift
                  </p>
                </div>
                <div className="max-h-[420px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-zinc-400 sticky top-0 bg-zinc-900">
                      <tr>
                        <th className="px-5 py-2 text-left">Feature</th>
                        <th className="px-3 py-2 text-right">PSI</th>
                        <th className="px-3 py-2 text-right">KS</th>
                        <th className="px-5 py-2 text-right">Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.features.map((f) => (
                        <tr
                          key={f.feature}
                          onClick={() => setSelected(f)}
                          className={`cursor-pointer border-t border-zinc-800/50 hover:bg-zinc-800/50 transition ${
                            selected?.feature === f.feature
                              ? "bg-violet-500/10"
                              : ""
                          }`}
                        >
                          <td className="px-5 py-3 font-mono text-xs">
                            {f.feature}
                            <span className="ml-2 text-zinc-500">
                              {f.type === "categorical" ? "cat" : "num"}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {f.psi.toFixed(3)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs">
                            {f.ksStatistic !== null
                              ? f.ksStatistic.toFixed(3)
                              : "—"}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${
                                severityStyles[f.severity]
                              }`}
                            >
                              {severityLabel[f.severity]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Distribution chart */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <h2 className="text-sm font-semibold">
                  Distribution shift{selected ? `: ${selected.feature}` : ""}
                </h2>
                {selected && (
                  <>
                    <p className="text-xs text-zinc-400 mb-4">
                      JS divergence: {selected.jsDivergence.toFixed(4)}
                      {selected.baselineMean !== null &&
                        selected.currentMean !== null && (
                          <>
                            {" "}
                            · mean {selected.baselineMean.toFixed(1)} →{" "}
                            {selected.currentMean.toFixed(1)}
                          </>
                        )}
                    </p>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={selected.baselineDistribution}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#27272a"
                        />
                        <XAxis
                          dataKey="bin"
                          tick={{ fill: "#a1a1aa", fontSize: 10 }}
                          angle={-30}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          tick={{ fill: "#a1a1aa", fontSize: 10 }}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#18181b",
                            border: "1px solid #3f3f46",
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar
                          dataKey="baseline"
                          name="Baseline"
                          fill="#8b5cf6"
                          radius={[3, 3, 0, 0]}
                        />
                        <Bar
                          dataKey="current"
                          name="Production"
                          fill="#f43f5e"
                          radius={[3, 3, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {!report && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
            <p className="text-zinc-400">
              Upload a baseline CSV and a production CSV with matching columns —
              or hit <span className="text-violet-400">Try the demo</span> to see
              ModelPulse catch a real drift scenario.
            </p>
          </section>
        )}
      </div>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-500">
        ModelPulse · PSI · KS-test · Jensen-Shannon divergence · Built by Thunder
      </footer>
    </main>
  );
}
