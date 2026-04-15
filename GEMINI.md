# Reelio — Agent Identity File

## What This Project Is
Reelio is a Chrome Extension (Manifest V3) that intercepts Instagram's internal GraphQL API calls when the user browses their saved reels at https://www.instagram.com/ayush.hs26/saved/all-posts/, enriches each reel with spoken transcript (from .vtt CC files) and metadata, stores everything locally in IndexedDB, and enables natural language search via a browser popup.

## Read These Docs First (in order)
1. `docs/01_PRD.docx` — requirements, user flows, features
2. `docs/02_SYSTEM_DESIGN.docx` — data models, data flow diagrams, component responsibilities
3. `docs/03_ARCHITECTURE.docx` — file structure, manifest, module specs, message protocols
4. `docs/04_PHASE_ROADMAP.docx` — 4 build phases with task lists and verification checklists
5. `docs/05_CODING_AGENT_BRIEF.docx` — quick reference, constraints, definition of done

## Absolute Rules (Never Break These)
- NO backend, server, or cloud function of any kind
- NO paid APIs (no OpenAI, Anthropic, Google Cloud Vision, etc.)
- NO localStorage — use IndexedDB for reel data, chrome.storage.local for settings only
- NO UI injected into Instagram pages — popup only
- NO video downloads — thumbnails and .vtt text only
- NO hardcoded Instagram GraphQL doc_id — use structural fingerprinting
- ALL interception errors must be silently swallowed — never break Instagram

## The Single Most Critical Technical Fact
Content scripts in Chrome MV3 run in an **isolated JavaScript world**.
They CANNOT patch `window.fetch` as Instagram sees it.
The correct approach is a **3-layer architecture**:

1. `public/page-interceptor.js` — injected into Instagram's page JS context via `<script>` tag. Patches fetch + XHR. Fires `CustomEvent("reelioApi")`.
2. `content.js` — injects page-interceptor.js, listens for CustomEvents, relays to background.
3. `background.js` (Service Worker) — receives `API_PAYLOAD` messages, parses, deduplicates, runs enrichment pipeline.

**Never attempt to patch fetch directly inside content.js. It will silently fail.**

## Build Phases
Complete each phase fully and pass its verification checklist before moving to the next.
- Phase 1: Interception working, raw reel data logged to console
- Phase 2: Enrichment pipeline + IndexedDB storage, badge count live
- Phase 3: Semantic search via popup UI
- Phase 4: Vision model (opt-in), settings panel, Chrome Web Store ready

## Tech Stack
- Chrome Extension MV3 (no framework)
- webpack 5 for bundling
- transformers.js + all-MiniLM-L6-v2 (25MB, free, local) for semantic search
- Moondream2 via WASM (1.8GB, opt-in) for visual frame descriptions
- IndexedDB for all storage
- Zero external APIs, zero cost