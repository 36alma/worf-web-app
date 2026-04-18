import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import {ArrowUpDown, MoreHorizontal, Table2} from 'lucide-react';
import type {ReactNode} from 'react';

export interface Column<T> {
  key: keyof T;
  label: string;
  render?: (value: T[keyof T], row: T) => ReactNode;
}

export interface DataTableProps<T extends object> {
  columns: Column<T>[];
  rows: T[];
  /** Custom content rendered inside an empty tbody — replaces the default "No data" row. */
  emptyState?: ReactNode;
}

export default function DataTable<T extends object>({columns, rows, emptyState}: DataTableProps<T>) {
  return (
    <Tooltip.Provider delayDuration={170}>
      {/* 0.5px subtle border — background already separates the surface */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <ScrollArea.Root>
          <ScrollArea.Viewport className="w-full">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--bg-surface)]">
                <tr className="h-[var(--table-header-height)] border-b border-[var(--border-subtle)]">
                  {columns.map((column) => (
                    <th
                      key={String(column.key)}
                      scope="col"
                      /* group — so the sort icon can react to th hover */
                      className="group px-4 text-xs font-medium text-[var(--text-tertiary)]"
                    >
                      <span className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-secondary)]">
                        {/* Sort icon: invisible by default, fades in on column hover */}
                        <ArrowUpDown
                          size={13}
                          strokeWidth={1.75}
                          className="opacity-0 transition-opacity duration-150 group-hover:opacity-60"
                        />
                        {column.label}
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="w-10 px-2 text-[var(--text-tertiary)]">
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        <MoreHorizontal size={14} strokeWidth={1.75} />
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content className="dropdown-content rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)]">
                          Actions
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-4 py-10 text-center">
                      {emptyState ?? (
                        <span className="inline-flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
                          <Table2 size={16} strokeWidth={1.75} />
                          No data
                        </span>
                      )}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    /* h-12 = 48px minimum row height */
                    <tr
                      key={index}
                      className="table-row h-12 border-b border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
                    >
                      {columns.map((column) => (
                        <td key={String(column.key)} className="px-4 py-3 text-[var(--text-primary)]">
                          {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '-')}
                        </td>
                      ))}
                      <td className="px-2 text-[var(--text-secondary)]">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
                        >
                          <MoreHorizontal size={14} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="horizontal" className="flex h-2 touch-none p-0.5">
            <ScrollArea.Thumb className="relative flex-1 rounded-full bg-[var(--border-hover)]" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </Tooltip.Provider>
  );
}
