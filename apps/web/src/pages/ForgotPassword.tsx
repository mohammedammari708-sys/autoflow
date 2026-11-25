import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t.auth.invalidEmail);
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setSent(true);
      if (res.devResetToken) setDevToken(res.devResetToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.auth.resetPassword}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.auth.forgotPassword}</p>
      {sent ? (
        <div className="mt-6">
          <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {t.auth.resetSent}
          </p>
          {devToken && (
            <div className="mt-4 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 dark:bg-amber-500/10">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                {t.auth.devOnly}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {t.auth.devTokenLabel}:
              </p>
              <code className="mt-1 block break-all rounded-lg bg-white px-2.5 py-2 text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                {devToken}
              </code>
              <Link
                to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                {t.auth.resetPassword} →
              </Link>
            </div>
          )}
          <Link to="/login" className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            ← {t.auth.backToLogin}
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label={t.auth.email} error={error}>
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            {t.auth.sendResetLink}
          </Button>
          <Link to="/login" className="text-center text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            ← {t.auth.backToLogin}
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
