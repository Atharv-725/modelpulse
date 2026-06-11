// src/lib/drift.ts
// Core drift detection engine for ModelPulse
// Implements PSI, KS-test, and Jensen-Shannon divergence

export interface FeatureDrift {
  feature: string;
  type: "numeric" | "categorical";
  psi: number;
  ksStatistic: number | null; // null for categorical
  jsDivergence: number;
  baselineMean: number | null;
  currentMean: number | null;
  baselineStd: number | null;
  currentStd: number | null;
  severity: "stable" | "moderate" | "severe";
  baselineDistribution: { bin: string; baseline: number; current: number }[];
}

export interface DriftReport {
  features: FeatureDrift[];
  overallScore: number;
  severeCount: number;
  moderateCount: number;
  stableCount: number;
  baselineRows: number;
  currentRows: number;
  timestamp: string;
}

const NUM_BINS = 10;
const EPSILON = 1e-6;

// ---------- helpers ----------

function isNumericColumn(values: unknown[]): boolean {
  const sample = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (sample.length === 0) return false;
  const numericCount = sample.filter(
    (v) => typeof v === "number" || (!isNaN(Number(v)) && String(v).trim() !== "")
  ).length;
  return numericCount / sample.length > 0.9;
}

function toNumbers(values: unknown[]): number[] {
  return values
    .map((v) => Number(v))
    .filter((v) => !isNaN(v) && isFinite(v));
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length);
}

// ---------- binning ----------

function binNumeric(
  baseline: number[],
  current: number[]
): { baselineProps: number[]; currentProps: number[]; labels: string[] } {
  const all = [...baseline, ...current];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const width = (max - min) / NUM_BINS || 1;

  const baselineCounts = new Array(NUM_BINS).fill(0);
  const currentCounts = new Array(NUM_BINS).fill(0);
  const labels: string[] = [];

  for (let i = 0; i < NUM_BINS; i++) {
    const lo = min + i * width;
    labels.push(lo.toFixed(2));
  }

  const place = (v: number) =>
    Math.min(Math.floor((v - min) / width), NUM_BINS - 1);

  baseline.forEach((v) => baselineCounts[place(v)]++);
  current.forEach((v) => currentCounts[place(v)]++);

  return {
    baselineProps: baselineCounts.map((c) => c / baseline.length),
    currentProps: currentCounts.map((c) => c / current.length),
    labels,
  };
}

function binCategorical(
  baseline: unknown[],
  current: unknown[]
): { baselineProps: number[]; currentProps: number[]; labels: string[] } {
  const categories = Array.from(
    new Set([...baseline, ...current].map((v) => String(v)))
  ).slice(0, 20); // cap at 20 categories for sanity

  const count = (arr: unknown[], cat: string) =>
    arr.filter((v) => String(v) === cat).length;

  const baselineProps = categories.map((c) => count(baseline, c) / baseline.length);
  const currentProps = categories.map((c) => count(current, c) / current.length);

  return { baselineProps, currentProps, labels: categories };
}

// ---------- drift metrics ----------

export function computePSI(baselineProps: number[], currentProps: number[]): number {
  let psi = 0;
  for (let i = 0; i < baselineProps.length; i++) {
    const b = baselineProps[i] + EPSILON;
    const c = currentProps[i] + EPSILON;
    psi += (c - b) * Math.log(c / b);
  }
  return psi;
}

export function computeKS(baseline: number[], current: number[]): number {
  const sortedB = [...baseline].sort((a, b) => a - b);
  const sortedC = [...current].sort((a, b) => a - b);
  const all = [...sortedB, ...sortedC].sort((a, b) => a - b);

  let maxDiff = 0;
  for (const v of all) {
    const cdfB = sortedB.filter((x) => x <= v).length / sortedB.length;
    const cdfC = sortedC.filter((x) => x <= v).length / sortedC.length;
    maxDiff = Math.max(maxDiff, Math.abs(cdfB - cdfC));
  }
  return maxDiff;
}

export function computeJS(baselineProps: number[], currentProps: number[]): number {
  const kl = (p: number[], q: number[]) => {
    let sum = 0;
    for (let i = 0; i < p.length; i++) {
      const pi = p[i] + EPSILON;
      const qi = q[i] + EPSILON;
      sum += pi * Math.log2(pi / qi);
    }
    return sum;
  };
  const m = baselineProps.map((p, i) => (p + currentProps[i]) / 2);
  return 0.5 * kl(baselineProps, m) + 0.5 * kl(currentProps, m);
}

// Industry-standard PSI thresholds (used by Arize, Evidently, banks)
function severityFromPSI(psi: number): "stable" | "moderate" | "severe" {
  if (psi < 0.1) return "stable";
  if (psi < 0.25) return "moderate";
  return "severe";
}

// ---------- main entry point ----------

export function computeDriftReport(
  baselineData: Record<string, unknown>[],
  currentData: Record<string, unknown>[]
): DriftReport {
  const columns = Object.keys(baselineData[0] || {}).filter(
    (col) => col in (currentData[0] || {})
  );

  const features: FeatureDrift[] = [];

  for (const col of columns) {
    const baselineVals = baselineData.map((r) => r[col]);
    const currentVals = currentData.map((r) => r[col]);
    const numeric = isNumericColumn(baselineVals);

    let result: FeatureDrift;

    if (numeric) {
      const b = toNumbers(baselineVals);
      const c = toNumbers(currentVals);
      if (b.length < 2 || c.length < 2) continue;

      const { baselineProps, currentProps, labels } = binNumeric(b, c);
      const psi = computePSI(baselineProps, currentProps);

      result = {
        feature: col,
        type: "numeric",
        psi,
        ksStatistic: computeKS(b, c),
        jsDivergence: computeJS(baselineProps, currentProps),
        baselineMean: mean(b),
        currentMean: mean(c),
        baselineStd: std(b),
        currentStd: std(c),
        severity: severityFromPSI(psi),
        baselineDistribution: labels.map((bin, i) => ({
          bin,
          baseline: +(baselineProps[i] * 100).toFixed(2),
          current: +(currentProps[i] * 100).toFixed(2),
        })),
      };
    } else {
      const { baselineProps, currentProps, labels } = binCategorical(
        baselineVals,
        currentVals
      );
      const psi = computePSI(baselineProps, currentProps);

      result = {
        feature: col,
        type: "categorical",
        psi,
        ksStatistic: null,
        jsDivergence: computeJS(baselineProps, currentProps),
        baselineMean: null,
        currentMean: null,
        baselineStd: null,
        currentStd: null,
        severity: severityFromPSI(psi),
        baselineDistribution: labels.map((bin, i) => ({
          bin,
          baseline: +(baselineProps[i] * 100).toFixed(2),
          current: +(currentProps[i] * 100).toFixed(2),
        })),
      };
    }

    features.push(result);
  }

  // Sort: most drifted first
  features.sort((a, b) => b.psi - a.psi);

  const severeCount = features.filter((f) => f.severity === "severe").length;
  const moderateCount = features.filter((f) => f.severity === "moderate").length;
  const stableCount = features.filter((f) => f.severity === "stable").length;

  // Overall drift score: weighted average of normalized PSI, capped at 100
  const overallScore = Math.min(
    100,
    +(
      (features.reduce((acc, f) => acc + Math.min(f.psi, 1), 0) /
        Math.max(features.length, 1)) *
      100
    ).toFixed(1)
  );

  return {
    features,
    overallScore,
    severeCount,
    moderateCount,
    stableCount,
    baselineRows: baselineData.length,
    currentRows: currentData.length,
    timestamp: new Date().toISOString(),
  };
}