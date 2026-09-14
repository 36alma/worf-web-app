import {getTranslations} from 'next-intl/server';
import McpServerClient from '@/components/profile/McpServerClient';

export default async function ProfileMcpPage() {
  const t = await getTranslations('profile.mcp');

  const apiBase = process.env.WORF_API_URL ?? '';
  const normalizedBase = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
  const mcpEndpointUrl = normalizedBase ? `${normalizedBase}/mcp` : '';
  const discoveryUrl = normalizedBase ? `${normalizedBase}/.well-known/oauth-authorization-server` : '';

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="display-font text-2xl text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      <McpServerClient
        mcpEndpointUrl={mcpEndpointUrl}
        discoveryUrl={discoveryUrl}
        labels={{
          endpointLabel: t('endpoint_label'),
          endpointDescription: t('endpoint_description'),
          discoveryLabel: t('discovery_label'),
          discoveryDescription: t('discovery_description'),
          copy: t('copy'),
          copied: t('copied'),
          copyFailed: t('copy_failed'),
          dynamicRegistrationTitle: t('dynamic_registration_title'),
          dynamicRegistrationDescription: t('dynamic_registration_description'),
          missingConfig: t('missing_config')
        }}
      />
    </section>
  );
}
