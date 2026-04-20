/**
 * Load order matches the previous index.html script tags:
 * Telemetry → Supabase global → Chart → app data → auth gate → advisor.
 */
import './telemetry-init.js';
import './supabase-vendor.js';
import './chart-setup.js';
import '../legacy/financial-core.js';
import '../legacy/supabase-auth.js';
import '../legacy/dashboard-assistant.js';

/** Advisor React island — mount after legacy `wireDashboardAssistant` defines `bizDashAdvisorGetComposerApi`. */
function mountAdvisorComposerWhenReady() {
  if (typeof window.bizDashAdvisorGetComposerApi !== 'function') {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(mountAdvisorComposerWhenReady);
    } else {
      setTimeout(mountAdvisorComposerWhenReady, 0);
    }
    return;
  }
  import('./advisor-react-mount.tsx')
    .then(function (m) {
      if (m && typeof m.mountAdvisorReactComposer === 'function') m.mountAdvisorReactComposer();
    })
    .catch(function (e) {
      if (typeof console !== 'undefined' && console.warn) console.warn('Advisor React composer', e);
    });
}
if (typeof requestAnimationFrame !== 'undefined') {
  requestAnimationFrame(mountAdvisorComposerWhenReady);
} else {
  setTimeout(mountAdvisorComposerWhenReady, 0);
}
