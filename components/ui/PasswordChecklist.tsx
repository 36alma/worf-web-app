'use client';

import {useTranslations} from 'next-intl';
import {Check, X} from 'lucide-react';
import clsx from 'clsx';
import {checkPasswordRules, PASSWORD_RULE_IDS} from '@/lib/validation';

export interface PasswordChecklistProps {
  password: string;
  className?: string;
}

/**
 * Élő jelszó-követelmény lista: minden szabály külön sorként, valós időben pipával/❌-szel.
 * Így a felhasználó pontosan látja, MELYIK követelmény hiányzik még (pl. csak a nagybetű).
 */
export default function PasswordChecklist({password, className}: PasswordChecklistProps) {
  const t = useTranslations('validation');
  const results = checkPasswordRules(password);

  return (
    <ul className={clsx('mt-2 space-y-1', className)}>
      {PASSWORD_RULE_IDS.map((ruleId) => {
        const ok = results[ruleId];
        return (
          <li
            key={ruleId}
            className={clsx(
              'flex items-center gap-1.5 text-[12px] transition-colors',
              ok ? 'text-emerald-500' : 'text-[var(--text-tertiary)]'
            )}
          >
            {ok ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2.5} />}
            <span>{t(`password_${ruleId}`)}</span>
          </li>
        );
      })}
    </ul>
  );
}
