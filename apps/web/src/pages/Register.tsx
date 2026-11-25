import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Input';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { t } = useI18n();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string; confirm?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = t.auth.nameRequired;
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = t.auth.invalidEmail;
    if (password.length < 8) next.password = t.auth.passwordMin;
    if (password !== confirm) next.confirm = t.auth.passwordsMismatch;
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : t.auth.registerFailed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.auth.registerTitle}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.auth.registerSubtitle}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label={t.auth.name} error={errors.name}>
          <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Cooper" />
        </Field>
        <Field label={t.auth.email} error={errors.email}>
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label={t.auth.password} hint={t.auth.passwordMin} error={errors.password}>
          <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label={t.auth.confirmPassword} error={errors.confirm}>
          <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {errors.form && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {errors.form}
          </p>
        )}
        <Button type="submit" loading={busy} className="w-full">
          {t.auth.register}
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500 dark:text-slate-400">
        {t.auth.hasAccount}{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
          {t.auth.login}
        </Link>
      </p>
    </AuthLayout>
  );
}
