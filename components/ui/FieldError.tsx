import clsx from 'clsx';

export interface FieldErrorProps {
  /** Egy vagy több (már lefordított) hibaüzenet. Üres/undefined esetén nem renderel. */
  messages?: string[] | string;
  className?: string;
}

/** Egységes inline mező-hiba a mező alatt. Alapból az első üzenetet jeleníti meg. */
export default function FieldError({messages, className}: FieldErrorProps) {
  const list = Array.isArray(messages) ? messages : messages ? [messages] : [];
  if (list.length === 0) return null;

  return (
    <p role="alert" className={clsx('mt-1 text-caption font-medium text-danger', className)}>
      {list[0]}
    </p>
  );
}
