/**
 * Exposes the same global shape as the jsDelivr UMD bundle: window.supabase.createClient
 */
import { createClient } from '@supabase/supabase-js';

window.supabase = { createClient };
