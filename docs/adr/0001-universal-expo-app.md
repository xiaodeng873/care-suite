# ADR 0001: Universal Expo App as Single Frontend for All Platforms

**Status**: Accepted  
**Date**: 2026-05-25

## Context

SeniorCare currently has two separate frontends:
- `apps/web/` — React + Vite + Tailwind CSS, deployed on Vercel
- `apps/mobile/` — Expo + React Native, covering only the Care Records feature

The goal is to deliver SeniorCare as a native app (iOS/Android) with full feature parity with the web, while also maintaining a web deployment. The stated pain point is UI adaptation across phone portrait, tablet landscape, and web browser.

Three options were considered:

1. **Capacitor**: Wrap the existing web app in a native shell
2. **Extend existing Expo app**: Port all web features to pure React Native
3. **Universal Expo app (Expo for Web + React Native)**: One codebase rendering natively on iOS/Android and as a web app via React Native Web

## Decision

Build a new **universal Expo app** in `apps/app/` using:
- **Expo Router v3** (file-based routing, works on native and web)
- **NativeWind v4** (Tailwind class names on React Native components)
- **React Query** (data fetching + read-only offline cache via `persister`)
- **Expo Secure Store** (auth token persistence across platforms)

The existing `apps/web/` stays live and untouched during the transition period. The new `apps/app/` is developed in parallel. Once feature-complete, the Vercel deployment is switched to `apps/app/` and `apps/web/` is retired.

The existing `apps/mobile/` (Care Records only) is superseded by `apps/app/` and will be removed after migration.

## Consequences

- **One component codebase** for phone, tablet, and web — design changes propagate everywhere
- **NativeWind v4** covers ~85% of Tailwind utilities; remaining edge cases use the `style` prop alongside `className`
- **Expo for Web** replaces the Vite build for the web frontend; Metro bundler replaces Vite
- **Transition period** requires maintaining `apps/web/` for production while `apps/app/` is built — new features are developed only in `apps/app/` during this period; `apps/web/` receives bug fixes only
- **Multi-tenancy** (`facility_id`) is not in the DB schema yet; the data layer in `apps/app/` is designed to accept `facilityId` as a parameter so the DB migration can be slotted in later without changing call sites

## Alternatives Rejected

**Capacitor**: Does not resolve the UI redesign problem (desktop-first web UI is still desktop-first inside a WebView). Also carries Apple App Store rejection risk for WebView-only apps.

**Extend `apps/mobile/` in place**: The existing architecture (6 screens, simple navigation) does not scale to 30+ features without a full structural rebuild, making a clean-slate approach lower risk.
