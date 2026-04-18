'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {ArrowLeft, Calendar, ChevronDown, Edit, Globe, Tag, User} from 'lucide-react';
import toast from 'react-hot-toast';
import {getGlobalPost, getGroupPost} from '@/lib/api/posts';

type RawObject = Record<string, unknown>;
type PostStatus = 'draft' | 'published' | 'scheduled';

interface PostReadScreenProps {
  scope: 'global' | 'group';
  groupId?: string;
  postId: string;
}

interface ReadPostData {
  id: string;
  title: string;
  body: string;
  author: string;
  categoryName: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

const readData = (payload: unknown): unknown => {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const candidate = payload as RawObject;
  if ('data' in candidate) {
    return candidate.data;
  }

  return payload;
};

const normalizeReadPost = (payload: unknown): ReadPostData => {
  const source = readData(payload);

  if (!source || typeof source !== 'object') {
    return {
      id: '',
      title: '',
      body: '',
      author: '',
      categoryName: '',
      status: 'draft',
      createdAt: '',
      updatedAt: ''
    };
  }

  const root = source as RawObject;
  const nestedPost = root.post && typeof root.post === 'object' ? (root.post as RawObject) : root;
  const nestedCategory = root.category && typeof root.category === 'object' ? (root.category as RawObject) : null;
  const nestedAuthor = root.author && typeof root.author === 'object' ? (root.author as RawObject) : null;

  const statusValue = String(nestedPost.status ?? root.status ?? root.post_status ?? 'draft').toLowerCase();
  const normalizedStatus: PostStatus = statusValue === 'published' || statusValue === 'scheduled' ? statusValue : 'draft';

  return {
    id: String(root.post_id ?? root.id ?? nestedPost.post_id ?? nestedPost.id ?? ''),
    title: String(nestedPost.title ?? root.title ?? ''),
    body: String(nestedPost.content ?? nestedPost.body ?? root.content ?? root.body ?? ''),
    author: String(
      nestedAuthor?.name ??
        nestedAuthor?.username ??
        (nestedPost.author && typeof nestedPost.author === 'object' ? (nestedPost.author as RawObject).name : nestedPost.author) ??
        root.author_name ??
        nestedPost.author_name ??
        root.username ??
        ''
    ),
    categoryName: String(
      nestedCategory?.category_name ??
        nestedCategory?.name ??
        (nestedPost.category && typeof nestedPost.category === 'object'
          ? ((nestedPost.category as RawObject).category_name ?? (nestedPost.category as RawObject).name)
          : undefined) ??
        root.post_category_name ??
        root.category_name ??
        ''
    ),
    status: normalizedStatus,
    createdAt: String(nestedPost.created_at ?? nestedPost.create_time ?? root.created_at ?? root.create_time ?? ''),
    updatedAt: String(nestedPost.updated_at ?? root.updated_at ?? '')
  };
};

const formatDateTime = (value: string, locale: string, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const isHungarian = locale.startsWith('hu');
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: isHungarian ? 'short' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !isHungarian
  }).format(date);
};

