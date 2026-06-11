// src/lib/demoData.ts
// Generates a realistic demo scenario: a loan-default model in production.
// Baseline = training data distribution. Current = production data after
// an economic shift (incomes drop, interest rates rise, more young applicants).

// Deterministic pseudo-random generator (so the demo looks the same every time)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller transform: normal distribution from uniform
function makeGaussian(rand: () => number) {
  return (mean: number, std: number) => {
    const u1 = Math.max(rand(), 1e-9);
    const u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * std;
  };
}

function pickWeighted(rand: () => number, options: [string, number][]): string {
  const total = options.reduce((acc, [, w]) => acc + w, 0);
  let r = rand() * total;
  for (const [value, weight] of options) {
    r -= weight;
    if (r <= 0) return value;
  }
  return options[options.length - 1][0];
}

export function generateDemoData(): {
  baseline: Record<string, unknown>[];
  current: Record<string, unknown>[];
} {
  const N = 800;

  // ---- BASELINE (training-time distribution) ----
  const randB = mulberry32(42);
  const gaussB = makeGaussian(randB);
  const baseline: Record<string, unknown>[] = [];

  for (let i = 0; i < N; i++) {
    baseline.push({
      annual_income: Math.max(15000, Math.round(gaussB(72000, 18000))),
      credit_score: Math.min(850, Math.max(300, Math.round(gaussB(690, 60)))),
      loan_amount: Math.max(1000, Math.round(gaussB(18000, 7000))),
      interest_rate: +Math.max(2, gaussB(7.5, 1.5)).toFixed(2),
      applicant_age: Math.min(75, Math.max(21, Math.round(gaussB(42, 11)))),
      debt_to_income: +Math.min(0.9, Math.max(0.05, gaussB(0.32, 0.1))).toFixed(3),
      employment_type: pickWeighted(randB, [
        ["salaried", 60],
        ["self_employed", 25],
        ["contract", 10],
        ["unemployed", 5],
      ]),
      home_ownership: pickWeighted(randB, [
        ["mortgage", 45],
        ["own", 30],
        ["rent", 25],
      ]),
    });
  }

  // ---- CURRENT (production after economic shift) ----
  const randC = mulberry32(7);
  const gaussC = makeGaussian(randC);
  const current: Record<string, unknown>[] = [];

  for (let i = 0; i < N; i++) {
    current.push({
      // SEVERE drift: incomes dropped, spread widened
      annual_income: Math.max(15000, Math.round(gaussC(58000, 22000))),
      // stable: credit scores barely moved
      credit_score: Math.min(850, Math.max(300, Math.round(gaussC(685, 62)))),
      // moderate drift: slightly larger loans
      loan_amount: Math.max(1000, Math.round(gaussC(21000, 8000))),
      // SEVERE drift: rates jumped
      interest_rate: +Math.max(2, gaussC(10.2, 1.8)).toFixed(2),
      // moderate drift: younger applicant pool
      applicant_age: Math.min(75, Math.max(21, Math.round(gaussC(36, 12)))),
      // SEVERE drift: debt burdens rose
      debt_to_income: +Math.min(0.9, Math.max(0.05, gaussC(0.45, 0.13))).toFixed(3),
      // categorical drift: gig economy boom
      employment_type: pickWeighted(randC, [
        ["salaried", 42],
        ["self_employed", 28],
        ["contract", 22],
        ["unemployed", 8],
      ]),
      // stable-ish
      home_ownership: pickWeighted(randC, [
        ["mortgage", 40],
        ["own", 28],
        ["rent", 32],
      ]),
    });
  }

  return { baseline, current };
}