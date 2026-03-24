# StockForge AI — Future Infrastructure & Platform Options

**Last updated:** 2026-03-22
**Status:** Exploration stream. Not an architecture commitment. Current stack is unchanged.

---

## Purpose of This Document

This document tracks infrastructure and platform options that are being explored for future phases of StockForge AI. Nothing here is an approved architecture change. The current stack (Next.js + Supabase + Anthropic + Polygon.io + Vercel) remains canonical until a deliberate, documented decision is made to change it.

An option moves from "exploration" to "adopted" only when:
1. A concrete problem with the current stack has been identified that the new option solves
2. The migration cost is proportionate to the value gained
3. The decision is documented here and reflected in `canonical-system-architecture.md`

Until those conditions are met, this document is a research log, not a roadmap.

---

## AWS — Active Exploration Stream

**Opened:** 2026-03-22
**Trigger:** AWS account created; exposure to Amazon Bedrock AgentCore and AWS AI service catalog prompted strategic thinking about future infrastructure.

### What AWS is and why it's relevant

AWS is the dominant cloud infrastructure provider. For an AI portfolio management platform, AWS's relevance is not primarily in compute (Vercel handles that for the current stack) but in three specific areas: managed AI infrastructure (Bedrock), long-lived persistent storage for audit and memory artifacts (S3), and enterprise-grade access control patterns (IAM) that become relevant as the platform scales.

### Service-level assessment

**Amazon Bedrock**
What it is: AWS's managed AI model platform. Hosts Claude (Anthropic), Llama (Meta), Titan (Amazon), Nova (Amazon), and others. Bedrock AgentCore is the emerging layer for production multi-agent orchestration — persistent memory, policy enforcement, real-time monitoring, audit trails.

Relevance to StockForge: High in later phases. StockForge's four-agent pipeline (Research → Policy → Risk → Rebalance) maps structurally onto what Bedrock AgentCore is designed to host. The agent orchestration, memory persistence, and audit trail that are being built manually in Phase 2–3 are capabilities that Bedrock AgentCore is being built to provide as managed infrastructure.

Current position: Not adopted. StockForge uses the Anthropic API directly. Bedrock adds AWS authentication overhead and latency for no current benefit. The time to evaluate Bedrock AgentCore is after Phase 2.5 (Proof Engine), when the agent pipeline exists and its infrastructure requirements are well-understood.

Decision criteria for adoption: If agent orchestration complexity in Phase 3–4 exceeds what can be cleanly maintained in Next.js API routes, or if multi-model strategy becomes important, Bedrock becomes a serious candidate. Evaluate at Phase 3 planning.

**AWS S3 (Simple Storage Service)**
What it is: Object storage. Highly durable, cheap at scale, accessible from any service.

Relevance to StockForge: Medium-high, particularly for Phase 2.5 onward. Specific use cases:
- Backtesting artifacts: simulation run results, performance reports, historical snapshots
- Decision log exports: immutable, long-term storage of agent decision history (audit trail at scale)
- Portfolio reports: generated PDFs or structured exports for user download
- Research memory corpus: long-form documents, uploaded files, research ingested into the RAG layer
- Agent chain-of-thought traces: if stored long-term for audit, S3 is more appropriate than Postgres rows

Current position: Not adopted. Supabase Storage handles current file needs adequately. S3 becomes a meaningful upgrade when file volumes, retention requirements, or cross-service access patterns outgrow what Supabase Storage is optimized for.

Decision criteria for adoption: If backtesting artifact storage or audit trail volume creates meaningful cost or complexity in Supabase Storage, migrate those specific artifact types to S3. This is a targeted migration, not a full stack change.

**AWS IAM (Identity and Access Management)**
What it is: AWS's access control system. Defines who (users, services, roles) can do what on which AWS resources.

Relevance to StockForge: Low for current phase, but valuable as a conceptual reference. IAM's model of roles, policies, and least-privilege access is the same mental model that should govern StockForge's own multi-tenant access control as the platform scales. Understanding IAM deeply makes it easier to reason about Supabase RLS policy design, API route permission checks, and agent execution constraints.

