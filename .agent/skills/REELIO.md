# Skill: Reelio Chrome Extension Development

## Purpose
This skill teaches the coding agent the specific patterns, constraints, and workflows for building the Reelio Chrome Extension. Read this before writing any code.

---

## Project Layout
```
reelio/
├── GEMINI.md                        ← you are reading this project's companion
├── manifest.json
├── package.json
├── webpack.config.js
├── public/
│   └── page-interceptor.js          ← PAGE CONTEXT script (not bundled by webpack)
├── src/
│   ├── content/content.js           ← injects page-interceptor, relays events
│   ├── background/
│   │   ├── background.js            ← Service Worker orchestrator
│   │   ├── pipeline/
│   │   │   ├── interceptor.js       ← GraphQL fingerprinter + parser
│   │   │   ├── cc-fetcher.js        ← .vtt subtitle fetcher
│   │   │   ├── metadata-tagger.js   ← rule-based category tagger
│   │   │   └── document-builder.js  ← assembles ReelDocument
│   │   ├── storage/
│   │   │   ├── db.js                ← IndexedDB promise wrapper
│   │   │   └── tier-manager.js      ← Tier 1/2 demotion logic
│   │   └── search/
│   │       ├── search.js            ← cosine similarity engine
│   │       └── keyword-fallback.js  ← Tier 2 text search
│   ├── workers/
│   │   ├── embedding-worker.js      ← transformers.js + MiniLM
│   │   └── vision-worker.js         ← Moondream2 WASM
│   └── popup/
│       ├── popup.html
│       ├── popup.js
│       └── popup.css
├── assets/icons/                    ← 16px, 48px, 128px
└── tests/
```

---

## Interception Pattern (Most Critical)

### Why 3 layers exist
Chrome MV3 content scripts live in an isolated JS world. `window.fetch` inside a content script is NOT the same fetch Instagram calls. Patching it there intercepts nothing from Instagram.

### Layer 1 — public/page-interceptor.js
```javascript
(function () {
  if (window.__reelioInterceptor) return;   // idempotency guard — REQUIRED
  window.__reelioInterceptor = true;

  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const resp = await originalFetch.apply(this, arguments);
    try {
      const url = typeof input === 'string' ? input : input.url || '';
      if (url.includes('/graphql') || url.includes('/api/')) {
        const cloned = resp.clone();         // ALWAYS clone — body reads once
        const text = await cloned.text();
        window.dispatchEvent(new CustomEvent('reelioApi', {
          detail: { url, body: text, status: resp.status, method: init?.method || 'GET' }
        }));
      }
    } catch (e) { /* silent — never break Instagram */ }
    return resp;                             // return ORIGINAL to Instagram
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._reelioUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      if (this._reelioUrl?.includes('/graphql')) {
        window.dispatchEvent(new CustomEvent('reelioApi', {
          detail: { url: this._reelioUrl, body: this.responseText, status: this.status }
        }));
      }
    });
    return origSend.apply(this, arguments);
  };
})();
```
**This file must NOT be processed by webpack.** Keep it in `public/` as a static asset.

### Layer 2 — content.js
```javascript
// Inject into page context
const scriptUrl = chrome.runtime.getURL('public/page-interceptor.js');
const script = document.createElement('script');
script.src = scriptUrl;
document.head.appendChild(script);

// Relay to Service Worker
window.addEventListener('reelioApi', (evt) => {
  chrome.runtime.sendMessage({ type: 'API_PAYLOAD', payload: evt.detail });
});
```
No business logic here. Pure relay only.

### Layer 3 — background.js
```javascript
const processedIds = new Set();

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'API_PAYLOAD') {
    try {
      const json = JSON.parse(msg.payload.body);
      const reels = extractReels(json);          // interceptor.js
      const fresh = reels.filter(r => !processedIds.has(r.id));
      fresh.forEach(r => processedIds.add(r.id));
      if (fresh.length) runEnrichmentPipeline(fresh);
    } catch (e) { /* silent */ }
  }
});
```

---

## Manifest (exact required shape)
```json
{
  "manifest_version": 3,
  "name": "Reelio",
  "version": "1.0.0",
  "permissions": ["scripting", "storage"],
  "host_permissions": [
    "https://www.instagram.com/*",
    "https://*.cdninstagram.com/*"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://www.instagram.com/*"],
    "js": ["content.js"],
    "run_at": "document_start"
  }],
  "action": { "default_popup": "popup.html" },
  "web_accessible_resources": [{
    "resources": ["public/page-interceptor.js", "embedding-worker.js", "vision-worker.js"],
    "matches": ["https://www.instagram.com/*"]
  }]
}
```

---

## GraphQL Response Fingerprinting
Use structural duck-typing — NEVER hardcode Instagram's `doc_id` (it changes).

