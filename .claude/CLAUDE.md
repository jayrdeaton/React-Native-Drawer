# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# @rific/drawer

Sliding drawer/sheet for React Native. Spring-animated, theme-aware (reads colors from `react-native-paper`), and opens either by calling an action, by swiping in from the screen edge, or by dragging its own handle. Slides in from any of the four edges (`left`/`right` for a nav/settings drawer, `top`/`bottom` for a sheet) using the same mechanism either way; one `createDrawer()` call per drawer instance, so multiple drawers stay fully independent.

Part of the `@rific` package ecosystem. Published at https://www.npmjs.com/package/@rific/drawer. Optional peer `@rific/auto-paper` lives at `../React-Native-Auto-Paper`.

## Commands

```bash
npm run lint         # ESLint
npm run fix          # ESLint --fix
npm run build        # tsup, outputs CJS + ESM + types to dist/
npm run build:watch  # tsup --watch
npm test             # Jest (131 tests)
npm run test:watch   # Jest in watch mode
npm run typecheck    # TypeScript type check (tsc --noEmit)
npm run verify       # lint + test + typecheck + build, in that order
```

Always run `npm run lint` before finishing any task.

## Release

Tag-based, using npm trusted publishing (OIDC, no token required):

```bash
npm run release:patch   # npm version patch && git push --follow-tags (or release:minor / release:major)
```

`preversion` runs `npm run verify` first. `prepublishOnly` runs `npm run build`. `publish.yml` fires on `v*` tags and delegates to the shared reusable workflow (`infinitetoken/Workflows/.github/workflows/npm-publish.yml@v1`) with `id-token: write` permission for OIDC trusted publishing. `ci.yml` runs on every PR and push to `main` via the shared `npm-ci.yml` reusable workflow, which runs `npm run verify`.

## Architecture

```
src/
  index.ts                              - all public exports
  geometry.ts                           - pure math: DrawerSide/DrawerDimension types, isVerticalSide, getClosedOffset, getOpenDirection, resolveDimension, getExpandProgress
  useDrawerSize.ts                      - hook: resolves a drawer's percentage-or-px size props (plus optional expand ceiling) against the current window size into closedOffset/effectiveSize/maxEffectiveSize/restOffset; shared by Drawer, DrawerEdgeSwipe, and createDrawer so all three agree on geometry
  Drawer.tsx                            - the sliding panel itself: backdrop (tap-to-close), spring-animated panel, optional content-driven sizing, optional drag handle (dismiss + expand), optional panel shadow, optional blur fill (via injected auto-paper)
  DrawerEdgeSwipe.tsx                   - a thin invisible strip along one screen edge; a pan gesture drags the panel open and commits/snaps-back based on distance or velocity
  createDrawer.tsx                      - factory: one call per drawer instance. Returns { DrawerInstanceProvider, useDrawer }, backed by a private React Context; wires Drawer + DrawerEdgeSwipe + Android back-button handling together. Also exports combineDrawerProviders to flatten nesting multiple instances
  DrawerConfig.tsx                      - module-level mutable config (configureDrawer()/getDrawerConfig()) for injecting the optional @rific/auto-paper peer (BlurView/useBlur), plus a DrawerProvider wrapper that calls configureDrawer() synchronously during render
  __mocks__/
    react-native.ts                     - jest mock: StyleSheet, View, Platform (OS: 'ios'), BackHandler.addEventListener, useWindowDimensions
    react-native-paper.ts               - jest mock: useTheme() returning a fixed surface color
    react-native-reanimated.ts          - jest mock: useSharedValue/useAnimatedStyle/useDerivedValue/withSpring/withTiming/runOnJS, Animated.View stub
    react-native-gesture-handler.ts     - jest mock: chainable Gesture.Pan()/Gesture.Tap() builders with a __getHandlers() test escape hatch, GestureDetector stub
    rific-auto-paper.ts                 - jest mock: BlurView stub, useBlur() returning the override or false
  __tests__/
    Drawer.test.tsx
    Drawer.autoPaperMissing.test.tsx    - Drawer's solid-fill fallback path when auto-paper isn't configured
    DrawerEdgeSwipe.test.tsx
    DrawerConfig.test.tsx
    createDrawer.test.tsx
    combineDrawerProviders.test.tsx
    geometry.test.ts
    index.test.ts                       - asserts the public export surface
```

## Public API

From `src/index.ts`:

