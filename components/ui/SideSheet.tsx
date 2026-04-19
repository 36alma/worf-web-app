import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {ReactNode} from 'react';

export interface SideSheetProps {
  open: boolean;
  title: string | ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export default function SideSheet({open, title, onClose, children}: SideSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-all duration-300" />
        <Dialog.Content className="dialog-content fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl transition-transform duration-300 sm:max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Dialog.Title className="text-xl font-semibold text-[var(--text-primary)]">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>
          <div className="h-[calc(100vh-100px)] overflow-y-auto pr-2 pb-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
