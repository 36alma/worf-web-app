import {ReactNode} from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({open, title, onClose, children}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="surface card-animate w-full max-w-xl rounded-xl p-5"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="display-font text-lg">{title}</h3>
          <button type="button" className="text-slate-400" onClick={onClose}>
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
