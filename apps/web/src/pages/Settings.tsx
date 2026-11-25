import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import type { Locale } from '../i18n';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Field, Input, Select } from '../components/ui/Input';
import { PageHeader } from '../components/Layout';

export function SettingsPage() {
  const { t, locale, setLocale, locales } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t.auth.nameRequired);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { user: u } = await authApi.updateProfile(name.trim());
      setUser(u);
      toast.push(t.settings.profileSaved, 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardHeader title={t.settings.profile} subtitle={t.settings.profileHint} />
          <CardBody>
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              <Field label={t.auth.name} error={error}>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field label={t.auth.email}>
                <Input value={user?.email ?? ''} disabled />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  {t.settings.saveProfile}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.settings.appearance} />
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <Field label={t.settings.theme}>
              <Select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                <option value="light">{t.settings.light}</option>
                <option value="dark">{t.settings.dark}</option>
              </Select>
            </Field>
            <Field label={t.settings.language}>
              <Select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
                {locales.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.common.logout} />
          <CardBody>
            <Button variant="secondary" onClick={() => void handleLogout()}>
              {t.common.logout}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
