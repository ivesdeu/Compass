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
