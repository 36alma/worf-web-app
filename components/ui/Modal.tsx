import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {ReactNode} from 'react';

export interface ModalProps {
  open: boolean;
  title: string;
  /** Optional badge shown next to the title (e.g. member count). */
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({open, title, badge, onClose, children}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content className="dialog-content fixed left-1/2 top-1/2 z-50 w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Dialog.Title className="truncate text-base font-semibold text-[var(--text-primary)]">
                {title}
              </Dialog.Title>
              {badge != null && (
                <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-tertiary)]">
                  {badge}
                </span>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <X size={16} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
