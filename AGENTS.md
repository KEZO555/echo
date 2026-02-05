# Echo

A minimal Spotify client for Light Phone III built with Expo.

## Tech Stack
- Expo
- Spotify Web API
- Spotify Android SDK

## Commands
- `bunx expo run:android` to run the app

## Rules
- Use British English
- Avoid using comments unless absolutely necessary
- Use bun instead of npm
- Use TypeScript with strict mode enabled
- Use correct types, never use any
- Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.
- After making code changes, run `bun x ultracite fix` to auto-format and lint

#### React useEffect Guidelines
Before using `useEffect` read: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)

Common cases where `useEffect` is NOT needed:
- Transforming data for rendering (use variables or useMemo instead)
- Handling user events (use event handlers instead)
- Resetting state when props change (use key prop or calculate during render)
- Updating state based on props/state changes (calculate during render)

Only use `useEffect` for:
- Synchronizing with external systems (APIs, DOM, third-party libraries)
- Cleanup that must happen when component unmounts
