'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import AccountFields from '@/components/profile/AccountFields';
import LanguageGrid from '@/components/profile/LanguageGrid';
import PasswordSection from '@/components/profile/PasswordSection';
import ProfileHeader from '@/components/profile/ProfileHeader';
import {normalizeProfile} from '@/components/profile/profileUtils';
import type {ProfileData} from '@/components/profile/types';
import {getCurrentUserProfile} from '@/lib/api/user';
import {useAuthStore} from '@/lib/store/authStore';

const emptyProfile: ProfileData = {
  username: '',
  email: '',
  full_name: '',
  is_active: false,
  email_verified: false
};

export default function ProfileClient() {
  const t = useTranslations('profile');
  const commonT = useTranslations('common');
  const {setUser} = useAuthStore();
  const [profile, setProfile] = useState<ProfileData>(emptyProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const {data} = await getCurrentUserProfile();
        const payload = normalizeProfile((data?.data ?? data ?? {}) as Record<string, unknown>);

        if (!mounted) {
          return;
        }

        setProfile(payload);
        setUser({
          username: payload.username,
          email: payload.email,
          fullname: payload.full_name
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

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [setUser, t]);

  const updateProfile = (updater: (current: ProfileData) => ProfileData) => {
    setProfile((current) => {
      const next = updater(current);
      setUser({
        username: next.username,
        email: next.email,
        fullname: next.full_name
      });
      return next;
    });
  };

  const copy = useMemo(
    () => ({
      headerTitle: t('header_title'),
      active: t('status_active'),
      inactive: t('status_inactive'),
      account: {
        title: t('account_section'),
        description: t('account_description'),
        username: t('username'),
        email: t('email'),
        full_name: t('full_name'),
        edit: t('edit'),
        save: t('save_inline'),
        saving: t('saving'),
        saveSuccess: t('save_success'),
        saveError: t('save_error')
      },
      password: {
        title: t('password_section'),
        description: t('password_description'),
        password: t('new_password'),
        passwordRepeat: t('new_password_repeat'),
        strengthWeak: t('strength_weak'),
        strengthFair: t('strength_fair'),
        strengthGood: t('strength_good'),
        strengthStrong: t('strength_strong'),
        save: t('save_password'),
        saving: t('saving'),
        mismatch: t('password_mismatch'),
        minLength: t('password_min_length'),
        saveSuccess: t('save_success'),
        saveError: t('save_error'),
        showPassword: t('show_password'),
        hidePassword: t('hide_password'),
        showPasswordRepeat: t('show_password_repeat'),
        hidePasswordRepeat: t('hide_password_repeat')
      },
      language: {
        title: commonT('language'),
        description: t('language_description')
      }
    }),
    [commonT, t]
  );

  if (loading) {
    return (
      <div className="grid gap-4">
        <div className="surface rounded-[var(--radius-lg)] p-6">
          <div className="skeleton-shimmer h-24 w-full rounded-[var(--radius-lg)]" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            <div className="surface rounded-[var(--radius-lg)] p-5">
              <div className="skeleton-shimmer h-48 w-full rounded-[var(--radius-lg)]" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="surface rounded-[var(--radius-lg)] p-5">
              <div className="skeleton-shimmer h-64 w-full rounded-[var(--radius-lg)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <ProfileHeader
        profile={profile}
        title={copy.headerTitle}
        activeLabel={copy.active}
        inactiveLabel={copy.inactive}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <AccountFields profile={profile} labels={copy.account} onProfileChange={updateProfile} />
        </div>

        <div className="space-y-4">
          <PasswordSection labels={copy.password} />
          <LanguageGrid title={copy.language.title} description={copy.language.description} />
        </div>
      </div>
    </div>
  );
}
