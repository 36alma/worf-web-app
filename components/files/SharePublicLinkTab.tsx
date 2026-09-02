'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import {
  createShareLink,
  revokeShareLink,
  listShareLinks,
  type ShareLinkEntry,
  type ShareLinkPermission,
} from '@/lib/api/files';
import { translateFileApiError } from '@/lib/i18n/files';
import { formatUploadedAt } from '@/lib/utils/formatFiles';
import Button from '@/components/ui/Button';

export interface SharePublicLinkTabProps {
  fileId: string;
  isOwner: boolean;
}

export default function SharePublicLinkTab({ fileId, isOwner }: SharePublicLinkTabProps) {
  const t = useTranslations('files');
  const locale = useLocale();
  const [links, setLinks] = useState<ShareLinkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<ShareLinkPermission>('download');
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ url: string } | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    listShareLinks(fileId)
      .then((response) => setLinks(response.data.links))
      .catch((error) => toast.error(translateFileApiError(t, error, 'errors.default')))
      .finally(() => setIsLoading(false));
  }, [fileId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const response = await createShareLink(
        fileId,
        permission,
        expiresAt ? new Date(expiresAt).toISOString() : null,
        password || null
      );
      const url = `${window.location.origin}/${locale}/shared/${response.data.token}`;
      setJustCreated({ url });
      setPassword('');
      setExpiresAt('');
      load();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    setRevokingId(linkId);
    try {
      await revokeShareLink(linkId);
      toast.success(t('share.link.revokeSuccess'));
      load();
    } catch (error) {
      toast.error(translateFileApiError(t, error, 'errors.default'));
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('share.link.copied'));
    } catch {
      toast.error(t('share.link.copyFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {justCreated && (
        <div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-subtle)] p-3 text-sm">
          <p className="mb-2 font-medium text-[var(--text-primary)]">{t('share.link.oneTimeWarning')}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={justCreated.url} className="flex-1 truncate rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs" />
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyToClipboard(justCreated.url)}>
              <Copy size={14} strokeWidth={1.75} />
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="link-permission" checked={permission === 'view'} onChange={() => setPermission('view')} />
              {t('share.link.permissionView')}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="link-permission" checked={permission === 'download'} onChange={() => setPermission('download')} />
              {t('share.link.permissionDownload')}
            </label>
          </div>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm" placeholder={t('share.link.expiresAt')} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('share.link.passwordOptional')} className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm" />
          <Button type="button" variant="primary" loading={isCreating} onClick={() => void handleCreate()}>{t('share.link.create')}</Button>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{t('share.link.existing')}</p>
        {isLoading ? (
          <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--bg-elevated)]" />
        ) : links.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">{t('share.link.none')}</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li key={link.link_id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)]">
                    {link.permission === 'download' ? t('share.link.permissionDownload') : t('share.link.permissionView')}
                    {link.has_password && ` · ${t('share.link.passwordProtected')}`}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {t('share.link.accessCount', { count: link.access_count })}
                    {link.last_accessed_at && ` · ${formatUploadedAt(link.last_accessed_at)}`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" loading={revokingId === link.link_id} onClick={() => void handleRevoke(link.link_id)}>
                  {t('share.revokeButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
