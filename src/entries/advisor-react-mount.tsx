import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PromptBox, type AdvisorComposerApi } from '@/components/ui/chatgpt-prompt-input';
import '../advisor-island.css';

let root: Root | null = null;

/**
 * Mounts the PromptBox composer into #advisor-react-composer-root.
 * Call once after `wireDashboardAssistant` so `window.bizDashAdvisorGetComposerApi` exists.
 */
export function mountAdvisorReactComposer() {
  const el = document.getElementById('advisor-react-composer-root');
  if (!el) return;
  const getApi = (window as unknown as { bizDashAdvisorGetComposerApi?: () => AdvisorComposerApi | null })
    .bizDashAdvisorGetComposerApi;
  const api = getApi ? getApi() : null;
  if (!root) {
    root = createRoot(el);
  }
  root.render(
    <StrictMode>
      <PromptBox composerApi={api} />
    </StrictMode>,
  );
}
