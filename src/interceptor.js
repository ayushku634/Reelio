/**
 * Extracts raw reels from the intercepted Instagram GraphQL JSON.
 * @param {Object} json The intercepted payload parsed as JSON.
 * @returns {Array} Array of raw reel objects.
 */
export function extractReels(json) {
  const reels = [];
  try {
    // Basic duck-typing for Instagram GraphQL response shapes
    if (json) {
      // Find arrays of edges or items
      const findNodes = (obj) => {
        if (!obj || typeof obj !== 'object') return [];
        let found = [];
        if (Array.isArray(obj.edges)) found = found.concat(obj.edges);
        if (Array.isArray(obj.items)) found = found.concat(obj.items);
        for (const key of Object.keys(obj)) {
          if (typeof obj[key] === 'object') {
            found = found.concat(findNodes(obj[key]));
          }
        }
        return found;
      };

      const nodesRaw = findNodes(json);
      if (nodesRaw.length > 0) {
        console.log(`[Reelio Debug] Found ${nodesRaw.length} potential nodes/edges.`);
        if (nodesRaw[0]) console.log("[Reelio Debug] Sample node:", JSON.stringify(nodesRaw[0]).substring(0, 300));
      }

      for (const item of nodesRaw) {
        const node = item.node || item.media || item;
        const media = node.media || node;
        
        // Relax check to log everything that has an ID or shortcode
        if (media && (media.shortcode || media.code || media.id || media.pk)) {
          console.log("[Reelio Debug] Parsing candidate media:", media.shortcode || media.code);
          const reel = {
            id: media.id || media.pk,
            shortcode: media.shortcode || media.code,
            thumbnailUrl: (media.image_versions2 && media.image_versions2.candidates && media.image_versions2.candidates[0] && media.image_versions2.candidates[0].url) || (media.display_url),
            caption: media.caption && media.caption.text ? media.caption.text : (media.edge_media_to_caption && media.edge_media_to_caption.edges[0] ? media.edge_media_to_caption.edges[0].node.text : null),
            creatorUsername: media.user && media.user.username ? media.user.username : (media.owner ? media.owner.username : null),
            ccUrl: media.video_subtitles_uri || media.accessibility_caption || null,
            audioTitle: media.clips_metadata && media.clips_metadata.music_info && media.clips_metadata.music_info.music_asset_info ? media.clips_metadata.music_info.music_asset_info.title : (media.clips_metadata && media.clips_metadata.original_sound_info ? media.clips_metadata.original_sound_info.audio_asset_info.title : "Original Audio"),
          };
          
          if (reel.id) {
            reels.push(reel);
          }
        }
      }
    }
  } catch (err) {
    // silent failure for parsing shapes
  }
  return reels;
}