- `createDrawer`, `combineDrawerProviders` — the factory and its multi-drawer nesting helper; `CreateDrawerOptions`, `CreateDrawerResult`, `DrawerActions`, `DrawerInstanceProviderComponent`, `DrawerInstanceProviderProps` (types)
- `Drawer`, `DrawerProps` — the underlying panel component, for consumers who want to drive it directly instead of through `createDrawer()`
- `DrawerEdgeSwipe`, `DrawerEdgeSwipeProps` — the underlying edge-swipe-to-open strip
- `configureDrawer`, `getDrawerConfig`, `DrawerProvider` — one-time app-wide peer-module injection (auto-paper blur support); `DrawerConfig`, `DrawerProviderProps`, `AutoPaperModule` (types)
- `DrawerDimension`, `DrawerSide` (types only)

## Peer Dependencies

- `react` >=19.0.0, `react-native` >=0.83.0 — required
- `react-native-gesture-handler` >=2.20.0 <3.0.0 — required. Backdrop tap-to-close, drag handle, and `DrawerEdgeSwipe`'s pan gesture
- `react-native-reanimated` >=4.0.0 — required. Spring/timing-driven open/close, content-size transitions, backdrop/handle/shadow opacity
- `react-native-paper` >=5.0.0 — required. `useTheme()` supplies the panel's fill color
- `react-native-worklets` 0.10.x — required. Ships alongside Reanimated 4; not directly imported by this package's runtime code, but its worklet-import allowlist is why `createDrawer.tsx` inlines a copy of `geometry.ts`'s `getExpandProgress` instead of importing it (see that file's comment)
- `@rific/auto-paper` >=0.7.0 — optional (`peerDependenciesMeta`). Injected via `configureDrawer()`/`<DrawerProvider>` to render a real frosted-glass `BlurView` fill instead of the solid-color fallback; never auto-detected (Metro doesn't rewrite a `require()`-in-`try/catch` into its module graph inside an ESM build). `DrawerConfig.tsx` keeps a local type-only mirror of the two symbols it needs (`BlurView`, `useBlur`) rather than importing the package directly, so consumers without it installed still typecheck/build fine.

## Testing

- Framework: Jest (`@infinitetoken/jest-config/react-native`), jsdom environment
- Mocks in `src/__mocks__/` for `react-native`, `react-native-paper`, `react-native-reanimated`, `react-native-gesture-handler`, `@rific/auto-paper`
- 131 tests across 8 suites (see file list above)
- Coverage (measured 2026-08-30): 99.57% statements, 96.55% branches, 100% functions, 100% lines — comfortably clears the shared preset's enforced 70% floor on all four metrics. No local `collectCoverageFrom`/`coverageThreshold` override; single entry point (`package.json` `exports` has no subpath conditions), so no subpath-barrel exception is needed either.
- `Drawer.tsx` and `useDrawerSize.ts` are the least-covered files (95.33% and 80% branch respectively) — a few edge-case branches (e.g. percentage-size zero-denominator guards) are exercised less than the rest.

## Code Style

Enforced by ESLint + Prettier (`eslint.config.cjs` is a bare `require('@infinitetoken/eslint-config/react-native')`), run `npm run lint` before finishing any task.

**Prettier config:**
- Single quotes, JSX single quotes
- No semicolons
- No trailing commas
- Print width: 1000 (effectively disabled)

**ESLint rules (warnings unless noted):**
- `simple-import-sort` — imports and exports must be sorted
- `react-native/no-inline-styles` — no inline style objects
- `react-native/no-unused-styles` — no unused StyleSheet entries
- `no-console` — no console statements
- `@typescript-eslint/no-unused-vars` — `varsIgnorePattern`/`argsIgnorePattern`/`caughtErrorsIgnorePattern: '^_'` (unused vars/args/caught errors prefixed `_` are allowed)
- `@typescript-eslint/no-explicit-any` — off in `__tests__/`/`__mocks__/`; on in `src/` proper (not currently disabled anywhere in this package's own source)
- `react-hooks/rules-of-hooks` — error, not a warning
- `react-hooks/exhaustive-deps`, `react-hooks/refs`, `react-hooks/immutability`, `react-hooks/preserve-manual-memoization`, `react-hooks/set-state-in-effect`
- `package-json/order-properties`, `package-json/sort-collections` — on `package.json` itself

Current `npm run lint` output: 1 warning, 0 errors — `react-hooks/refs` on `src/__mocks__/react-native-reanimated.ts` (`useSharedValue`'s mock reads a ref's `.current` during render). Test-infrastructure only, doesn't affect shipped `dist/`, and doesn't fail `verify`.

`tsconfig.json` is `{ "extends": "@infinitetoken/tsconfig/react-native", "include": ["src"] }` — no local compiler-option overrides, no `exclude` (the whole `src` tree, including `__mocks__`/`__tests__`, typechecks clean).
