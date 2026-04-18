import { ReactNode } from 'react';

export default async function GroupDetailLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  await params;

  return (
    <div className="space-y-4">{children}</div>
  );
}
