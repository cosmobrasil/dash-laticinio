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
})();
