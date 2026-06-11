# ModelPulse — ML Drift Monitoring & Observability

> Detect silent model failure before it costs you money.

ModelPulse is a lightweight ML observability tool that detects **data drift** between a model's training-time (baseline) data and its live production data — the #1 cause of silent ML model degradation in industry.

**🔗 Live demo:** https://modelpulse-tau.vercel.app

## The problem

ML models don't fail loudly. When production data drifts away from the training distribution — an economic shift, a new user demographic, an upstream pipeline change — accuracy quietly degrades while the model keeps serving predictions. Companies like Arize, Evidently, and WhyLabs built entire businesses around this problem.

## What ModelPulse does

Upload two CSVs (baseline + production logs, matching columns) and get:

- **Per-feature drift ranking** using three statistical tests
- **Severity classification** using industry-standard PSI thresholds (0.1 / 0.25)
- **Interactive distribution comparison** charts (baseline vs production)
- **Exportable drift report** in Markdown
- **One-click demo**: a loan-default model hit by an economic shift

## Drift metrics implemented

| Metric | Used for | Notes |
|---|---|---|
| **PSI** (Population Stability Index) | Numeric + categorical | Industry-standard thresholds: <0.1 stable, 0.1–0.25 moderate, ≥0.25 severe |
| **KS statistic** (Kolmogorov–Smirnov) | Numeric | Max distance between empirical CDFs |
| **Jensen–Shannon divergence** | Numeric + categorical | Symmetric, bounded alternative to KL divergence |

All statistics are implemented from scratch in TypeScript (`src/lib/drift.ts`) — no stats library dependencies. Auto-detects numeric vs categorical columns.

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS** — dark observability-style dashboard
- **Recharts** — distribution visualizations
- **PapaParse** — client-side CSV parsing (your data never leaves the browser)
- Deployed on **Vercel**

## Run locally

```bash
git clone https://github.com/Atharv-725/modelpulse.git
cd modelpulse
npm install
npm run dev
```

Open http://localhost:3000 and click **Try the demo**.

## Related research

This project productizes ideas from my research on adaptive federated learning with **concept drift detection** (IEEE-format preprint, EasyChair #52853).

---

Built by **Atharv Dorle (Thunder)** · [GitHub](https://github.com/Atharv-725) · [LinkedIn](https://www.linkedin.com/in/atharv-dorle-6552602b8/)