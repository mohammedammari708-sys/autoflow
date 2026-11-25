import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { ApiError } from '../lib/api';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(t.auth.passwordMin);
      return;
    }
    if (password !== confirm) {
      setError(t.auth.passwordsMismatch);
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.resetFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.auth.resetPassword}</h1>
      {!token ? (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {t.auth.resetFailed}
        </p>
      ) : done ? (
        <div className="mt-6">
          <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {t.auth.resetSuccess}
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate('/login')}>
            {t.auth.login}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          <Field label={t.auth.newPassword} hint={t.auth.passwordMin} error={error}>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label={t.auth.confirmPassword}>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            {t.auth.resetPassword}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-5 block text-center text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
        ← {t.auth.backToLogin}
      </Link>
    </AuthLayout>
  );
}
