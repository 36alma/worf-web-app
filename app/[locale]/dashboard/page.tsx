import {getTranslations} from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  const cards = [
    {label: t('active_groups'), value: '0'},
    {label: t('open_tasks'), value: '0'},
    {label: t('upcoming_events'), value: '0'}
  ];

  return (
    <div className="space-y-6">
      <h1 className="display-font text-2xl">{t('title')}</h1>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <section key={card.label} className="surface card-animate rounded-xl p-4">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="display-font mt-2 text-3xl">{card.value}</p>
          </section>
        ))}
      </div>
      <section className="surface rounded-xl p-4">
        <h2 className="mb-2 text-lg">{t('welcome')}</h2>
        <p className="text-sm text-slate-400">{t('empty_hint')}</p>
      </section>
    </div>
  );
}
