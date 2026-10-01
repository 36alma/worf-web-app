import {ArrowLeft} from 'lucide-react';
import Link from 'next/link';
import {getTranslations} from 'next-intl/server';
import McpServersClient from '@/components/profile/McpServersClient';
import {getMcpServers} from '@/lib/server/mcp-discovery';

export default async function McpServersPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations('mcpServers');

  const servers = await getMcpServers().catch(() => null);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <Link
          href={`/${locale}/profile`}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} strokeWidth={1.75} />
          {t('back_to_profile')}
        </Link>
        <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>
      <McpServersClient servers={servers} />
    </section>
  );
}
