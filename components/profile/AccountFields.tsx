'use client';

import {type LucideIcon, Mail, Save, User, UserRound} from 'lucide-react';
import clsx from 'clsx';
import {useEffect, useMemo, useState} from 'react';
import toast from 'react-hot-toast';
import {Input} from '@/components/ui/Input';
import FieldError from '@/components/ui/FieldError';
import {useFieldValidation} from '@/hooks/useFieldValidation';
import {optionalEmailSchema, optionalFullNameSchema, optionalText} from '@/lib/validation';
import {updateCurrentUserProfile} from '@/lib/api/user';
import type {ProfileData} from '@/components/profile/types';

type EditableField = 'username' | 'email' | 'full_name';

interface AccountFieldsProps {
  profile: ProfileData;
  labels: {
    title: string;
    description: string;
    username: string;
    email: string;
    full_name: string;
    edit: string;
    save: string;
    saving: string;
    saveSuccess: string;
    saveError: string;
  };
  onProfileChange: (updater: (current: ProfileData) => ProfileData) => void;
}

interface FieldConfig {
  key: EditableField;
  label: string;
  icon: LucideIcon;
  type?: 'text' | 'email';
  autoComplete: string;
}

const iconClassName = 'h-4 w-4 text-[var(--accent)]';

export default function AccountFields({profile, labels, onProfileChange}: AccountFieldsProps) {
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [drafts, setDrafts] = useState<Record<EditableField, string>>({
    username: profile.username,
    email: profile.email,
    full_name: profile.full_name
  });
  const [savingField, setSavingField] = useState<EditableField | null>(null);
  const schemas = useMemo(
    () => ({username: optionalText(150), email: optionalEmailSchema, full_name: optionalFullNameSchema}),
    []
  );
  const {errors, validateField, clearError} = useFieldValidation(schemas);

  useEffect(() => {
    setDrafts({
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name
    });
  }, [profile.email, profile.full_name, profile.username]);

  const fields: FieldConfig[] = [
    {key: 'username', label: labels.username, icon: User, autoComplete: 'username'},
    {key: 'email', label: labels.email, icon: Mail, type: 'email', autoComplete: 'email'},
    {key: 'full_name', label: labels.full_name, icon: UserRound, autoComplete: 'name'}
  ];

  const handleSave = async (field: EditableField) => {
    if (!validateField(field, drafts[field])) {
      return;
    }

    const nextValue = drafts[field].trim();
    const previousValue = profile[field];

    if (nextValue === previousValue) {
      setEditingField(null);
      return;
    }

    setSavingField(field);
    onProfileChange((current) => ({...current, [field]: nextValue}));
    setEditingField(null);

    try {
      const {data} = await updateCurrentUserProfile({[field]: nextValue || null});
      const responseProfile = (data?.data ?? data ?? {}) as Record<string, unknown>;

      if (Object.keys(responseProfile).length > 0) {
        onProfileChange((current) => ({
          ...current,
          username: String(responseProfile.username ?? current.username),
          email: String(responseProfile.email ?? current.email),
          full_name: String(responseProfile.full_name ?? responseProfile.fullname ?? current.full_name),
          is_active:
            typeof responseProfile.is_active === 'boolean' ? responseProfile.is_active : current.is_active,
          email_verified:
            typeof responseProfile.email_verified === 'boolean'
              ? responseProfile.email_verified
              : current.email_verified
        }));
      }

      toast.success(labels.saveSuccess);
    } catch {
      onProfileChange((current) => ({...current, [field]: previousValue}));
      setDrafts((current) => ({...current, [field]: previousValue}));
      setEditingField(field);
      toast.error(labels.saveError);
    } finally {
      setSavingField(null);
    }
  };

  return (
    <section className="surface space-y-4 rounded-[var(--radius-lg)] p-5">
      <div className="space-y-1">
        <h2 className="display-font text-lg text-[var(--text-primary)]">{labels.title}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{labels.description}</p>
      </div>

      <div className="space-y-3">
        {fields.map(({key, label, icon: Icon, type = 'text', autoComplete}) => {
          const isEditing = editingField === key;
          const isSaving = savingField === key;

          return (
            <div
              key={key}
              className={clsx(
                'rounded-[var(--radius-md)] border p-4 transition-colors',
                isEditing
                  ? 'border-[var(--accent-border)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--border-default)] bg-[var(--bg-elevated)]'
              )}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
                    <Icon className={iconClassName} strokeWidth={1.75} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>

                    {isEditing ? (
                      <>
                        <Input
                          type={type}
                          autoComplete={autoComplete}
                          value={drafts[key]}
                          onChange={(event) => {
                            const value = event.target.value;
                            setDrafts((current) => ({...current, [key]: value}));
                            clearError(key);
                          }}
                          onBlur={(event) => validateField(key, event.target.value)}
                          className="mt-2"
                        />
                        <FieldError messages={errors[key]} />
                      </>
                    ) : (
                      <p className="mt-1 truncate text-sm text-[var(--text-primary)]">{profile[key] || '—'}</p>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <button
                    type="button"
                    onClick={() => handleSave(key)}
                    disabled={isSaving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--btn-radius)] bg-[var(--accent)] px-4 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" strokeWidth={1.75} />
                    {isSaving ? labels.saving : labels.save}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingField(key)}
                    className="inline-flex h-10 items-center justify-center rounded-[var(--btn-radius)] border border-[var(--accent-border)] bg-[var(--badge-orange-bg)] px-4 text-sm font-medium text-[var(--badge-orange-text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {labels.edit}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