Current position: The Ethan account has IAM set up at the AWS account level. No application-level IAM integration planned. Use IAM as a learning reference for access control thinking.

Decision criteria for adoption: If StockForge moves toward an enterprise or multi-tenant model where different operator roles need different access levels (admin, analyst, read-only), IAM patterns would inform the permission model — but the implementation would likely remain in Supabase RLS, not AWS IAM directly.

**Broader AWS (EC2, Lambda, RDS, CloudWatch, etc.)**
Current position: Not in consideration. Vercel handles the Next.js deployment cleanly. Supabase handles the database cleanly. Adding AWS compute or database services duplicates existing infrastructure without solving a real problem.

The scenario in which broader AWS infrastructure becomes relevant is if StockForge outgrows the Vercel + Supabase footprint — specifically if agent execution workloads need persistent background processes (not possible on Vercel's serverless model), if the database needs to scale beyond Supabase's tiers cost-effectively, or if the platform enters an enterprise context requiring data residency guarantees.

That scenario is Phase 4+ territory. Do not evaluate it until it is needed.

---

## Current Stack — Canonical and Unchanged

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind | Live |
| Backend | Next.js API routes | Live |
| Database | Supabase (Postgres + Auth + RLS) | Live |
| AI | Anthropic Claude Sonnet (direct API) | Live |
| Market data | Polygon.io | Live |
| Deployment | Vercel | Live |

Any proposal to change a layer in this table requires a concrete problem statement, a migration plan, and a Cowork architecture decision before CodeX implements anything.

---

## Exploration Log

| Date | Service | Action | Outcome |
|---|---|---|---|
| 2026-03-22 | AWS (general) | Account created | Free tier active; $10/month budget alert set |
| 2026-03-22 | Amazon Bedrock | Console exploration initiated | Service catalog reviewed; no access requests made yet |
| 2026-03-22 | AWS IAM | Root account created | IAM user creation recommended for daily use |

---

## NVIDIA NemoClaw — High-Relevance Exploration Stream

**Opened:** 2026-03-22
**Source:** Announced by Jensen Huang at GTC 2026 (March 16, 2026)
**Status:** Early preview / alpha. Actively monitored. Evaluate for Phase 3 agent execution layer.

### What it is

NemoClaw is NVIDIA's open-source security and control layer built on top of OpenClaw (a fast-growing AI agent framework). It wraps OpenClaw with the enterprise-grade safety, policy enforcement, and audit infrastructure that autonomous agents require before they can be trusted with real decisions.

It is currently in early preview. APIs and sandbox behaviors are subject to change.

### Why this is directly relevant to StockForge

NemoClaw's core features map almost exactly onto StockForge's Phase 3 HITL safety requirements:

| NemoClaw Feature | StockForge Equivalent |
|---|---|
| Policy-driven controls over when agents may act | `portfolio_policies` enforcement + pre-approval risk gate |
| Observability and auditability of agent reasoning | Decision log + agent chain-of-thought storage |
| Hardened sandbox execution (OpenShell, Landlock, seccomp) | Agent execution isolation — currently planned as custom implementation |
| Action history and compliance logs | Immutable audit trail (Phase 3 deliverable) |

In plain terms: what StockForge plans to build manually in Phase 3 is what NemoClaw is building as an open-source platform. This is not a coincidence — it reflects the industry converging on the same safety requirements for autonomous agents. NemoClaw could serve as the agent execution runtime for Phase 3–4, replacing a significant portion of the custom safety infrastructure planned.

### Current technical requirements

- OS: Ubuntu 22.04 LTS or later (required — not macOS natively)
- Minimum: 4 vCPUs, 8GB RAM, 20GB disk
- Recommended: 16GB RAM
- Runtime dependencies: Docker, Node.js 20+, npm 10+
- Hardware: Agnostic (AMD/Intel/cloud instances all supported). Local inference works best with NVIDIA GPU. NVIDIA DGX Spark and DGX Station are flagship local execution platforms.

### Current position

Not adopted. Alpha stage — not production-ready. The time to evaluate NemoClaw for production use is Phase 3 planning, when a stable release may exist and the agent pipeline is built enough to test against.

### Decision criteria for adoption

Evaluate NemoClaw as the Phase 3 agent execution substrate if: (a) a stable release exists by the time Phase 3 planning begins, (b) it supports the four-agent pipeline architecture (Research → Policy → Risk → Rebalance) without requiring fundamental restructuring, and (c) the policy enforcement model is compatible with StockForge's `portfolio_policies` schema. If any of those conditions fail, continue with custom implementation as planned.

---

## Local Hardware — Dedicated Agent Machine

**Opened:** 2026-03-22
**Updated:** 2026-03-22 — revised after NemoClaw research
**Status:** Evaluate at graduation (May 2026). Hardware recommendation revised.

### Use case

Two Phase 2.5+ workloads justify dedicated hardware: the backtesting simulation runner (computationally intensive, benefits from not competing with daily laptop use) and continuous paper trading / agent execution (benefits from 24/7 uptime without battery or thermal constraints).

### Working hardware plan (updated 2026-03-22)

**Mac Mini M4 Pro + Cloud GPU on-demand. This is the adopted direction.**

**Why NemoClaw does not change this:** NemoClaw's value is adding safety and policy enforcement to agents that lack it. StockForge is building that layer natively — `portfolio_policies`, HITL approval workflow, decision logs, anti-hallucination gates, immutable audit trail. The safety architecture is a first-class design concern, not an afterthought. NemoClaw is therefore largely redundant for this use case, and its Ubuntu/NVIDIA hardware requirement does not apply. OpenClaw (the underlying framework NemoClaw wraps) runs natively on macOS and can be evaluated independently on its own merits as an agent orchestration option.

**Mac Mini M4 Pro — dedicated agent and development machine**
- 24GB or 48GB unified memory configuration
- Runs 24/7 without battery or thermal constraints
- Native macOS environment — best development platform for the Next.js + TypeScript stack
- OpenClaw runs natively on macOS
- M4 Pro unified memory handles local agent orchestration and light model inference (Ollama, LM Studio) effectively
- Dedicated Apple ID to keep automation environment isolated from personal environment
- ~$800–1,400 depending on memory configuration
- Handles: local development, paper trading agent loop, light 24/7 workloads, OpenClaw orchestration

**Cloud GPU on-demand — for compute-intensive workloads**
- Provider options: Lambda Labs, RunPod, AWS EC2 G-series
- Pay-per-hour, no idle cost
- Use for: Phase 2.5 backtesting simulation runs, stress testing, any workload that needs NVIDIA GPU and significant RAM
- Spin up → run simulation → pull results → shut down
- This model is more cost-effective than owning NVIDIA hardware for workloads that run occasionally

**Vercel — app deployment (unchanged)**
- Next.js deployment stays on Vercel
- Serverless model works for API routes and the current architecture
- Phase 3 caveat: long-running agent orchestration loops will hit Vercel's serverless timeout ceiling; at that point a persistent process (on Mac Mini or a cloud VM) takes over agent execution

### Decision gate

Purchase justified at graduation (May 2026) if Phase 2 is actively underway. If Phase 1 hardening is still incomplete, defer — the bottleneck is execution discipline, not hardware.

---

## Exploration Log

| Date | Service/Tool | Action | Outcome |
|---|---|---|---|
| 2026-03-22 | AWS (general) | Account created | Free tier active; $10/month budget alert set |
| 2026-03-22 | Amazon Bedrock | Console exploration initiated | Service catalog reviewed; no access requests made yet |
| 2026-03-22 | AWS IAM | Root account created | IAM user creation recommended for daily use |
| 2026-03-22 | NVIDIA NemoClaw | Researched after user reference | High-relevance Phase 3 candidate; early alpha; Ubuntu/NVIDIA required; hardware recommendation revised |

---

*Next review of this document: at Phase 2.5 planning — evaluate NemoClaw stability for Phase 3 agent execution; evaluate Bedrock AgentCore as alternative; decide hardware based on which runtime is adopted.*
