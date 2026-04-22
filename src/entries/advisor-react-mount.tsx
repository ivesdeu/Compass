import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PromptBox, type AdvisorComposerApi } from '@/components/ui/chatgpt-prompt-input';
import '../advisor-island.css';

let root: Root | null = null;

/**
 * Mounts the new PromptBox composer into #advisor-react-composer-root.
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
      <AdvisorComposerWrapper composerApi={api} />
    </StrictMode>
  );
}

/** Wrapper: heading + composer; layout is fixed in page CSS (no docked mode). */
function AdvisorComposerWrapper({ composerApi }: { composerApi: AdvisorComposerApi }) {
  return (
    <div className="w-full flex max-w-full flex-col items-center gap-4">
      <h2 className="advisor-greeting text-center text-lg font-bold tracking-tight text-neutral-900 sm:text-xl">
        How Can I Help You
      </h2>
      <PromptBox composerApi={composerApi} />
    </div>
  );
}
