import {useState, useEffect} from 'react';
import SideSheet from '@/components/ui/SideSheet';

export interface FilterState {
  search: string;
  myTasksOnly: boolean;
  status: string[]; // TODO, IN_PROGRESS, DONE
  priority: string[]; // HIGH, MEDIUM, LOW
  dateFrom: string;
  dateTo: string;
}

export interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: FilterState;
  onApplyFilters: (newFilters: FilterState) => void;
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' }
];

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'Magas' },
  { value: 'MEDIUM', label: 'Közepes' },
  { value: 'LOW', label: 'Alacsony' }
];

export default function FilterSheet({open, onClose, filters, onApplyFilters}: FilterSheetProps) {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  // Sync when prop changes
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters, open]);

  const handleStatusChange = (status: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      status: checked 
        ? [...prev.status, status]
        : prev.status.filter(s => s !== status)
    }));
  };

  const handlePriorityChange = (priority: string, checked: boolean) => {
    setLocalFilters(prev => ({
      ...prev,
      priority: checked 
        ? [...prev.priority, priority]
        : prev.priority.filter(p => p !== priority)
    }));
  };

  const applyAndClose = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  return (
    <SideSheet open={open} title="Szűrők" onClose={onClose}>
      <div className="flex flex-col gap-6">
        
        {/* Status Filters */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Státusz</h3>
          <div className="flex flex-col gap-2">
            {STATUS_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                <input 
                  type="checkbox"
                  checked={localFilters.status.includes(opt.value)}
                  onChange={(e) => handleStatusChange(opt.value, e.target.checked)}
                  className="rounded border-[var(--border-default)] text-indigo-600 focus:ring-indigo-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Priority Filters */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Prioritás</h3>
          <div className="flex flex-col gap-2">
            {PRIORITY_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-[var(--text-secondary)]">
                <input 
                  type="checkbox"
                  checked={localFilters.priority.includes(opt.value)}
                  onChange={(e) => handlePriorityChange(opt.value, e.target.checked)}
                  className="rounded border-[var(--border-default)] text-indigo-600 focus:ring-indigo-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* Custom Data Range */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Határidő</h3>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Ettől</label>
              <input 
                type="date"
                value={localFilters.dateFrom}
                onChange={e => setLocalFilters(prev => ({...prev, dateFrom: e.target.value}))}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-tertiary)]">Eddig</label>
              <input 
                type="date"
                value={localFilters.dateTo}
                onChange={e => setLocalFilters(prev => ({...prev, dateTo: e.target.value}))}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => setLocalFilters({search: localFilters.search, myTasksOnly: localFilters.myTasksOnly, status: [], priority: [], dateFrom: '', dateTo: ''})}
            className="flex-1 rounded-md border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            Visszaállítás
          </button>
          <button
            onClick={applyAndClose}
            className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            Alkalmazás
          </button>
        </div>

      </div>
    </SideSheet>
  );
}
