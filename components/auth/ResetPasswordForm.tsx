'use client';

import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {resetPassword} from '@/lib/api/auth';
import Button from '@/components/ui/Button';

const schema = z
  .object({
    newpassword: z.string().min(8),
    newpassword_rep: z.string().min(8)
  })
  .refine((value) => value.newpassword === value.newpassword_rep, {
    message: 'PASSWORDS_MISMATCH',
    path: ['newpassword_rep']
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordForm({token}: {token: string}) {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    formState: {errors, isSubmitting}
  } = useForm<FormValues>({resolver: zodResolver(schema)});

  const onSubmit = async (values: FormValues) => {
    try {
      await resetPassword({reset_token: token, ...values});
      toast.success(t('reset_success'));
    } catch {
      toast.error(t('reset_error'));
    }
  };

  const mismatchMessage =
    errors.newpassword_rep?.message === 'PASSWORDS_MISMATCH' ? t('passwords_do_not_match') : errors.newpassword_rep?.message;

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <input
        type="password"
        placeholder={t('new_password')}
        className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
        {...register('newpassword')}
      />
      <input
        type="password"
        placeholder={t('new_password_repeat')}
        className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
        {...register('newpassword_rep')}
      />
      {mismatchMessage && <p className="text-xs text-red-400">{mismatchMessage}</p>}
      <Button className="w-full" type="submit" disabled={isSubmitting || !token}>
        {t('reset_password')}
      </Button>
    </form>
  );
}
