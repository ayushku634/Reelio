import { extractReels } from './interceptor.js';
import { fetchAndParseCC } from './cc-fetcher.js';
import { tagMetadata } from './metadata-tagger.js';
import { buildDocument } from './document-builder.js';
import { enforceTierLimits } from './tier-manager.js';
import { putDocument, getDocumentCount } from './db.js';

const processedIds = new Set(); // in-memory dedup within session

async function runEnrichmentPipeline(reels) {
  for (const reel of reels) {
    try {
      console.log(`[Reelio] Starting enrichment for reel: ${reel.shortcode}`);
      
      const transcript = await fetchAndParseCC(reel.ccUrl);
      const metadata = tagMetadata(reel.caption, transcript);
      const doc = buildDocument(reel, transcript, metadata);
      
      // Before storing, ensure we aren't exceeding our local db limits locally
      await enforceTierLimits(1);
      
      await putDocument(doc);
      console.log(`[Reelio] Successfully indexed Reel: ${doc.id}`);
      
      // Update badge
      const newCount = await getDocumentCount();
      chrome.action.setBadgeText({ text: newCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#E1306C' });
    } catch (e) {
      console.error(`[Reelio] Failed enrichment pipeline for ${reel.id}:`, e);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "API_PAYLOAD") {
    // Only process requests if the sender's url matches our target pattern
    if (!sender.tab || !sender.tab.url || !sender.tab.url.includes("instagram.com/ayush.hs26/saved/")) {
      return;
    }

    try {
      const json = JSON.parse(msg.payload.body);
      const reels = extractReels(json);
      
      const newReels = reels.filter(r => !processedIds.has(r.id));
      newReels.forEach(r => processedIds.add(r.id));
      
      if (newReels.length) {
        console.log(`[Reelio] Triggering pipeline for ${newReels.length} new reels.`);
        runEnrichmentPipeline(newReels);
      }
    } catch (e) {
      /* silent parse failure */
    }
  }
});
