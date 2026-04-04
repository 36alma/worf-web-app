'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { getCurrentUserProfile, updateCurrentUserProfile } from '@/lib/api/user';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';

type TotpType = 'totp' | 'email';

type ProfileFormState = {
  username: string;
  email: string;
  full_name: string;
  newpassword: string;
  newpassword_rep: string;
};

export default function ProfileForm() {
  const t = useTranslations('profile');
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>({
    username: '',
    email: '',
    full_name: '',
    newpassword: '',
    newpassword_rep: ''
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data } = await getCurrentUserProfile();
        const profile = (data?.data ?? data ?? {}) as Record<string, any>;

        if (!mounted) return;

        setForm((prev) => ({
          ...prev,
          username: String(profile.username ?? ''),
          email: String(profile.email ?? ''),
          full_name: String(profile.full_name ?? profile.fullname ?? '')
        }));

        setUser({
          username: String(profile.username ?? ''),
          email: String(profile.email ?? ''),
          fullname: String(profile.full_name ?? profile.fullname ?? '')
        });
      } catch {
        if (mounted) {
          toast.error(t('load_error'));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [setUser, t]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (form.newpassword || form.newpassword_rep) {
      if (form.newpassword.length < 8 || form.newpassword_rep.length < 8) {
        toast.error(t('password_min_length'));
        return;
      }

      if (form.newpassword !== form.newpassword_rep) {
        toast.error(t('password_mismatch'));
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        username: form.username || null,
        email: form.email || null,
        full_name: form.full_name || null,
        newpassword: form.newpassword || null,
        newpassword_rep: form.newpassword_rep || null
      };

      const { data } = await updateCurrentUserProfile(payload);
      const profile = (data?.data ?? data ?? payload) as Record<string, any>;

      setUser({
        username: String(profile.username ?? payload.username ?? ''),
        email: String(profile.email ?? payload.email ?? ''),
        fullname: String(profile.full_name ?? profile.fullname ?? payload.full_name ?? '')
      });

      setForm((prev) => ({ ...prev, newpassword: '', newpassword_rep: '' }));
      toast.success(t('save_success'));
    } catch {
      toast.error(t('save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="surface rounded-[var(--radius-lg)] p-4 text-sm text-[var(--text-secondary)]">{t('loading')}</div>;
  }

  return (
    <form className="surface space-y-5 rounded-[var(--radius-lg)] p-4" onSubmit={onSubmit}>
      <div className="space-y-4">
        <h2 className="display-font text-[var(--text-primary)] text-lg">{t('account_section')}</h2>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('username')}</label>
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="username"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('email')}</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('full_name')}</label>
          <input
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="name"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
        <h2 className="display-font text-[var(--text-primary)] text-lg">{t('password_section')}</h2>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('new_password')}</label>
          <input
            type="password"
            value={form.newpassword}
            onChange={(event) => setForm((prev) => ({ ...prev, newpassword: event.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('new_password_repeat')}</label>
          <input
            type="password"
            value={form.newpassword_rep}
            onChange={(event) => setForm((prev) => ({ ...prev, newpassword_rep: event.target.value }))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="new-password"
          />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}


