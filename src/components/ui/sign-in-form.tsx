import { useEffect, useState } from 'react';
import { Lock, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function authEmailRedirectTo() {
  try {
    return (window.location.href || '').split('#')[0];
  } catch {
    return `${window.location.origin || ''}/`;
  }
}

function setMainAuthError(msg: string) {
  const el = document.getElementById('gate-auth-error');
  if (el) el.textContent = msg || '';
}

function setSignupEmailDeliverabilityHint(visible: boolean) {
  const hint = document.getElementById('gate-signup-email-hint');
  const btnR = document.getElementById('gate-resend-confirm');
  const dis = visible ? '' : 'none';
  if (hint) hint.style.display = dis;
  if (btnR) btnR.style.display = dis;
}

function syncModalEmailToMainGate(email: string) {
  const main = document.getElementById('gate-email') as HTMLInputElement | null;
  if (main) main.value = email;
}

function SignupModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setModalError('');
    setSubmitting(false);
    try {
      const main = document.getElementById('gate-email') as HTMLInputElement | null;
      if (main && main.value.trim()) setEmail(main.value.trim());
    } catch {
      /* ignore */
    }
  }, [open]);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setModalError('');
    const fn = firstName.trim();
    const ln = lastName.trim();
    const co = company.trim();
    const em = email.trim();
    const pw = password;
    const cf = confirm;
    if (!fn || !ln) {
      setModalError('First and last name are required.');
      return;
    }
    if (!co) {
      setModalError('Company name is required.');
      return;
    }
    if (!em || !pw) {
      setModalError('Email and password are required.');
      return;
    }
    if (!cf) {
      setModalError('Please confirm your password.');
      return;
    }
    if (pw !== cf) {
      setModalError('Passwords do not match.');
      return;
    }
    const client = window.supabaseClient;
    if (!client) {
      setModalError('Sign-in is not ready yet. Refresh the page and try again.');
      return;
    }
    setSubmitting(true);
    try {
      const fullName = `${fn} ${ln}`.trim();
      const res = await client.auth.signUp({
        email: em,
        password: pw,
        options: {
          emailRedirectTo: authEmailRedirectTo(),
          data: {
            first_name: fn,
            last_name: ln,
            full_name: fullName,
            company_name: co.slice(0, 200),
          },
        },
      });
      if (res.error) {
        setModalError(res.error.message || 'Could not sign up.');
        return;
      }
      const newUser = res.data?.user;
      const newSession = res.data?.session;
      if (newSession) {
        try {
          await client.auth.signOut();
        } catch {
          /* ignore */
        }
      }
      syncModalEmailToMainGate(em);
      onOpenChange(false);
      setSignupEmailDeliverabilityHint(false);
      if (newUser?.email_confirmed_at) {
        setMainAuthError('Account created. Sign in with your email and password.');
      } else {
        setMainAuthError('Check your email to confirm your account, then sign in.');
        setSignupEmailDeliverabilityHint(true);
      }
      setFirstName('');
      setLastName('');
      setCompany('');
      setEmail('');
      setPassword('');
      setConfirm('');
    } catch (err) {
      console.error('signUp error', err);
      setModalError('Unexpected error signing up.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create your account</DialogTitle>
          <DialogDescription>
            Enter your details below. After you sign up, check your email to confirm your address if
            required by your workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleCreateAccount}>
          <div
            id="gate-signup-modal-error"
            className="min-h-[1.25rem] text-sm text-destructive"
            role="alert"
          >
            {modalError}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="gate-signup-first-name">First name</Label>
              <Input
                id="gate-signup-first-name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gate-signup-last-name">Last name</Label>
              <Input
                id="gate-signup-last-name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-signup-company">Company name</Label>
            <Input
              id="gate-signup-company"
              autoComplete="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-signup-modal-email">Email</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="gate-signup-modal-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-signup-modal-password">Password</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="gate-signup-modal-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-signup-modal-confirm">Confirm password</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="gate-signup-modal-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Vite/React auth gate — shadcn-style layout with legacy `gate-*` ids for `supabase-auth.js`.
 * Sign up opens a modal (all fields there); password recovery still uses `#gate-confirm-wrap` on the card.
 */
export function SignInForm() {
  const [signupOpen, setSignupOpen] = useState(false);

  return (
    <div className="auth-gate-tw w-full max-w-md">
      <SignupModal open={signupOpen} onOpenChange={setSignupOpen} />
      <Card className="w-full rounded-2xl border bg-background shadow-md">
        <CardContent className="flex flex-col gap-6 p-6">
          <div>
            <h1 id="gate-auth-heading" className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in
            </h1>
            <p id="gate-auth-subtitle" className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Sign in to use the dashboard.
            </p>
          </div>

          <div id="gate-confirm-wrap" className="flex flex-col gap-2" style={{ display: 'none' }}>
            <Label htmlFor="gate-confirm-password">Confirm password</Label>
            <Input
              id="gate-confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>

          <div
            id="gate-auth-error"
            className="min-h-[1.25rem] text-sm text-destructive empty:min-h-0"
          />

          <div
            id="gate-signup-email-hint"
            className="text-xs leading-relaxed text-muted-foreground"
            style={{ display: 'none' }}
          >
            If no message arrives: without <strong>Authentication → SMTP</strong> enabled, mail only
            goes to your Supabase <strong>org team</strong> addresses. If SMTP is already on, open{' '}
            <strong>Logs → Auth</strong> for the exact error, verify the <strong>sender domain</strong> at
            your provider (Resend/SendGrid/…), check spam, and add this site under{' '}
            <strong>Authentication → URL configuration → Redirect URLs</strong>.
          </div>

          <Button
            type="button"
            id="gate-resend-confirm"
            variant="outline"
            className="h-10 w-full text-sm"
            style={{ display: 'none' }}
          >
            Resend confirmation email
          </Button>

          <div
            id="gate-invite-hint"
            className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-snug text-muted-foreground"
            style={{ display: 'none' }}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-email">Email</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Mail className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="gate-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gate-password">Password</Label>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-input px-3 focus-within:ring-2 focus-within:ring-ring">
              <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                id="gate-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox id="gate-remember" />
              <Label htmlFor="gate-remember" className="text-sm font-normal text-muted-foreground">
                Remember me
              </Label>
            </div>
            <button
              type="button"
              id="gate-forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <Button type="button" id="gate-signin" variant="default" className="h-12 w-full rounded-lg text-base font-medium">
            Sign In
          </Button>

          <div id="gate-oauth-stack" className="mt-2 flex flex-col gap-3">
            <Button
              type="button"
              id="gate-google"
              variant="outline"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg"
            >
              <img
                src="https://www.svgrepo.com/show/355037/google.svg"
                alt=""
                width={20}
                height={20}
                className="shrink-0"
                loading="lazy"
                decoding="async"
              />
              Continue with Google
            </Button>

            <Button
              type="button"
              id="gate-apple"
              variant="outline"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg"
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
                alt=""
                width={20}
                height={20}
                className="shrink-0"
                loading="lazy"
                decoding="async"
              />
              Continue with Apple
            </Button>

            <Button
              type="button"
              id="gate-github"
              variant="outline"
              className="flex h-12 w-full items-center justify-center gap-3 rounded-lg"
            >
              <img
                src="https://www.svgrepo.com/show/303615/github-icon-1-logo.svg"
                alt=""
                width={20}
                height={20}
                className="shrink-0"
                loading="lazy"
                decoding="async"
              />
              Continue with GitHub
            </Button>
          </div>

          <Button type="button" id="gate-view-demo" variant="secondary" className="h-11 w-full rounded-lg">
            View Demo
          </Button>

          <p className="mt-1 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button type="button" id="gate-signup" className="text-primary hover:underline" onClick={() => setSignupOpen(true)}>
              Sign Up
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
