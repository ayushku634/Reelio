// Step 1: Inject the page-context interceptor script
console.log("[Reelio Content Script] Injecting page-interceptor.js");
const scriptUrl = chrome.runtime.getURL("page-interceptor.js");
const script = document.createElement("script");
script.src = scriptUrl;
script.type = "text/javascript";
(document.head || document.documentElement).appendChild(script);
console.log("[Reelio Content Script] Injection complete");

// Step 2: Listen for intercepted API data and relay to Service Worker
window.addEventListener("reelioApi", (evt) => {
  console.log("[Reelio Content Script] Relaying payload to background:", evt.detail.url);
  chrome.runtime.sendMessage({ type: "API_PAYLOAD", payload: evt.detail });
});
