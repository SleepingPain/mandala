# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A **Mandal-Art Todo** app — a Korean-language task management tool built around the Mandal-Art (만다라트) planning method with AI-powered features (onboarding, task suggestions, reflections via Claude API).

## Commands

- `npm run dev` — start Vite dev server on port 3000 (auto-opens browser)
- `npm run build` — type-check with `tsc -b` then build with Vite
- `npm run preview` — preview production build
- No test framework is configured.

## Architecture

**Vite + React 18 + TypeScript** app. Deployed to Vercel.

### Key Files

- `src/App.tsx` — the entire application lives in this single ~1200-line component (`App`). All types, helpers, state, and UI are defined here. This is the file you will edit for virtually all changes.
- `src/main.tsx` — React entry point, renders `<App />` into `#root`.
- `api/ai.js` — Vercel serverless function that proxies requests to the Anthropic Claude API. Accepts `{ prompt, systemPrompt, apiKey }` via POST.
- `mandal-todo.tsx` — legacy standalone version of the component (predates the Vite setup). Not used by the current app.
- `index.html` — HTML shell with print styles and Korean font stack.

### Data Model (in-memory state in App.tsx)

- **AppData** — top-level state object containing all entities:
  - **tasks** — todo items with status flow: `draft` → `placed` → `done` → `reflect`. Can be flagged `_today` for daily focus. Have priority, urgency, importance, category, deadline, and timeSlot fields.
  - **folders** — top-level groupings, each linked to a root board.
  - **boards** — 3×3 Mandal-Art grids. Center cell (position 4) is the theme; other cells can drill down into child boards (recursive hierarchy).
  - **cells** — grid positions within a board. Link to tasks via `linkedTaskIds` and can have `childBoardId` for drill-down.
  - **reflections** — date-keyed journal entries linked to reflected tasks.
  - **clusters**, **connections**, **dailyMoods**, **folderLinks** — additional relationship/tracking entities.

- **UserProfile** — onboarding data (occupation, goals, life pattern, work style, concerns). Persisted in `localStorage` under key `mandal-profile`.
- **XP System** — gamification layer tracking experience points and streaks. Persisted in `localStorage` under key `mandal-xp`.

### Persistence

App data is persisted via `localStorage` under key `mandal-v2` with 500ms debounce. State is deep-cloned on every update via JSON parse/stringify pattern.

### UI Tabs

Bottom navigation with tabs: 홈 (Home), 임시함 (Staging/drafts), 폴더 (Folders), 만다라트 (Mandal-Art grid), 오늘 (Today's tasks), 회고 (Reflection/journal), and more.

### AI Integration

The app calls `/api/ai` (Vercel serverless function) for AI features like task suggestions, reflection prompts, and onboarding personalization. The serverless function proxies to Claude API using an API key from env or client.

## Key Conventions

- All UI text is in Korean.
- Color system is defined in the `C` constant object at the top of `App.tsx`.
- Status styles (colors, labels) are in `statusStyle`; priority metadata in `priorityMeta`.
- Inline styles throughout — no CSS files or CSS-in-JS library.
- `uid()` generates IDs from an incrementing counter seeded with `Date.now()`.
- Uses `html2canvas` for screenshot/export functionality.
- Drag & drop uses native HTML drag-and-drop API (`dataTransfer`).
