/**
 * Fetches and parses a VTT URL into a clean transcript string.
 * @param {string} url The vtt URL.
 * @returns {Promise<string|null>} Clean transcript string, or null on failure.
 */
export async function fetchAndParseCC(url) {
  if (!url) return null;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const vttText = await response.text();
    return parseVTTtoText(vttText);
  } catch (err) {
    console.error("[Reelio] Failed to fetch CC:", err);
    return null;
  }
}

function parseVTTtoText(vttString) {
  if (!vttString) return null;
  
  const lines = vttString.split('\n');
  const textLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip WEBVTT header
    if (line === "WEBVTT") continue;
    // Skip timestamp lines (e.g., 00:00:04.050 --> 00:00:05.100)
    if (line.includes("-->")) continue;
    // Skip empty lines
    if (line.length === 0) continue;
    // Skip numeric cue identifiers
    if (!isNaN(line)) continue;
    
    // It's a text line
    textLines.push(line);
  }
  
  if (textLines.length === 0) return null;
  
  // Join all text, removing excessive whitespace or intra-cue duplicates if needed.
  // For basic VTT, just joining with a space is fine.
  return textLines.join(" ").replace(/\s\s+/g, ' ').trim();
}
