import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t.auth.invalidEmail);
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      toast.push(t.auth.loginTitle, 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.loginFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.auth.loginTitle}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.auth.loginSubtitle}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label={t.auth.email} error={error && !email.includes('@') ? error : undefined}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label={t.auth.password}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          {t.auth.login}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link to="/forgot-password" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
          {t.auth.forgotPassword}
        </Link>
        <span className="text-slate-500 dark:text-slate-400">
          {t.auth.noAccount}{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t.auth.register}
          </Link>
        </span>
      </div>
    </AuthLayout>
  );
}
