/**
 * Tags a reel with categories and extracts hashtags based on text content.
 * @param {string} caption 
 * @param {string} transcript 
 * @returns {Object} { categories: string[], hashtags: string[] }
 */
export function tagMetadata(caption, transcript) {
  const combinedText = ((caption || "") + " " + (transcript || "")).toLowerCase();
  
  const hashtags = extractHashtags(caption || "");
  const categories = determineCategories(combinedText, hashtags);
  
  return {
    categories: categories.length > 0 ? categories : ["Uncategorized"],
    hashtags
  };
}

function extractHashtags(text) {
  const regex = /#[\w]+/g;
  const matches = text.match(regex);
  return matches ? matches.map(m => m.substring(1).toLowerCase()) : [];
}

function determineCategories(text, hashtags) {
  const categories = new Set();
  
  const rules = {
    "Recipe & Food": ["recipe", "cook", "ingredients", "bake", "delicious", "foodie", "dinner", "meal prep"],
    "Fitness & Workout": ["workout", "gym", "fitness", "reps", "sets", "muscle", "protein", "training"],
    "Productivity & Tech": ["productivity", "hack", "tech", "laptop", "code", "app", "setup", "notion"],
    "Comedy & Memes": ["funny", "meme", "comedy", "lol", "lmao", "joke", "humor"],
    "Fashion & Style": ["outfit", "fitcheck", "fashion", "style", "grwm", "clothing", "wear"],
    "Travel & Nature": ["travel", "explore", "nature", "mountains", "beach", "trip", "vacation"]
  };
  
  for (const [category, keywords] of Object.entries(rules)) {
    for (const keyword of keywords) {
      if (text.includes(keyword) || hashtags.includes(keyword)) {
        categories.add(category);
        break; // Only need one keyword match per category
      }
    }
  }
  
  return Array.from(categories);
}
