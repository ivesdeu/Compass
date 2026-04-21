import { createRoot, type Root } from 'react-dom/client';
import '../auth-gate-island.css';
import { SignInForm } from '@/components/ui/sign-in-form';

let root: Root | null = null;

/** Mounts the Tailwind + shadcn-style sign-in card into `#auth-login-react-root`. */
export function mountAuthLoginGate() {
  const el = document.getElementById('auth-login-react-root');
  if (!el) return;
  if (!root) root = createRoot(el);
  root.render(<SignInForm />);
}
