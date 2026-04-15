# Reelio

Reelio is a Chrome extension that natively intercepts your Instagram Saved Reels, categorizes them locally, and builds a powerful offline vector search engine—all without backend servers, API keys, or cloud storage!

## 🚀 Features
- **Local AI Context**: Extracts transcripts and parses hashtags dynamically as you browse.
- **Privacy-First Storage**: Completely offline mapping via an isolated IndexedDB database.
- **Tier Limiting**: Prioritizes vector storage intelligently to save hard-drive space.
- **Natural Language Search** [Coming in Phase 3]: Browse past reels via embedded neural searches!

## 🛠️ Local Development

### 1. Requirements
Ensure you have `Node.js` and `npm` installed.

### 2. Setup & Installation
Clone the repository and install the Webpack bundler dependencies:
```bash
npm install
```

### 3. Build the Extension
Compile the extension locally into the `dist/` folder:
```bash
npm run build
```

*(Note: During active development, you can use `npm run dev` to automatically recompile changes on save.)*

### 4. Load in Chrome
1. Head to `chrome://extensions/` in your Chrome browser.
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button.
4. Select the generated `dist/` directory inside this project folder.

### 5. Start Indexing!
Open a new tab, navigate to your saved reels page (`https://www.instagram.com/[YOUR_USERNAME]/saved/all-posts/`), and scroll! You will see the extension badge counting up as it invisibly databases and enriches your Reels.

---

*This project is built defensively against Instagram's DOM updates by using structural pattern-matching and intercepting raw API payloads natively.*
