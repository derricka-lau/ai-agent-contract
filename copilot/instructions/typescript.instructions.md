---
applyTo: "*.{ts,tsx}"
---

# TypeScript / React conventions

## Code style
- Use strict TypeScript (`strict: true`). No `any` unless absolutely unavoidable.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and intersections.
- Use functional components with hooks. No class components.
- Prefer named exports over default exports.

## Testing
- Use the test runner configured in the project (`vitest`, `jest`, or similar).
- Test behaviour, not implementation — assert on rendered output and user interactions.

## Commands
- Test: `npm run test` or `yarn test`
- Lint: `npm run lint`
- Type-check: `npx tsc --noEmit`