export default function PostReadScreen({scope, groupId = '', postId}: PostReadScreenProps) {
  const locale = useLocale();
  const postsT = useTranslations('posts');
  const detailT = useTranslations('posts.detail');
  const actionsT = useTranslations('posts.actions');

  const resolvedPostId = useMemo(() => {
    const trimmed = postId.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return '';
    }

    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }, [postId]);

  const backHref = scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts` : `/${locale}/posts`;
  const editHref =
    scope === 'group' ? `/${locale}/groups/${encodeURIComponent(groupId)}/posts/${encodeURIComponent(resolvedPostId)}/edit` : `/${locale}/posts/${encodeURIComponent(resolvedPostId)}/edit`;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<ReadPostData | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const response =
          scope === 'group' && groupId ? await getGroupPost(groupId, resolvedPostId) : await getGlobalPost(resolvedPostId);
        const normalized = normalizeReadPost(response.data);

        if (mounted) {
          setPost(normalized);
        }
      } catch {
        if (mounted) {
          setPost(null);
        }
        toast.error(detailT('loadError'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (resolvedPostId) {
      void load();
    } else {
      setLoading(false);
      setPost(null);
    }

    return () => {
      mounted = false;
    };
  }, [detailT, groupId, resolvedPostId, scope]);

  const title = post?.title.trim() ? post.title : postsT('untitled');
  const titleForBreadcrumb = title.length > 30 ? `${title.slice(0, 30).trimEnd()}...` : title;
  const author = post?.author.trim() ? post.author : postsT('unknownAuthor');
  const createdAt = formatDateTime(post?.createdAt ?? '', locale, postsT('timeUnknown'));
  const updatedAt = formatDateTime(post?.updatedAt ?? '', locale, postsT('timeUnknown'));

  return (
    <section className="post-read-page space-y-4">
      <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/${locale}/dashboard`} className="hover:text-[var(--text-primary)]">
          Dashboard
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <Link href={backHref} className="hover:text-[var(--text-primary)]">
          {postsT('title')}
        </Link>
        <ChevronDown size={14} className="breadcrumb-sep rotate-[-90deg]" />
        <span className="breadcrumb-current">{loading ? detailT('loading') : titleForBreadcrumb}</span>
      </nav>

      <header className="page-header post-read-header flex flex-wrap items-start justify-between gap-3">
        <div className="page-title-section min-w-0">
          <div className="page-title-row flex items-center gap-2">
            <h1 className="page-title text-[20px] font-semibold leading-[1.3] text-[var(--text-primary)]">{detailT('title')}</h1>
            <span className="scope-badge inline-flex items-center gap-1 rounded-[6px] bg-[rgba(136,136,136,0.10)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.03em] text-[var(--text-secondary)]">
              <Globe size={12} strokeWidth={1.75} />
              {scope === 'group' ? detailT('group') : detailT('global')}
            </span>
          </div>
          <p className="page-subtitle mt-1 text-[13px] text-[var(--text-tertiary)]">{detailT('subtitle')}</p>
        </div>

        <div className="post-read-actions flex items-center gap-2">
          <Link href={backHref} className="btn-secondary">
            <ArrowLeft size={14} />
            <span>{actionsT('back')}</span>
          </Link>
          <Link href={editHref} className="btn-primary">
            <Edit size={14} />
            <span>{actionsT('edit')}</span>
          </Link>
        </div>
      </header>

      {loading ? (
        <article className="post-read-article surface rounded-xl p-4 md:p-6">
          <div className="post-skeleton post-skeleton-title" />
          <div className="post-skeleton post-skeleton-meta" />
          <div className="post-skeleton post-skeleton-line" />
          <div className="post-skeleton post-skeleton-line short" />
          <div className="post-skeleton post-skeleton-line" />
        </article>
      ) : !post ? (
        <div className="surface rounded-xl p-4 text-sm text-[var(--text-secondary)]">{detailT('notFound')}</div>
      ) : (
        <article className="post-read-article surface rounded-xl p-4 md:p-6">
          <h2 className="post-read-title">{title}</h2>

          <div className="post-read-meta">
            <span className="post-read-badge">
              <User size={12} />
              {author}
            </span>
            <span className="post-read-badge">
              <Globe size={12} />
              {postsT(`status.${post.status}`)}
            </span>
            {post.categoryName && (
              <span className="post-read-badge">
                <Tag size={12} />
                {post.categoryName}
              </span>
            )}
            <span className="post-read-badge">
              <Calendar size={12} />
              {detailT('created')}: {createdAt}
            </span>
            {post.updatedAt && (
              <span className="post-read-badge">
                <Calendar size={12} />
                {detailT('updated')}: {updatedAt}
              </span>
            )}
          </div>

          <div className="post-read-content mt-4">
            {post.body.trim() ? (
              <div className="post-detail-content prose prose-invert max-w-none" dangerouslySetInnerHTML={{__html: post.body}} />
            ) : (
              <p className="text-sm text-[var(--text-tertiary)]">-</p>
            )}
          </div>
        </article>
      )}
    </section>
  );
}
