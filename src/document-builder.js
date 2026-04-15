/**
 * Assembles the final ReelDocument used in IndexedDB.
 * @param {Object} rawReel from interceptor.js
 * @param {string} transcript from cc-fetcher.js
 * @param {Object} metadata from metadata-tagger.js ({ categories, hashtags })
 * @returns {Object} A fully formatted ReelDocument
 */
export function buildDocument(rawReel, transcript, metadata) {
  return {
    id: rawReel.id,
    url: `https://www.instagram.com/reel/${rawReel.shortcode}/`,
    shortcode: rawReel.shortcode,
    thumbnailUrl: rawReel.thumbnailUrl,
    creator: {
      username: rawReel.creatorUsername
    },
    caption: rawReel.caption,
    hashtags: metadata.hashtags,
    audio: {
      title: rawReel.audioTitle
    },
    transcript: transcript,
    visualDescription: null, // Populated in Phase 4
    categories: metadata.categories,
    savedAt: Date.now(), // Estimate of save time, effectively "indexed time"
    indexedAt: Date.now(),
    tier: 1
  };
}
