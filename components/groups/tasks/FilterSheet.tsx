import {useState, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import SideSheet from '@/components/ui/SideSheet';
import {translateTaskPriority, translateTaskStatus} from '@/lib/i18n/tasks';

export interface FilterState {
  search: string;
  myTasksOnly: boolean;
  status: string[];
  priority: string[];
  dateFrom: string;
  dateTo: string;
}

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
}

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as const;
const PRIORITY_OPTIONS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

export default function FilterSheet({open, onClose, filters, onApplyFilters}: FilterSheetProps) {
  const t = useTranslations('tasks');
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, open]);

  const handleStatusChange = (status: string, checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      status: checked ? [...prev.status, status] : prev.status.filter((value) => value !== status)
    }));
  };

  const handlePriorityChange = (priority: string, checked: boolean) => {
    setLocalFilters((prev) => ({
      ...prev,
      priority: checked ? [...prev.priority, priority] : prev.priority.filter((value) => value !== priority)
    }));
  };

  const applyAndClose = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  return (
    <SideSheet open={open} title={t('filter.title')} onClose={onClose}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('table.status')}</h3>
          <div className="flex flex-col gap-2">
            {STATUS_OPTIONS.map((status) => (
              <label key={status} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={localFilters.status.includes(status)}
                  onChange={(event) => handleStatusChange(status, event.target.checked)}
                  className="rounded border-[var(--border-default)] text-orange-500 focus:ring-orange-500 accent-orange-500"
                />
                {translateTaskStatus(t, status)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('table.priority')}</h3>
          <div className="flex flex-col gap-2">
            {PRIORITY_OPTIONS.map((priority) => (
              <label key={priority} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={localFilters.priority.includes(priority)}
                  onChange={(event) => handlePriorityChange(priority, event.target.checked)}
                  className="rounded border-[var(--border-default)] text-orange-500 focus:ring-orange-500 accent-orange-500"
                />
                {translateTaskPriority(t, priority)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('table.dueDate')}</h3>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">{t('filter.dateFrom')}</label>
              <input
                type="date"
                value={localFilters.dateFrom}
                onChange={(event) => setLocalFilters((prev) => ({...prev, dateFrom: event.target.value}))}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">{t('filter.dateTo')}</label>
              <input
                type="date"
                value={localFilters.dateTo}
                onChange={(event) => setLocalFilters((prev) => ({...prev, dateTo: event.target.value}))}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setLocalFilters({search: localFilters.search, myTasksOnly: localFilters.myTasksOnly, status: [], priority: [], dateFrom: '', dateTo: ''})}
            className="flex-1 rounded-md border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            {t('filter.clear')}
          </button>
          <button
            onClick={applyAndClose}
            className="flex-1 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            {t('filter.apply')}
          </button>
        </div>
      </div>
    </SideSheet>
  );
}
