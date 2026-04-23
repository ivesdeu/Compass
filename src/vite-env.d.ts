/// <reference types="vite/client" />

declare global {
  interface Window {
    /** Supabase browser client from `supabase-auth.js` (used by React auth islands). */
    supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
    /** Password recovery UI flag (see `supabase-auth.js` + `auth-login-gate.tsx`). */
    __bizdashIsAuthRecoveryMode?: () => boolean;
    DEMO_DASHBOARD_USER_ID?: string;
    /** True when “View Demo” session (see financial-core.js). Mock data must gate on this. */
    bizDashIsDemoUser?: () => boolean;
    /** CRM customers React table (see crm-table-react-mount.tsx + financial-core.js). */
    bizDashCrmCustomersTableBuildPayload?: () => Record<string, unknown>;
    bizDashCrmCustomersTableApplyPayload?: (p: Record<string, unknown>) => void;
    bizDashSyncCrmCustomersTable?: () => void;
    bizDashApplyCustomersColumnVisibility?: () => void;
    bizDashCrmCustomersTableFocus?: (o: { rowId: string; colId: string; activate?: boolean }) => void;
    bizDashCrmTablePatchField?: (
      clientId: string,
      fieldKey: string,
      value: string,
      colId: string,
    ) => Promise<boolean>;
    bizDashCrmTableRevertField?: (clientId: string, fieldKey: string, previous: string) => void;
    bizDashCrmTableOnLeaveRow?: (rowId: string) => void;
  }
}

export {};
