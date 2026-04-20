import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {ReactNode, useRef} from 'react';

export interface SideSheetProps {
  open: boolean;
  title: string | ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export default function SideSheet({open, title, onClose, children}: SideSheetProps) {
  const startY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 80) onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-200" />

        {/* Content – bottom sheet mobilon, right panel desktopom */}
        <Dialog.Content
          className={[
            // Mobil alap: teljes szélességű bottom sheet
            'fixed inset-x-0 bottom-0 z-50 flex flex-col',
            'max-h-[92dvh] bg-[var(--bg-surface)]',
            'rounded-t-2xl border-t border-[var(--border-subtle)]',
            'shadow-2xl',
            // Animáció
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
            'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
            'duration-300',
            // md+ (tablet/desktop): jobb oldali panel
            'md:inset-y-0 md:right-0 md:bottom-auto md:left-auto',
            'md:h-full md:max-h-full md:w-full md:max-w-md',
            'md:rounded-none md:rounded-l-2xl',
            'md:border-t-0 md:border-l',
            // desktop-on: slide-in ballról
            'md:data-[state=open]:slide-in-from-right',
            'md:data-[state=closed]:slide-out-to-right',
          ].join(' ')}
        >
          {/* Drag handle – csak mobilon */}
          <div
            className="flex justify-center pt-3 pb-1 md:hidden shrink-0 cursor-grab"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* Fejléc */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Bezárás"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:bg-[var(--bg-hover)]"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </Dialog.Close>
          </div>

          {/* Görgethető tartalom */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