```javascript
function extractReels(json) {
  try {
    // Instagram's saved reels appear in various nested paths — try all
    const edges =
      json?.data?.user?.edge_saved_media?.edges ||
      json?.data?.xdt_api__v1__feed__saved__posts?.edges ||
      json?.items ||
      [];
    return edges
      .map(e => e?.node || e)
      .filter(node => node?.shortcode || node?.code || node?.video_url)
      .map(normaliseNode);
  } catch { return []; }
}

function normaliseNode(node) {
  return {
    id: node.id || node.pk,
    shortcode: node.shortcode || node.code,
    url: `https://www.instagram.com/reels/${node.shortcode || node.code}/`,
    thumbnailUrl: node.thumbnail_src || node.image_versions2?.candidates?.[0]?.url,
    caption: node.edge_media_to_caption?.edges?.[0]?.node?.text || node.caption?.text || '',
    hashtags: extractHashtags(node),
    audio: {
      title: node.clips_music_attribution_info?.song_name || node.music_metadata?.music_info?.music_asset_info?.title || '',
      artist: node.clips_music_attribution_info?.artist_name || '',
      isOriginal: !!(node.clips_music_attribution_info?.is_original_audio),
    },
    creatorUsername: node.owner?.username || node.user?.username || '',
    ccUrl: node.accessibility_caption || null,
    savedAt: (node.taken_at || node.date_taken || Date.now() / 1000) * 1000,
  };
}
```

---

## IndexedDB Schema
```javascript
// DB name and version
const DB_NAME = 'reelio-db';
const DB_VERSION = 1;

// Stores to create in onupgradeneeded:
// 'reel_documents'  — keyPath: 'id' — full ReelDocument (Tier 1)
// 'reel_tombstones' — keyPath: 'id' — lightweight record (Tier 2)
// 'embeddings'      — keyPath: 'id' — { id, vector: Float32Array, textUsed }
// 'settings'        — keyPath: 'key'
```

---

## Message Protocol
| Type | Direction | Payload |
|------|-----------|---------|
| `API_PAYLOAD` | content → background | `{ url, body, status }` |
| `SEARCH` | popup → background | `{ query: string, topN: number }` |
| `SEARCH_RESULTS` | background → popup | `{ results: SearchResult[], partial: [] }` |
| `GET_STATS` | popup → background | `{}` |
| `STATS` | background → popup | `{ total, tier1, storageBytes, visionQueue }` |
| `UPDATE_SETTINGS` | popup → background | `{ tierLimit?, visionEnabled?, topN? }` |

---

## Enrichment Pipeline (runs per reel, each step fails gracefully)
1. `interceptor.js` — parse + normalise → RawReel (skip reel if fails)
2. `cc-fetcher.js` — fetch .vtt from Service Worker → `transcript` (null if fails)
3. `metadata-tagger.js` — categories + audio signal → `categories[]` (["Unknown"] if fails)
4. `document-builder.js` — assemble ReelDocument
5. `db.js + tier-manager.js` — write to IndexedDB, demote oldest if over limit
6. `embedding-worker.js` — embed concatenated text → store Float32Array
7. `vision-worker.js` — async queue, frame descriptions → update doc + re-embed

---

## Embedding Text Concatenation (order matters — most signal first)
```javascript
const textToEmbed = [
  doc.transcript,
  doc.visualDescription,
  `Creator: ${doc.creator.username}`,
  `Category: ${doc.categories.join(', ')}`,
  `Audio: ${doc.audio.title}`,
  doc.caption,
  doc.hashtags.join(' '),
].filter(Boolean).join('\n').slice(0, 2000); // ~512 tokens max
```

---

## Embedding Worker Pattern (handle MV3 Service Worker sleep)
```javascript
// background.js — lazy re-spawn on every use
let embeddingWorker = null;
function getEmbeddingWorker() {
  if (!embeddingWorker) {
    embeddingWorker = new Worker(chrome.runtime.getURL('embedding-worker.js'));
    embeddingWorker.onmessage = handleEmbeddingResult;
  }
  return embeddingWorker;
}
```

---

## Score Display (cosine → percentage)
```javascript
// Cosine similarity ranges -1 to 1. Map to 0-100% for display:
const displayScore = Math.round(((score + 1) / 2) * 100);
// Only show results where displayScore > 40 (below that = not relevant)
```

---

## CC (.vtt) Parsing
```javascript
async function fetchTranscript(vttUrl) {
  try {
    const res = await fetch(vttUrl);
    if (!res.ok) return null;
    const text = await res.text();
    return text
      .split('\n')
      .filter(line => !line.match(/^\d{2}:\d{2}/) && line !== 'WEBVTT' && line.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim() || null;
  } catch { return null; }
}
```

---

## Testing Workflow (Chrome Extension — no localhost)
1. `npm run build` → produces `dist/` folder
2. Open `chrome://extensions` → Enable Developer Mode → Load Unpacked → select `dist/`
3. Navigate to `https://www.instagram.com/ayush.hs26/saved/all-posts/`
4. Scroll — watch badge count increment
5. Open Service Worker console at `chrome://serviceworker-internals` to see logs
6. Open popup — type queries — verify results
7. Verify IndexedDB via DevTools → Application → Storage → IndexedDB → reelio-db

Do NOT try to test with Playwright or a localhost server. Manual DevTools inspection only.

---

## Common Mistakes to Avoid
| Mistake | Correct approach |
|---------|-----------------|
| Patching `window.fetch` in `content.js` | Use `public/page-interceptor.js` injected as `<script>` |
| Forgetting idempotency guard in interceptor | `if (window.__reelioInterceptor) return;` first line |
| Reading response body without cloning | `const cloned = resp.clone(); cloned.text()` |
| Letting interception errors propagate | Wrap everything in `try/catch`, swallow silently |
| Hardcoding Instagram `doc_id` | Duck-type the response shape |
| Fetching .vtt from content script | Fetch from background Service Worker (has host_permission) |
| Using `localStorage` | IndexedDB for reel data, `chrome.storage.local` for settings |
| Injecting UI into Instagram page | Extension popup only |
| Assuming embedding worker stays alive | Use `getEmbeddingWorker()` lazy re-spawn pattern |