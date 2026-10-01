'use client';

import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { AlertTriangle, Copy, Plug } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import type { McpServerInfo } from '@/lib/server/mcp-discovery';

export interface McpServersClientProps {
  servers: McpServerInfo[] | null;
}

export default function McpServersClient({ servers }: McpServersClientProps) {
  const t = useTranslations('mcpServers');

  const handleCopy = async (server: McpServerInfo) => {
    try {
      await navigator.clipboard.writeText(server.url);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copy_error'));
    }
  };

  if (servers === null) {
    return (
      <EmptyState icon={<AlertTriangle size={20} strokeWidth={1.75} />} compact={false}>
        {t('load_error')}
      </EmptyState>
    );
  }

  return (
    <section className="space-y-4">
      <div className="surface space-y-2 rounded-[var(--radius-lg)] p-5">
        <h2 className="text-base font-medium text-fg">{t('how_to_title')}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{t('how_to_description')}</p>
      </div>

      <div className="space-y-3">
        {servers.map((server) => (
          <Card key={server.name} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{server.name}</p>
              <p className="truncate font-mono text-xs text-fg-secondary">{server.url}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(server)}
              startIcon={<Copy size={16} strokeWidth={1.75} />}
            >
              {t('copy')}
            </Button>
          </Card>
        ))}
      </div>

      {servers.length === 0 && (
        <EmptyState icon={<Plug size={20} strokeWidth={1.75} />} compact={false}>
          {t('empty_state')}
        </EmptyState>
      )}
    </section>
  );
}
