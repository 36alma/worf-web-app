'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import {
  denyCimdClient,
  listOAuthClients,
  revokeOAuthClient,
  undenyCimdClient,
  type OAuthClientAdminEntry
} from '@/lib/api/oauth-admin';

const LIMIT = 50;

const getApiErrorMessage = (error: unknown): string | null => {
  const axiosError = error as AxiosError<{ detail?: Array<{ msg?: string }> | string; message?: string }>;
  const detail = axiosError?.response?.data?.detail;

  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item) => item?.msg).filter(Boolean).join(', ');
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }

  if (typeof axiosError?.response?.data?.message === 'string') {
    return axiosError.response.data.message;
  }

  return null;
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function AdminOAuthClientsManager() {
  const t = useTranslations('admin');

  const [rows, setRows] = useState<OAuthClientAdminEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<OAuthClientAdminEntry | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [cimdUrl, setCimdUrl] = useState('');
  const [cimdBusy, setCimdBusy] = useState<'deny' | 'undeny' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listOAuthClients(offset, LIMIT, includeRevoked);
      setRows(response.items ?? []);
      setTotal(response.total ?? 0);
    } catch {
      toast.error(t('oauth.load_error'));
    } finally {
      setLoading(false);
    }
  }, [offset, includeRevoked, t]);

  useEffect(() => {
    load();
  }, [load]);

  const onRevoke = async () => {
    if (!revokeTarget) return;

    try {
      setRevoking(true);
      await revokeOAuthClient(revokeTarget.client_id);
      toast.success(t('oauth.revoke_success'));
      setRevokeTarget(null);
      await load();
    } catch (error) {
      const axiosError = error as AxiosError;
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('oauth.revoke_error')} (${message})` : t('oauth.revoke_error'));

      if (axiosError?.response?.status === 404) {
        setRevokeTarget(null);
        await load();
      }
    } finally {
      setRevoking(false);
    }
  };

  const onCimdDeny = async () => {
    if (!cimdUrl.trim()) return;
    try {
      setCimdBusy('deny');
      await denyCimdClient(cimdUrl.trim());
      toast.success(t('oauth.cimd.deny_success'));
      setCimdUrl('');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('oauth.cimd.deny_error')} (${message})` : t('oauth.cimd.deny_error'));
    } finally {
      setCimdBusy(null);
    }
  };

  const onCimdUndeny = async () => {
    if (!cimdUrl.trim()) return;
    try {
      setCimdBusy('undeny');
      await undenyCimdClient(cimdUrl.trim());
      toast.success(t('oauth.cimd.undeny_success'));
      setCimdUrl('');
    } catch (error) {
      const message = getApiErrorMessage(error);
      toast.error(message ? `${t('oauth.cimd.undeny_error')} (${message})` : t('oauth.cimd.undeny_error'));
    } finally {
      setCimdBusy(null);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'name' as const, label: t('oauth.columns.name') },
      {
        key: 'client_type' as const,
        label: t('oauth.columns.client_type'),
        render: (value: unknown) => (value ? String(value) : '—')
      },
      {
        key: 'is_dynamically_registered' as const,
        label: t('oauth.columns.origin'),
        render: (value: unknown) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              value
                ? 'bg-[var(--badge-gray-bg)] text-[var(--badge-gray-text)]'
                : 'bg-[var(--accent-subtle)] text-[var(--accent)]'
            }`}
          >
            {value ? t('oauth.columns.origin_dcr') : t('oauth.columns.origin_manual')}
          </span>
        )
      },
      {
        key: 'revoked' as const,
        label: t('oauth.columns.status'),
        render: (value: unknown) => (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              value
                ? 'bg-[rgba(229,72,77,0.12)] text-[var(--error)]'
                : 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]'
            }`}
          >
            {value ? t('oauth.columns.status_revoked') : t('oauth.columns.status_active')}
          </span>
        )
      },
      {
        key: 'created_at' as const,
        label: t('oauth.columns.created_at'),
        render: (value: unknown) => formatDate(value as string | null)
      },
      {
        key: 'client_id' as const,
        label: t('oauth.columns.actions'),
        render: (_value: unknown, row: OAuthClientAdminEntry) => (
          <Button
            variant="ghost"
            className="p-2 text-danger hover:text-danger"
            disabled={row.revoked}
            onClick={() => setRevokeTarget(row)}
          >
            {t('oauth.revoke')}
          </Button>
        )
      }
    ],
    [t]
  );

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">{t('oauth.title')}</h1>
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(event) => {
                setOffset(0);
                setIncludeRevoked(event.target.checked);
              }}
            />
            {t('oauth.show_revoked')}
          </label>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <DataTable columns={columns} rows={rows} />
            </div>

            <div className="lg:hidden space-y-3">
              {rows.length === 0 ? (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center">
                  <p className="text-sm text-[var(--text-tertiary)]">{t('oauth.no_clients')}</p>
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.client_id}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{row.name || '—'}</p>
                        <p className="truncate text-xs text-[var(--text-secondary)]">{row.client_id}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          row.revoked
                            ? 'bg-[rgba(229,72,77,0.12)] text-[var(--error)]'
                            : 'bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]'
                        }`}
                      >
                        {row.revoked ? t('oauth.columns.status_revoked') : t('oauth.columns.status_active')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-secondary)]">
                      <span>{row.client_type ?? '—'}</span>
                      <span>{row.is_dynamically_registered ? t('oauth.columns.origin_dcr') : t('oauth.columns.origin_manual')}</span>
                      <span>{formatDate(row.created_at)}</span>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={row.revoked}
                        className="w-full rounded-lg border border-[rgba(229,72,77,0.25)] bg-[rgba(229,72,77,0.06)] px-3 py-2 text-xs font-medium text-[var(--error)] transition-colors hover:bg-[rgba(229,72,77,0.12)] disabled:opacity-50"
                        onClick={() => setRevokeTarget(row)}
                      >
                        {t('oauth.revoke')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <span>{t('oauth.total', { total })}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="p-2"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                >
                  {t('oauth.prev')}
                </Button>
                <span>{t('oauth.page', { page: currentPage, totalPages })}</span>
                <Button
                  variant="ghost"
                  className="p-2"
                  disabled={offset + LIMIT >= total}
                  onClick={() => setOffset(offset + LIMIT)}
                >
                  {t('oauth.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="space-y-3 border-t border-[var(--border-subtle)] pt-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('oauth.cimd.title')}</h2>
        <p className="text-xs text-[var(--text-tertiary)]">{t('oauth.cimd.hint')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[280px] flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {t('oauth.cimd.url_label')}
            </label>
            <input
              type="url"
              placeholder="https://evil-app.example/oauth-client.json"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
              value={cimdUrl}
              onChange={(event) => setCimdUrl(event.target.value)}
            />
          </div>
          <Button
            type="button"
            className="p-2 bg-danger hover:opacity-90 text-white"
            loading={cimdBusy === 'deny'}
            disabled={!cimdUrl.trim() || cimdBusy !== null}
            onClick={onCimdDeny}
          >
            {t('oauth.cimd.deny')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="p-2"
            loading={cimdBusy === 'undeny'}
            disabled={!cimdUrl.trim() || cimdBusy !== null}
            onClick={onCimdUndeny}
          >
            {t('oauth.cimd.undeny')}
          </Button>
        </div>
      </section>

      <Modal open={Boolean(revokeTarget)} title={t('oauth.revoke_title')} onClose={() => setRevokeTarget(null)}>
        {revokeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-fg-secondary">
              {t('oauth.revoke_confirm', { name: revokeTarget.name || revokeTarget.client_id })}
            </p>
            <div className="flex justify-end gap-2">
              <Button className="p-2" variant="ghost" onClick={() => setRevokeTarget(null)}>
                {t('cancel')}
              </Button>
              <Button className="p-2 bg-danger hover:opacity-90 text-white" onClick={onRevoke} disabled={revoking}>
                {revoking ? t('oauth.revoking') : t('oauth.revoke')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
