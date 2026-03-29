import {getTranslations} from 'next-intl/server';
import {getServerAccessToken} from '@/lib/utils/cookies';

async function getGroupCount() {
  const token = await getServerAccessToken();
  if (!token) return 0;

  try {
    const apiBase = process.env.WORF_API_URL;
    if (!apiBase) {
      console.error('[Dashboard] WORF_API_URL is missing!');
      return 0;
    }

    // Tisztítsuk meg az URL-t a dupla v1-től
    const baseUrl = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const targetUrl = `${baseUrl}/v1/group/getusergroups`.replace(/\/v1\/v1\//g, '/v1/');

    console.log(`[Dashboard] Fetching groups from: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Bearer: token }),
      cache: 'no-store' // Ne gyorstárazza a 0-át
    });

    if (!response.ok) {
      console.error(`[Dashboard] API error: ${response.status} ${response.statusText}`);
      return 0;
    }

    const raw = await response.json();
    console.log('[Dashboard] Raw data:', JSON.stringify(raw).substring(0, 200) + '...');

    const results: any[] = [];
    const traverse = (item: any) => {
      if (!item || typeof item === 'function') return;
      if (Array.isArray(item)) {
        item.forEach(traverse);
        return;
      }
      if (typeof item === 'object') {
        const keys = Object.keys(item);
        const idKey = keys.find(k => k.toLowerCase().endsWith('id') || k.toLowerCase() === 'id');
        const id = idKey ? item[idKey] : null;

        if (id && id !== 'undefined' && id !== 'null') {
          results.push(item);
          return;
        }
        Object.values(item).forEach(traverse);
      }
    };

    traverse(raw);
    const count = new Set(results.map(r => {
      const keys = Object.keys(r);
      const k = keys.find(k => k.toLowerCase().endsWith('id') || k.toLowerCase() === 'id');
      return String(r[k!]);
    })).size;

    console.log(`[Dashboard] Found ${count} unique groups.`);
    return count;
  } catch (error) {
    console.error('[Dashboard] Unexpected error:', error);
    return 0;
  }
}

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const groupCount = await getGroupCount();

  const cards = [
    {label: t('active_groups'), value: groupCount.toString()},
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
