<!--
SYNC IMPACT REPORT
==================
Version change: (template/unversioned) → 1.0.0
Bump rationale: Initial ratification of project constitution from template placeholders.
Modified principles: N/A (initial adoption)
Added sections:
  - Core Principles (5 principles)
  - Technology & Platform Constraints
  - Development Workflow & Quality Gates
  - Governance
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md ⚠ pending (verify Constitution Check aligns with i18n/UI-lib/Electron principles)
  - .specify/templates/spec-template.md ⚠ pending (ensure bilingual UX requirements are surfaced)
  - .specify/templates/tasks-template.md ⚠ pending (ensure i18n + Electron packaging task categories exist)
  - .specify/templates/commands/*.md ⚠ pending (no agent-specific references audited yet)
  - README.md ⚠ pending (no project README authored yet)
Deferred TODOs:
  - TODO(PROJECT_DESCRIPTION): formal product description not yet authored
-->

# Gawazat Constitution

## Core Principles

### I. Bilingual Internationalization (AR/EN) — NON-NEGOTIABLE
All user-facing strings MUST be routed through an i18n layer (e.g., `i18next` /
`react-i18next`) supporting at minimum Arabic (`ar`) and English (`en`) locales.
Hard-coded UI strings are prohibited. The UI MUST correctly switch direction
(`rtl` for `ar`, `ltr` for `en`) including layout mirroring, iconography, and
input alignment. Locale resources MUST live under a dedicated `locales/`
directory with one JSON (or equivalent) file per language and per namespace.
Adding a feature requires adding both `ar` and `en` translations in the same
change set; missing translations MUST fail CI.

**Rationale:** Arabic is a primary target audience; retrofitting RTL and
translations after the fact is costly and produces broken layouts.

### II. UI Library First
The interface MUST be built on an established UI component library (e.g.,
Material UI, Ant Design, Chakra UI, shadcn/ui, or equivalent). Building custom
primitives (buttons, inputs, modals, tables, form controls) from scratch is
prohibited unless the chosen library demonstrably lacks the capability AND a
written justification is recorded in the feature plan. The selected library
MUST support RTL out of the box or via a documented adapter.

**Rationale:** Reusing a maintained library yields accessibility, theming, and
RTL support far cheaper than reinventing them, and keeps visual consistency.

### III. Electron Desktop Delivery
The application MUST be packaged and distributed as an Electron desktop
application targeting Windows as the primary platform. Architecture MUST
respect Electron's process model: a `main` process for OS/native integration,
a `preload` script exposing a typed, minimal IPC surface via
`contextBridge`, and `renderer` processes for UI. `nodeIntegration` MUST be
disabled in renderers and `contextIsolation` MUST be enabled. Native APIs are
called only from `main`; renderers reach them exclusively through whitelisted
IPC channels.

**Rationale:** This is a Windows desktop app; Electron is the chosen runtime.
Strict process separation is the documented Electron security baseline.

### IV. Test-First Discipline
Every feature MUST land with automated tests written before or alongside the
implementation. Renderer UI logic SHOULD be covered by component tests; IPC
contracts between `main` and `renderer` MUST have contract tests; locale
files MUST be validated for key parity between `ar` and `en`. A change MUST
NOT merge with failing or skipped tests.

**Rationale:** Desktop + bilingual UI has many seams (IPC, packaging, RTL
regressions); tests are the only scalable safety net.

### V. Simplicity & YAGNI
Add only what the current feature requires. Do not introduce abstractions,
configuration toggles, plugin systems, or optional dependencies for
hypothetical future needs. Prefer the smallest correct change. Removing dead
code is preferred over preserving it "just in case".

**Rationale:** Scope creep is the dominant risk in desktop apps; small surface
area keeps the Electron bundle, attack surface, and maintenance cost low.

## Technology & Platform Constraints

- **Runtime/Shell:** Electron (latest stable LTS-aligned major).
- **Primary OS target:** Windows 10 and Windows 11 (x64). Other OSes are best
  effort and MUST NOT block a Windows release.
- **UI stack:** A single chosen UI component library + i18n library
  (`i18next` family or equivalent). Mixing multiple competing component
  libraries in the same app is prohibited.
- **Languages:** Source language MUST be TypeScript for both `main` and
  `renderer` unless an exception is documented in the plan.
- **Packaging:** Builds MUST be reproducible via a single command and produce
  a signed (when keys are available) Windows installer artifact.
- **Security baseline (Electron):** `contextIsolation: true`,
  `nodeIntegration: false`, `sandbox: true` where feasible, a strict
  `Content-Security-Policy`, and no `remote` module usage.

## Development Workflow & Quality Gates

- **Specification flow:** All non-trivial work follows the Spec-Kit flow
  (`/speckit.specify` → `/speckit.plan` → `/speckit.tasks` →
  `/speckit.implement`). Plans MUST include a Constitution Check confirming
  the five principles above.
- **Branching & commits:** Feature branches per change; commits scoped and
  descriptive. The Spec-Kit git hooks (`.specify/extensions.yml`) are the
  authoritative automation surface for commits around constitution, spec,
  plan, tasks, and implement steps.
- **Quality gates before merge:**
  1. Type checks pass.
  2. Tests pass (unit, IPC contract, locale-parity).
  3. Lint passes.
  4. Both `ar` and `en` translations present for any new UI string.
  5. App boots in a packaged Electron build (smoke check) for renderer-
     facing changes.
- **Reviews:** Every PR MUST be reviewed against this constitution; reviewers
  block on principle violations unless an explicit, written exception is
  recorded in the plan's Complexity Tracking section.

## Governance

This constitution supersedes ad-hoc conventions and informal practices.
Amendments require:

1. A PR modifying `.specify/memory/constitution.md` with a Sync Impact
   Report header describing the version bump and downstream template
   updates.
2. Version bump per semantic versioning:
   - **MAJOR** — removing or redefining a principle in a backward-incompatible
     way.
   - **MINOR** — adding a new principle or materially expanding existing
     guidance.
   - **PATCH** — wording, clarifications, typo fixes.
3. Propagation: dependent templates under `.specify/templates/` and any
   runtime guidance docs MUST be updated in the same change set or tracked as
   explicit follow-ups in the Sync Impact Report.
4. Compliance review: PR reviewers verify the change does not regress any
   principle; deviations require a written, time-boxed exception.

**Version**: 1.0.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-28