'use client';

import {Languages, Settings2} from 'lucide-react';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';

export interface ProfilePreferencesProps {
  className?: string;
}

export default function ProfilePreferences({className}: ProfilePreferencesProps) {
  return (
    <section className={`surface space-y-4 rounded-[var(--radius-lg)] p-4 ${className ?? ''}`}>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
        <Settings2 size={18} strokeWidth={1.75} />
        Preferences
      </h2>

      <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] p-3">
        <p className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
          <Languages size={16} strokeWidth={1.75} />
          Language
        </p>
        <LanguageSwitcher />
      </div>
    </section>
  );
}
