'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import toast from 'react-hot-toast';
import {Switch} from '@/components/ui/Switch';
import {getGroupPostReviewSettings, setGroupPostReviewSettings} from '@/lib/api/posts';
import {readData} from '@/lib/posts/model';

/** "Posts need approval" switch of a group — rendered only for `group.post.review.manage`. */
export default function GroupPostReviewSetting({groupId}: {groupId: string}) {
  const t = useTranslations('group_detail.general');
  const [required, setRequired] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    getGroupPostReviewSettings(groupId)
      .then((response) => {
        const root = readData(response.data) as Record<string, unknown> | null;
        if (mounted) setRequired(root?.require_post_review === true);
      })
      .catch(() => mounted && setRequired(null));
    return () => {
      mounted = false;
    };
  }, [groupId]);

  const onChange = async (next: boolean) => {
    const previous = required;
    setRequired(next);
    setSaving(true);
    try {
      await setGroupPostReviewSettings(groupId, next);
      toast.success(t('post_review_saved'));
    } catch {
      setRequired(previous);
      toast.error(t('post_review_error'));
    } finally {
      setSaving(false);
    }
  };

  if (required === null) return null;

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white mb-1">{t('post_review_title')}</h2>
          <p className="text-sm text-fg-secondary">{t('post_review_description')}</p>
        </div>
        <Switch
          checked={required}
          disabled={saving}
          aria-label={t('post_review_title')}
          onCheckedChange={(checked) => void onChange(checked)}
        />
      </div>
    </section>
  );
}
