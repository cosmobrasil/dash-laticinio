(function setupAppConfig() {
  const hostname = window.location.hostname;
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

  const queryApiBaseUrl = new URLSearchParams(window.location.search).get("apiBaseUrl");
  const runtimeApiBaseUrl = window.__APP_CONFIG__?.apiBaseUrl;

  window.APP_CONFIG = {
    apiBaseUrl:
      queryApiBaseUrl ||
      runtimeApiBaseUrl ||
      (isLocalHost ? "http://localhost:3001" : "https://formulario-production-8df7.up.railway.app")
  };

  // --- Utilitario de timeout para fetch ---
  const FETCH_TIMEOUT_MS = 15000;

  window.fetchComTimeout = function fetchComTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  window.fetchComRetry = async function fetchComRetry(url, options = {}, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        return await window.fetchComTimeout(url, options);
      } catch (error) {
        if (i === retries) throw error;
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }
  };
})();
