'use client';

import {useForm} from 'react-hook-form';
import {z} from 'zod';
import {zodResolver} from '@hookform/resolvers/zod';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from 'next/navigation';
import toast from 'react-hot-toast';
import {register as registerApi} from '@/lib/api/auth';
import Button from '@/components/ui/Button';

const schema = z.object({
  fullname: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

export default function RegisterForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: {errors, isSubmitting}
  } = useForm<FormValues>({resolver: zodResolver(schema)});

  const onSubmit = async (values: FormValues) => {
    try {
      await registerApi(values);
      toast.success(t('register_success'));
      router.push(`/${locale}/auth/login`);
    } catch {
      toast.error(t('register_failed'));
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm text-slate-300">{t('fullname')}</label>
        <input
          className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
          {...register('fullname')}
        />
        {errors.fullname && <p className="mt-1 text-xs text-red-400">{errors.fullname.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">{t('email')}</label>
        <input
          type="email"
          className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
          {...register('email')}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">{t('password')}</label>
        <input
          type="password"
          className="w-full rounded-md border border-[var(--border)] bg-[#0f0f18] px-3 py-2"
          {...register('password')}
        />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t('register')}
      </Button>
    </form>
  );
}
