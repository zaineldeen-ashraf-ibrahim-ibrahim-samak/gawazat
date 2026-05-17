# gawazat Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-17

## Active Technologies
- JavaScript ES2022 (no TypeScript — inherits the documented exception from feature 001) (master)
- Existing single encrypted JSON blob at `<userData>/store.enc` via Electron `safeStorage`. New persisted shapes: `settings.fieldRequirements`, `settings.geminiNoticeAcknowledged`, `session.duplicateDecisionsAudit[]` (master)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

cd src; pytest; ruff check .

## Code Style

## Recent Changes
- master: Added JavaScript ES2022 (no TypeScript — inherits the documented exception from feature 001)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
