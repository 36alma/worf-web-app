interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows
}: {
  columns: Column<T>[];
  rows: T[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <article key={index} className="rounded-lg border border-[var(--border)] bg-slate-900/30 p-3">
            <div className="space-y-2">
              {columns.map((column) => (
                <div key={String(column.key)} className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{column.label}</p>
                  <div className="text-sm text-slate-200">
                    {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '-')}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-[var(--border)] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className="px-4 py-3 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-[var(--border)]">
                {columns.map((column) => (
                  <td key={String(column.key)} className="px-4 py-3 text-slate-200">
                    {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
