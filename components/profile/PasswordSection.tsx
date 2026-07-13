'use client';

import clsx from 'clsx';
import {Eye, EyeOff, LockKeyhole, Save} from 'lucide-react';
import {useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {Input} from '@/components/ui/Input';
import PasswordChecklist from '@/components/ui/PasswordChecklist';
import {isPasswordValid} from '@/lib/validation';
import {updateCurrentUserProfile} from '@/lib/api/user';

interface PasswordSectionProps {
  labels: {
    title: string;
    description: string;
    password: string;
    passwordRepeat: string;
    strengthWeak: string;
    strengthFair: string;
    strengthGood: string;
    strengthStrong: string;
    save: string;
    saving: string;
    mismatch: string;
    minLength: string;
    saveSuccess: string;
    saveError: string;
    showPassword: string;
    hidePassword: string;
    showPasswordRepeat: string;
    hidePasswordRepeat: string;
  };
}

const getPasswordScore = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

export default function PasswordSection({labels}: PasswordSectionProps) {
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [saving, setSaving] = useState(false);

  const score = useMemo(() => getPasswordScore(password), [password]);
  const passwordsMismatch = passwordRepeat.length > 0 && password !== passwordRepeat;
  // A mentés a backend ÖSSZES jelszó-szabályához kötött (isPasswordValid), nem csak a
  // gyenge score-hoz — így a frontend nem enged át olyat, amit a backend elutasítana.
  const canSave = isPasswordValid(password) && passwordRepeat.length > 0 && !passwordsMismatch;

  const strengthLabel =
    score <= 1
      ? labels.strengthWeak
      : score === 2
        ? labels.strengthFair
        : score === 3
          ? labels.strengthGood
          : labels.strengthStrong;

  const segmentClassName = (index: number) => {
    const active = index < score;

    if (!active) {
      return 'bg-[var(--bg-input)]';
    }

    if (score <= 1) {
      return 'bg-[var(--error)]';
    }

    if (score === 2) {
      return 'bg-[#f97316]';
    }

    if (score === 3) {
      return 'bg-[var(--warning)]';
    }

    return 'bg-[var(--success)]';
  };

  const handleSave = async () => {
    // A hiányzó szabályokat a checklist mutatja meg finoman a user felé.
    if (!isPasswordValid(password)) {
      return;
    }

    if (password !== passwordRepeat) {
      toast.error(labels.mismatch);
      return;
    }

    setSaving(true);

    try {
      await updateCurrentUserProfile({
        newpassword: password,
        newpassword_rep: passwordRepeat
      });

      setPassword('');
      setPasswordRepeat('');
      toast.success(labels.saveSuccess);
    } catch {
      toast.error(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface space-y-5 rounded-[var(--radius-lg)] p-5">
      <div className="space-y-1">
        <h2 className="display-font text-lg text-[var(--text-primary)]">{labels.title}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{labels.description}</p>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm text-[var(--text-secondary)]">{labels.password}</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pl-10 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label={showPassword ? labels.hidePassword : labels.showPassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {Array.from({length: 4}).map((_, index) => (
              <div
                key={index}
                className={clsx('h-2 rounded-full transition-colors', segmentClassName(index))}
              />
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{strengthLabel}</p>
          {password.length > 0 && <PasswordChecklist password={password} />}
        </div>

        <label className="block space-y-2">
          <span className="text-sm text-[var(--text-secondary)]">{labels.passwordRepeat}</span>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              type={showPasswordRepeat ? 'text' : 'password'}
              autoComplete="new-password"
              value={passwordRepeat}
              onChange={(event) => setPasswordRepeat(event.target.value)}
              className={clsx(
                'pl-10 pr-11',
                passwordsMismatch &&
                  'border-[var(--error)] focus-visible:ring-[var(--error)]'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPasswordRepeat((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label={
                showPasswordRepeat ? labels.hidePasswordRepeat : labels.showPasswordRepeat
              }
            >
              {showPasswordRepeat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordsMismatch ? <p className="text-xs text-[var(--error)]">{labels.mismatch}</p> : null}
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--btn-radius)] bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" strokeWidth={1.75} />
          {saving ? labels.saving : labels.save}
        </button>
      </div>
    </section>
  );
}
