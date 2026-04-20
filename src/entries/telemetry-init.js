/**
 * Runs before other entry imports: stable correlation id + client-side error surfacing.
 * Pair with Edge `x-request-id` / structured logs in Supabase Log Explorer.
 */
(function () {
  if (typeof window === 'undefined') return;

  function ensureCorrelationId() {
    if (window.__bizdashCorrelationId) return;
    try {
      window.__bizdashCorrelationId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : String(Date.now()) + '-' + Math.random().toString(36).slice(2, 10);
    } catch (_) {
      window.__bizdashCorrelationId = 'unknown';
    }
  }

  function logBizdash(kind, payload) {
    ensureCorrelationId();
    try {
      console.error(
        '[bizdash]',
        JSON.stringify(Object.assign({ kind: kind, correlationId: window.__bizdashCorrelationId }, payload || {})),
      );
    } catch (_) {}
  }

  ensureCorrelationId();

  window.addEventListener('error', function (ev) {
    logBizdash('window.error', {
      message: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });

  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    var msg = r && r.message ? String(r.message) : String(r);
    logBizdash('unhandledrejection', { message: msg });
  });
})();
