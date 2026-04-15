(function () {
  if (window.__reelioInterceptor) return;
  window.__reelioInterceptor = true;
  console.log("[Reelio] Page interceptor initializing in page context");

  // -- Patch fetch --
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const resp = await originalFetch.apply(this, arguments);
    try {
      const url = typeof input === "string" ? input : input.url || "";
      if (url.includes("/graphql") || url.includes("/api/")) {
        const cloned = resp.clone();
        const text = await cloned.text();
        console.log("[Reelio] Intercepted fetch:", url);
        window.dispatchEvent(new CustomEvent("reelioApi", {
          detail: { url, body: text, status: resp.status }
        }));
      }
    } catch (e) {
      /* silent - never break Instagram */
    }
    return resp;
  };

  // -- Patch XHR --
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function (method, url) {
    this._reelioUrl = url;
    return origOpen.apply(this, arguments);
  };
  
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
      if (this._reelioUrl && (this._reelioUrl.includes("/graphql") || this._reelioUrl.includes("/api/"))) {
        try {
          window.dispatchEvent(new CustomEvent("reelioApi", {
            detail: { url: this._reelioUrl, body: this.responseText, status: this.status }
          }));
        } catch (e) {
          /* silent */
        }
      }
    });
    return origSend.apply(this, arguments);
  };
})();
