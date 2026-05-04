---
name: typescript-react
description: TypeScript and React coding conventions — strict typing, functional components, testing patterns. Use when working with TypeScript, TSX, or React files.
---

# TypeScript / React Conventions

## Code style
- Use strict TypeScript (`strict: true`). No `any` unless absolutely unavoidable.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and intersections.
- Use functional components with hooks. No class components.
- Prefer named exports over default exports.

## Testing
- Use the test runner configured in the project (`vitest`, `jest`, or similar).
- For behaviour changes, write or update the smallest failing test first, then implement until it passes.
- Start with the narrowest test target the runner supports before using the full suite.
- Test behaviour, not implementation — assert on rendered output and user interactions.

## Commands
- Test: `npm run test` or `yarn test`
- Lint: `npm run lint`
- Type-check: `npx tsc --noEmit`
