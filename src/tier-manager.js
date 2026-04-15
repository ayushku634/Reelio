import { getDocumentCount, getAllDocuments, putTombstone, deleteDocumentAndEmbedding, getSetting } from './db.js';

export async function enforceTierLimits(newDocRequiredSpace = 1) {
  const tierLimit = await getSetting("tierLimit", 200);
  const currentCount = await getDocumentCount();
  
  if (currentCount + newDocRequiredSpace > tierLimit) {
    const toDemoteCount = (currentCount + newDocRequiredSpace) - tierLimit;
    const allDocs = await getAllDocuments();
    
    // Sort by savedAt ascending (oldest first)
    allDocs.sort((a, b) => a.savedAt - b.savedAt);
    
    // Demote the oldest documents
    for (let i = 0; i < toDemoteCount; i++) {
        const docToDemote = allDocs[i];
        if (!docToDemote) continue;
        
        // 1. Create tombstone
        const tombstone = {
          id: docToDemote.id,
          shortcode: docToDemote.shortcode,
          thumbnailUrl: docToDemote.thumbnailUrl,
          creatorUsername: docToDemote.creator.username,
          categories: docToDemote.categories,
          savedAt: docToDemote.savedAt,
          tier: 2
        };
        
        // 2. Write tombstone
        await putTombstone(tombstone);
        
        // 3. Delete from documents and embeddings
        await deleteDocumentAndEmbedding(docToDemote.id);
        console.log(`[Reelio TierManager] Demoted specific reel ${docToDemote.id} to Tier 2.`);
    }
  }
}
