'use client';

import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {forgetPassword} from '@/lib/api/auth';
import Button from '@/components/ui/Button';

const schema = z.object({
  email: z.string().email()
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const {
    register,
    handleSubmit,
    formState: {errors, isSubmitting}
  } = useForm<FormValues>({resolver: zodResolver(schema)});

  const onSubmit = async (values: FormValues) => {
    try {
      await forgetPassword(values);
      toast.success(t('forgot_sent'));
    } catch {
      toast.error(t('forgot_error'));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm text-slate-300">{t('email')}</label>
        <input
          type="email"
          className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
          {...register('email')}
        />
        {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t('forgot_password')}
      </Button>
    </form>
  );
}
