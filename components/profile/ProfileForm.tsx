'use client';

import {FormEvent, useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {getCurrentUserProfile, updateCurrentUserProfile} from '@/lib/api/user';
import Button from '@/components/ui/Button';
import FieldError from '@/components/ui/FieldError';
import PasswordChecklist from '@/components/ui/PasswordChecklist';
import {useAuthStore} from '@/lib/store/authStore';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {optionalEmailSchema, optionalFullNameSchema, optionalText, isPasswordValid} from '@/lib/validation';

type ProfileFormState = {
  username: string;
  email: string;
  full_name: string;
  newpassword: string;
  newpassword_rep: string;
};

export default function ProfileForm() {
  const t = useTranslations('profile');
  const tv = useTranslations('validation');
  const {setUser} = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordRepError, setPasswordRepError] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    username: '',
    email: '',
    full_name: '',
    newpassword: '',
    newpassword_rep: ''
  });

  const schemas = useMemo(
    () => ({
      username: optionalText(150),
      email: optionalEmailSchema,
      full_name: optionalFullNameSchema
    }),
    []
  );
  const {errors, validateField, validateAll, resetErrors} = useFieldValidation(schemas);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const {data} = await getCurrentUserProfile();
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

  const passwordTouched = Boolean(form.newpassword || form.newpassword_rep);

  const validatePasswordFields = (): boolean => {
    if (!passwordTouched) {
      setPasswordRepError(null);
      return true;
    }

    const rulesOk = isPasswordValid(form.newpassword);
    if (form.newpassword !== form.newpassword_rep) {
      setPasswordRepError(tv('password_mismatch'));
      return false;
    }

    setPasswordRepError(null);
    return rulesOk;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const fieldsOk = validateAll({
      username: form.username,
      email: form.email,
      full_name: form.full_name
    });
    const passwordOk = validatePasswordFields();

    if (!fieldsOk || !passwordOk) {
      return;
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

      const {data} = await updateCurrentUserProfile(payload);
      const profile = (data?.data ?? data ?? payload) as Record<string, any>;

      setUser({
        username: String(profile.username ?? payload.username ?? ''),
        email: String(profile.email ?? payload.email ?? ''),
        fullname: String(profile.full_name ?? profile.fullname ?? payload.full_name ?? '')
      });

      setForm((prev) => ({...prev, newpassword: '', newpassword_rep: ''}));
      setPasswordRepError(null);
      resetErrors();
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
    <form className="surface space-y-5 rounded-[var(--radius-lg)] p-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-4">
        <h2 className="display-font text-[var(--text-primary)] text-lg">{t('account_section')}</h2>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('username')}</label>
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({...prev, username: event.target.value}))}
            onBlur={(event) => validateField('username', event.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="username"
          />
          <FieldError messages={errors.username} />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('email')}</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({...prev, email: event.target.value}))}
            onBlur={(event) => validateField('email', event.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="email"
          />
          <FieldError messages={errors.email} />
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('full_name')}</label>
          <input
            value={form.full_name}
            onChange={(event) => setForm((prev) => ({...prev, full_name: event.target.value}))}
            onBlur={(event) => validateField('full_name', event.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="name"
          />
          <FieldError messages={errors.full_name} />
        </div>
      </div>

      <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
        <h2 className="display-font text-[var(--text-primary)] text-lg">{t('password_section')}</h2>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('new_password')}</label>
          <input
            type="password"
            value={form.newpassword}
            onChange={(event) => setForm((prev) => ({...prev, newpassword: event.target.value}))}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="new-password"
          />
          {passwordTouched && <PasswordChecklist password={form.newpassword} />}
        </div>

        <div>
          <label className="mb-1 block text-sm text-[var(--text-secondary)]">{t('new_password_repeat')}</label>
          <input
            type="password"
            value={form.newpassword_rep}
            onChange={(event) => {
              const value = event.target.value;
              setForm((prev) => ({...prev, newpassword_rep: value}));
              if (passwordRepError) setPasswordRepError(null);
            }}
            onBlur={() => {
              if (passwordTouched && form.newpassword !== form.newpassword_rep) {
                setPasswordRepError(tv('password_mismatch'));
              }
            }}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2"
            autoComplete="new-password"
          />
          <FieldError messages={passwordRepError ?? undefined} />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}
