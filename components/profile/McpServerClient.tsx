'use client';

import {Check, Copy, KeyRound, Plug} from 'lucide-react';
import {useState} from 'react';
import toast from 'react-hot-toast';

interface McpServerClientLabels {
  endpointLabel: string;
  endpointDescription: string;
  discoveryLabel: string;
  discoveryDescription: string;
  copy: string;
  copied: string;
  copyFailed: string;
  dynamicRegistrationTitle: string;
  dynamicRegistrationDescription: string;
  missingConfig: string;
}

interface McpServerClientProps {
  mcpEndpointUrl: string;
  discoveryUrl: string;
  labels: McpServerClientLabels;
}

function UrlCard({
  icon: Icon,
  title,
  description,
  url,
  labels
}: {
  icon: typeof Plug;
  title: string;
  description: string;
  url: string;
  labels: Pick<McpServerClientLabels, 'copy' | 'copied' | 'copyFailed'>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(labels.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(labels.copyFailed);
    }
  };

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
          <Icon className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-input)] px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]">{url}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--btn-radius)] border border-[var(--accent-border)] bg-[var(--badge-orange-bg)] px-3 text-xs font-medium text-[var(--badge-orange-text)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
    </div>
  );
}

export default function McpServerClient({mcpEndpointUrl, discoveryUrl, labels}: McpServerClientProps) {
  if (!mcpEndpointUrl || !discoveryUrl) {
    return (
      <section className="surface rounded-[var(--radius-lg)] p-5">
        <p className="text-sm text-[var(--text-secondary)]">{labels.missingConfig}</p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="surface space-y-4 rounded-[var(--radius-lg)] p-5">
        <UrlCard
          icon={Plug}
          title={labels.endpointLabel}
          description={labels.endpointDescription}
          url={mcpEndpointUrl}
          labels={labels}
        />
        <UrlCard
          icon={KeyRound}
          title={labels.discoveryLabel}
          description={labels.discoveryDescription}
          url={discoveryUrl}
          labels={labels}
        />
      </section>

      <section className="surface space-y-2 rounded-[var(--radius-lg)] p-5">
        <h2 className="display-font text-lg text-[var(--text-primary)]">{labels.dynamicRegistrationTitle}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{labels.dynamicRegistrationDescription}</p>
      </section>
    </div>
  );
}
