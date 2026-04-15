const DB_NAME = "reelio-db";
const DB_VERSION = 1;

let dbPromise = null;

export function getDatabase() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("reel_documents")) {
        db.createObjectStore("reel_documents", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("reel_tombstones")) {
        db.createObjectStore("reel_tombstones", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("embeddings")) {
        db.createObjectStore("embeddings", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
  
  return dbPromise;
}

export async function putDocument(doc) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reel_documents", "readwrite");
    tx.objectStore("reel_documents").put(doc);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function putTombstone(tombstone) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reel_tombstones", "readwrite");
    tx.objectStore("reel_tombstones").put(tombstone);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getDocumentCount() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reel_documents", "readonly");
    const req = tx.objectStore("reel_documents").count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllDocuments() {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reel_documents", "readonly");
    const req = tx.objectStore("reel_documents").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteDocumentAndEmbedding(id) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["reel_documents", "embeddings"], "readwrite");
    tx.objectStore("reel_documents").delete(id);
    tx.objectStore("embeddings").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getSetting(key, defaultValue) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readonly");
    const req = tx.objectStore("settings").get(key);
    req.onsuccess = () => resolve(req.result !== undefined ? req.result.value : defaultValue);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function putSetting(key, value) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("settings", "readwrite");
    tx.objectStore("settings").put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}
