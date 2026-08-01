import {useState, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import SideSheet from '@/components/ui/SideSheet';
import Button from '@/components/ui/Button';
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

const checkboxCls = 'size-4 shrink-0 rounded border border-border accent-[var(--accent)]';
const rowCls =
  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm text-fg-secondary transition-colors hover:bg-surface-hover';
const dateInputCls =
  'min-h-[44px] w-full rounded-md border border-border bg-surface-input px-3 py-3 text-fg focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';

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
          <h3 className="text-section text-fg">{t('table.status')}</h3>
          <div className="flex flex-col gap-1">
            {STATUS_OPTIONS.map((status) => (
              <label key={status} className={rowCls}>
                <input
                  type="checkbox"
                  checked={localFilters.status.includes(status)}
                  onChange={(event) => handleStatusChange(status, event.target.checked)}
                  className={checkboxCls}
                />
                {translateTaskStatus(t, status)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-section text-fg">{t('table.priority')}</h3>
          <div className="flex flex-col gap-1">
            {PRIORITY_OPTIONS.map((priority) => (
              <label key={priority} className={rowCls}>
                <input
                  type="checkbox"
                  checked={localFilters.priority.includes(priority)}
                  onChange={(event) => handlePriorityChange(priority, event.target.checked)}
                  className={checkboxCls}
                />
                {translateTaskPriority(t, priority)}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-section text-fg">{t('table.dueDate')}</h3>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-caption text-fg-muted">{t('filter.dateFrom')}</label>
              <input
                type="date"
                value={localFilters.dateFrom}
                onChange={(event) => setLocalFilters((prev) => ({...prev, dateFrom: event.target.value}))}
                style={{fontSize: '16px'}}
                className={dateInputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-caption text-fg-muted">{t('filter.dateTo')}</label>
              <input
                type="date"
                value={localFilters.dateTo}
                onChange={(event) => setLocalFilters((prev) => ({...prev, dateTo: event.target.value}))}
                style={{fontSize: '16px'}}
                className={dateInputCls}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => setLocalFilters({search: localFilters.search, myTasksOnly: localFilters.myTasksOnly, status: [], priority: [], dateFrom: '', dateTo: ''})}
          >
            {t('filter.clear')}
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={applyAndClose}>
            {t('filter.apply')}
          </Button>
        </div>
      </div>
    </SideSheet>
  );
}
