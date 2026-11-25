---
name: typescript-react
description: Opinionated TypeScript and React conventions — strict types, interface/named-export preferences, and behaviour-first testing. Use when working with TypeScript, TSX, or React files.
---

# TypeScript / React Conventions

## Preferences
- Keep TypeScript strict (`strict: true`); avoid `any` unless justified at an untyped boundary.
- Prefer `interface` over `type` for object shapes; use `type` for unions and intersections.
- Prefer named exports over default exports (unless framework routing requires a default export) and functional components with hooks.

## Testing
- For behaviour changes, write or update the smallest failing test first using the repo's configured runner (`vitest`, `jest`, etc.), targeting the single file/test before the full suite.
- Assert on user-visible rendered output and interactions rather than internal component state.

## Validation
- Prefer the repository's scripts from `package.json` or CI for test, lint, format, and type-check (`tsc --noEmit`).
