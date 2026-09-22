import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { getBackendBaseUrl } from './services/config.js'

// ─────────────────────────────────────────────────────────────────────────────
// Centralized API Network Interceptor
// 1. Rewrites localhost/127.0.0.1 addresses to the current host so LAN mode
//    works without any per-component changes.
// 2. Catches network-level failures (backend offline, connection refused) and
//    returns a synthetic Response carrying a structured JSON error body so no
//    component ever receives an unhandled promise rejection.
// ─────────────────────────────────────────────────────────────────────────────
const _originalFetch = window.fetch;
window.fetch = function (input, init) {
  // ── URL rewrite ───────────────────────────────────────────────────────────
  if (typeof input === 'string' && input.includes('127.0.0.1:8000')) {
    const backendBaseUrl = getBackendBaseUrl();
    input = input.replace('http://127.0.0.1:8000', backendBaseUrl);
  }

  // ── Error boundary wrapper ────────────────────────────────────────────────
  return _originalFetch(input, init).catch((networkErr) => {
    // This fires when the backend is completely unreachable (ECONNREFUSED,
    // net::ERR_CONNECTION_REFUSED, etc.).  We synthesise a Response object
    // that callers can treat exactly like a failed HTTP response so they never
    // have to handle a rejected Promise specially.
    console.warn('[MBA Copilot] Backend unreachable:', networkErr.message || networkErr);
    const errorBody = JSON.stringify({
      error: 'Backend offline — please ensure the MBA Copilot server is running.',
      detail: networkErr.message || String(networkErr),
    });
    return new Response(errorBody, {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  });
};


const originalOpen = window.open;
window.open = function (url, target, features) {
  if (typeof url === 'string' && url.includes('127.0.0.1:8000')) {
    const backendBaseUrl = getBackendBaseUrl();
    url = url.replace('http://127.0.0.1:8000', backendBaseUrl);
  }
  return originalOpen(url, target, features);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
