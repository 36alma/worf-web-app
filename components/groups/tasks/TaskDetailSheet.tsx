import {useState, useEffect, useCallback} from 'react';
import SideSheet from '@/components/ui/SideSheet';
import {Task, TaskHistoryItem, STATUSES, STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS} from './types';
import TaskComments from './TaskComments';
import {Calendar, AlignLeft, History, FileText, ArrowRight, Bug, BookOpen, Zap, Layers, CheckSquare, Clock, CalendarCheck, Hash, Archive, User} from 'lucide-react';
import clsx from 'clsx';
import {modifyTask, getTaskHistory} from '@/lib/api/tasks';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';

// Task type ikontérkép
const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  BUG: <Bug size={14} className="text-red-500" />,
  STORY: <BookOpen size={14} className="text-blue-500" />,
  EPIC: <Zap size={14} className="text-purple-500" />,
  SUBTASK: <Layers size={14} className="text-teal-500" />,
  TASK: <CheckSquare size={14} className="text-indigo-500" />,
};

export interface TaskDetailSheetProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  groupId: string;
  permissions: {
    task: {
      read: boolean;
      create: boolean;
      modify: boolean;
      delete: boolean;
    };
    comment: {
      read: boolean;
      create: boolean;
      modify: boolean;
      delete: boolean;
    }
  };
  onUpdateTask?: (task: Task) => void;
}

export default function TaskDetailSheet({open, onClose, task, groupId, permissions, onUpdateTask}: TaskDetailSheetProps) {
  const [summary, setSummary] = useState(task?.summary || '');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  
  const [description, setDescription] = useState(task?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  
  const [activeTab, setActiveTab] = useState('details');
  const [historyItems, setHistoryItems] = useState<TaskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setSummary(task.summary);
      setDescription(task.description || '');
    }
  }, [task]);
  
  // Reset tab on task change or close
  useEffect(() => {
    if (open) {
      setActiveTab('details');
    }
  }, [open, task?.id]);

  useEffect(() => {
    if (activeTab === 'history' && task && permissions.task.read) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          const res = await getTaskHistory({
            group_id: groupId,
            task_id: task.id,
            limit: 50
          });
          const fetchedItems = res.data?.data || res.data || [];
          setHistoryItems(Array.isArray(fetchedItems) ? fetchedItems : []);
        } catch {
          toast.error("Nem sikerült betölteni az előzményeket");
        } finally {
          setHistoryLoading(false);
        }
      };
      
      fetchHistory();
    }
  }, [activeTab, task, groupId, permissions.task.read]);

  const canEdit = permissions.task.modify;

  // ── Generikus inline-save: onBlur / onSelect → azonnal POST /v1/task/modify ──
  const handleUpdate = async (field: string, value: unknown) => {
    if (!task || !canEdit) return;
    const currentVal = task[field as keyof Task];
    if (currentVal === value) return; // No change

    // Optimistic UI Update
    const updatedTask = {...task, [field]: value};
    if (onUpdateTask) onUpdateTask(updatedTask);

    try {
      await modifyTask({
        group_id: groupId,
        task_id: task.id,
        [field]: value
      });
      // Silent success since it's inline-editing
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 422) toast.error('Hibás érték (422)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba a szerkesztés során');
    }
  };

  // ── Dátum inline mentés: datetime-local → ISO-8601 ──
  const handleDateUpdate = useCallback((field: string, rawValue: string) => {
    if (!canEdit) return;
    const isoValue = rawValue ? new Date(rawValue).toISOString() : null;
    handleUpdate(field, isoValue);
  }, [canEdit, task, groupId]);

  // ── Story Points inline mentés ──
  const handleNumberUpdate = useCallback((field: string, rawValue: string) => {
    if (!canEdit) return;
    const numValue = rawValue !== '' ? parseInt(rawValue, 10) : null;
    if (numValue !== null && isNaN(numValue)) return;
    handleUpdate(field, numValue);
  }, [canEdit, task, groupId]);

  if (!task) return null;

  const submitSummary = () => {
    if (!summary.trim()) {
      setSummary(task.summary); // Revert
      setIsEditingSummary(false);
      return;
    }
    handleUpdate('summary', summary);
    setIsEditingSummary(false);
  };

  const submitDescription = () => {
    handleUpdate('description', description);
    setIsEditingDesc(false);
  };

  // Human readable action types
  const formatActionType = (type: string) => {
    const actions: Record<string, string> = {
      'CREATED': 'Létrehozta',
      'STATUS_CHANGED': 'Státusz módosítva',
      'SUMMARY_CHANGED': 'Cím módosítva',
      'DESCRIPTION_CHANGED': 'Leírás módosítva',
      'ASSIGNEE_CHANGED': 'Felelős módosítva',
      'PRIORITY_CHANGED': 'Prioritás módosítva',
      'DUE_DATE_CHANGED': 'Határidő módosítva',
      'TYPE_CHANGED': 'Típus módosítva',
      'STORY_POINTS_CHANGED': 'Story Points módosítva',
      'STARTED_AT_CHANGED': 'Kezdés módosítva',
      'COMPLETED_AT_CHANGED': 'Befejezés módosítva',
      'ARCHIVED': 'Archiválva',
      'DELETED': 'Törölve'
    };
    return actions[type] || type;
  };

  // Subtask progress
  const subtasksTotal = task.subtasks_total ?? 0;
  const subtasksCompleted = task.subtasks_completed ?? 0;
  const subtaskPercent = subtasksTotal > 0 ? Math.min(100, (subtasksCompleted / subtasksTotal) * 100) : 0;

  // Utility to convert ISO string to datetime-local value
  const toLocalDatetime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    } catch { return ''; }
  };

  const metaFieldCls = "flex items-center gap-2 font-medium bg-[var(--bg-elevated)] px-3 py-2 rounded-lg border border-[var(--border-subtle)] transition-all text-sm";
  const inlineSelectCls = "bg-transparent text-[var(--text-primary)] outline-none border-none cursor-pointer appearance-none font-semibold";
  const inlineDateCls = "bg-transparent text-[var(--text-primary)] outline-none border-none cursor-pointer font-semibold text-sm w-[180px]";
  const inlineNumberCls = "bg-transparent text-[var(--text-primary)] outline-none border-none font-bold text-center w-16";

  return (
    <SideSheet open={open} onClose={onClose} title={task.issue_key || 'Feladat Részletei'}>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full w-full">
        <Tabs.List className="flex border-b border-[var(--border-subtle)] mb-6 mt-[-10px]">
           <Tabs.Trigger 
             value="details"
             className={clsx(
               "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all border-b-2 outline-none",
               activeTab === 'details' ? "border-indigo-500 text-indigo-500 dark:text-indigo-400" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
             )}
           >
             <FileText size={16} /> Részletek
           </Tabs.Trigger>
           
           <Tabs.Trigger 
             value="history"
             className={clsx(
               "flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all border-b-2 outline-none",
               activeTab === 'history' ? "border-indigo-500 text-indigo-500 dark:text-indigo-400" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
             )}
           >
             <History size={16} /> Aktivitás
           </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="details" className="flex flex-col gap-6 pb-20 outline-none overflow-y-auto">
          <div>
            {/* Parent Task Label */}
            {task.parent_task_id && (
              <div className="mb-2 inline-flex border border-[var(--border-default)] items-center px-2 py-1 bg-[var(--bg-elevated)] rounded text-xs font-semibold text-[var(--text-tertiary)]">
                Szülő feladat: {task.parent_task_id}
              </div>
            )}
            
            {/* Summary — Inline Editing */}
            {isEditingSummary ? (
              <input
                autoFocus
                className="w-full text-2xl font-bold bg-[var(--bg-input)] text-[var(--text-primary)] border border-indigo-500 rounded-md px-3 py-1.5 outline-none mb-3 shadow-sm"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                onBlur={submitSummary}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitSummary();
                  if (e.key === 'Escape') {
                    setSummary(task.summary);
                    setIsEditingSummary(false);
                  }
                }}
              />
            ) : (
              <h2 
                onClick={() => canEdit && setIsEditingSummary(true)} 
                className={clsx(
                  "text-2xl font-bold text-[var(--text-primary)] border-2 border-transparent rounded-md px-3 py-1.5 -ml-3 mb-3 transition-colors",
                  canEdit && "cursor-text hover:bg-[var(--bg-hover)] hover:border-[var(--border-subtle)]"
                )}
              >
                {task.summary}
              </h2>
            )}

            {/* ── Fő Meta Mezők (dropdowns, inline-edit) ── */}
            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
              {/* Task Type */}
              <span className={metaFieldCls}>
                {TASK_TYPE_ICONS[task.task_type] || null}
                {canEdit ? (
                  <select
                    value={task.task_type}
                    onChange={(e) => handleUpdate('task_type', e.target.value)}
                    className={inlineSelectCls}
                  >
                    {TASK_TYPES.map(tt => (
                      <option key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-semibold text-[var(--text-primary)]">
                    {TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS] || task.task_type}
                  </span>
                )}
              </span>

              {/* Status */}
              <span className={clsx(metaFieldCls, "focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500")}>
                Állapot: 
                {canEdit ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdate('status', e.target.value)}
                    className={inlineSelectCls}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[var(--text-primary)] font-semibold pl-1">
                    {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status}
                  </span>
                )}
              </span>

              {/* Priority */}
              <span className={clsx(metaFieldCls, "focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500")}>
                Prioritás: 
                {canEdit ? (
                  <select
                    value={task.priority || 'MEDIUM'}
                    onChange={(e) => handleUpdate('priority', e.target.value)}
                    className={clsx(
                      inlineSelectCls,
                      task.priority === 'HIGH' || task.priority === 'URGENT' ? 'text-red-500' :
                      task.priority === 'MEDIUM' ? 'text-yellow-500' :
                      'text-blue-500'
                    )}
                  >
                    <option value="LOW">Alacsony</option>
                    <option value="MEDIUM">Közepes</option>
                    <option value="HIGH">Magas</option>
                    <option value="URGENT">Sürgős</option>
                  </select>
                ) : (
                  <span className={clsx("font-bold pl-1", 
                    task.priority === 'HIGH' || task.priority === 'URGENT' ? 'text-red-500' :
                    task.priority === 'MEDIUM' ? 'text-yellow-500' :
                    'text-blue-500'
                  )}>
                    {task.priority === 'HIGH' ? 'Magas' :
                     task.priority === 'MEDIUM' ? 'Közepes' :
                     task.priority === 'LOW' ? 'Alacsony' :
                     task.priority === 'URGENT' ? 'Sürgős' : task.priority}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* ── Dátumok és Értékek (Inline Editing – onBlur submit) ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Started At */}
            <div className={metaFieldCls}>
              <Clock size={14} className="text-blue-500 shrink-0" />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Elkezdve</span>
                {canEdit ? (
                  <input
                    type="datetime-local"
                    defaultValue={toLocalDatetime(task.started_at)}
                    onBlur={(e) => handleDateUpdate('started_at', e.target.value)}
                    className={inlineDateCls}
                  />
                ) : (
                  <span className="text-[var(--text-primary)] font-semibold text-sm">
                    {task.started_at ? new Date(task.started_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                  </span>
                )}
              </div>
            </div>

            {/* Due At */}
            <div className={metaFieldCls}>
              <Calendar size={14} className="text-amber-500 shrink-0" />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Határidő</span>
                {canEdit ? (
                  <input
                    type="datetime-local"
                    defaultValue={toLocalDatetime(task.due_at)}
                    onBlur={(e) => handleDateUpdate('due_at', e.target.value)}
                    className={inlineDateCls}
                  />
                ) : (
                  <span className="text-[var(--text-primary)] font-semibold text-sm">
                    {task.due_at ? new Date(task.due_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                  </span>
                )}
              </div>
            </div>

            {/* Completed At */}
            <div className={metaFieldCls}>
              <CalendarCheck size={14} className="text-emerald-500 shrink-0" />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Befejezve</span>
                {canEdit ? (
                  <input
                    type="datetime-local"
                    defaultValue={toLocalDatetime(task.completed_at)}
                    onBlur={(e) => handleDateUpdate('completed_at', e.target.value)}
                    className={inlineDateCls}
                  />
                ) : (
                  <span className="text-[var(--text-primary)] font-semibold text-sm">
                    {task.completed_at ? new Date(task.completed_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                  </span>
                )}
              </div>
            </div>

            {/* Story Points */}
            <div className={metaFieldCls}>
              <Hash size={14} className="text-indigo-500 shrink-0" />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Story Points</span>
                {canEdit ? (
                  <input
                    type="number"
                    min="0"
                    defaultValue={task.story_points ?? ''}
                    onBlur={(e) => handleNumberUpdate('story_points', e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className={clsx(inlineNumberCls, "text-left w-20")}
                    placeholder="—"
                  />
                ) : (
                  <span className="text-[var(--text-primary)] font-bold text-sm">
                    {task.story_points ?? '—'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Assignee ── */}
          <div className={metaFieldCls}>
            <User size={14} className="text-violet-500 shrink-0" />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold">Felelős</span>
              {canEdit ? (
                <input
                  type="text"
                  defaultValue={task.assignee_id || ''}
                  onBlur={(e) => handleUpdate('assignee_id', e.target.value || null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  className="bg-transparent text-[var(--text-primary)] outline-none border-none font-semibold text-sm"
                  placeholder="Nincs hozzárendelve"
                />
              ) : (
                <span className="text-[var(--text-primary)] font-semibold text-sm">
                  {task.assignee_id || '—'}
                </span>
              )}
            </div>
          </div>

          {/* ── Archív toggle ── */}
          {canEdit && (
            <div className={clsx(metaFieldCls, "cursor-pointer select-none", task.is_archived && "bg-amber-50 border-amber-200 dark:bg-amber-900/20")}
              onClick={() => handleUpdate('is_archived', !task.is_archived)}
            >
              <Archive size={14} className={task.is_archived ? "text-amber-600" : "text-[var(--text-tertiary)]"} />
              <span className={clsx("font-semibold text-sm", task.is_archived ? "text-amber-700" : "text-[var(--text-primary)]")}>
                {task.is_archived ? 'Archiválva ✓' : 'Archiválás'}
              </span>
            </div>
          )}

          {/* Subtask Progress */}
          {subtasksTotal > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-2">Alfeladatok ({subtasksCompleted}/{subtasksTotal})</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-full overflow-hidden">
                  <div 
                    className={clsx(
                      "h-full transition-all duration-500 ease-out rounded-full",
                      subtasksCompleted === subtasksTotal ? "bg-emerald-500" : "bg-indigo-500"
                    )}
                    style={{ width: `${subtaskPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-[var(--text-secondary)] tabular-nums">{Math.round(subtaskPercent)}%</span>
              </div>
            </div>
          )}

          {task.categories && task.categories.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Címkék</h3>
              <div className="flex flex-wrap gap-2">
                {task.categories.map((c) => (
                  <span
                    key={c.task_category_id}
                    style={{backgroundColor: c.color + '20', color: c.color, borderColor: c.color + '40'}}
                    className="px-2.5 py-1 text-xs uppercase font-semibold rounded-full border border-solid"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-[var(--text-primary)] mb-3">
              <AlignLeft size={18} /> Leírás
            </h3>
            
            {isEditingDesc ? (
              <div className="flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
                <textarea
                  autoFocus
                  className="w-full min-h-[140px] rounded-md border-2 border-indigo-500 bg-[var(--bg-input)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none resize-y shadow-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setDescription(task.description || '');
                      setIsEditingDesc(false);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-transparent border border-[var(--border-default)] rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    Mégse
                  </button>
                  <button
                    onClick={submitDescription}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 rounded-md text-white transition-colors hover:bg-indigo-700 shadow-sm"
                  >
                    Mentés
                  </button>
                </div>
              </div>
            ) : (
              <div 
                onClick={() => canEdit && setIsEditingDesc(true)}
                className={clsx(
                  "rounded-md border-2 border-transparent p-4 -ml-4 text-sm text-[var(--text-primary)] whitespace-pre-wrap transition-colors min-h-[80px]",
                  canEdit ? "cursor-text hover:bg-[var(--bg-hover)] hover:border-[var(--border-subtle)]" : ""
                )}
              >
                {task.description ? (
                  task.description
                ) : (
                  <span className="text-[var(--text-tertiary)] italic">
                    {canEdit ? "Kattints ide a leírás hozzáadásához..." : "Nincs megadva leírás."}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Separator before comments */}
          <div className="h-px w-full bg-[var(--border-subtle)]" />

          <TaskComments 
            groupId={groupId} 
            taskId={task.id} 
            permissions={permissions.comment} 
          />
        </Tabs.Content>

        <Tabs.Content value="history" className="flex flex-col gap-4 pb-20 outline-none">
           {historyLoading ? (
             /* Skeleton Loader for History */
             <div className="relative border-l-2 border-[var(--border-subtle)] ml-4 py-2">
               {[1, 2, 3, 4].map((i) => (
                 <div key={i} className="mb-8 ml-6 relative animate-pulse">
                   <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-[var(--border-default)] border-4 border-[var(--bg-surface)]" />
                   <div className="flex flex-col gap-2 border border-[var(--border-subtle)] p-3 rounded-lg bg-[var(--bg-elevated)]">
                     <div className="flex justify-between">
                       <div className="h-4 w-28 rounded bg-[var(--bg-surface)]" />
                       <div className="h-4 w-32 rounded bg-[var(--bg-surface)]" />
                     </div>
                     <div className="h-8 w-full rounded bg-[var(--bg-surface)]" />
                   </div>
                 </div>
               ))}
             </div>
           ) : historyItems.length === 0 ? (
             <div className="flex flex-col h-full w-full items-center justify-center pt-20 text-[var(--text-tertiary)] font-medium">
                <History size={48} className="mb-4 opacity-50" />
                <p>Nincsenek elérhető előzmények.</p>
             </div>
           ) : (
             <div className="relative border-l-2 border-indigo-200 dark:border-indigo-900 ml-4 py-2">
                {historyItems.map((item, index) => (
                  <div key={item.id || index} className="mb-8 ml-6 relative group animate-in fade-in slide-in-from-left-2 p-1">
                    {/* Circle Indicator */}
                    <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-indigo-500 border-4 border-[var(--bg-surface)] dark:border-[#0e0e11] group-hover:bg-indigo-400 transition-colors" />
                    
                    <div className="flex flex-col gap-1.5 border border-[var(--border-subtle)] p-3 rounded-lg shadow-sm bg-[var(--bg-elevated)]">
                      <div className="flex items-center gap-2 mb-1 justify-between">
                         <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                           {formatActionType(item.action_type)}
                         </span>
                         <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-md font-medium border border-[var(--border-subtle)]">
                           {new Date(item.created_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                         </span>
                      </div>
                      
                      {/* Old Value -> New Value Diff */}
                      {(item.old_value !== null && item.old_value !== undefined) || (item.new_value !== null && item.new_value !== undefined) ? (
                         <div className="flex items-center gap-3 text-sm mt-1 mb-1 p-2 bg-[var(--bg-primary)] rounded-md border border-[var(--border-subtle)]">
                            {item.old_value !== null && item.old_value !== undefined && (
                              <div className="text-[var(--text-secondary)] font-medium line-through decoration-red-500/50 decoration-2 flex-1 break-all">
                                {item.old_value || <span className="italic text-gray-500">Üres</span>}
                              </div>
                            )}
                            
                            {item.old_value !== null && item.new_value !== null && (
                               <ArrowRight size={14} className="text-[var(--text-tertiary)] flex-shrink-0" />
                            )}

                            {item.new_value !== null && item.new_value !== undefined && (
                              <div className="text-[var(--text-primary)] font-semibold text-emerald-600 dark:text-emerald-400 flex-1 break-all">
                                {item.new_value || <span className="italic text-gray-500">Üres</span>}
                              </div>
                            )}
                         </div>
                      ) : (
                        <div className="text-sm text-[var(--text-secondary)]">Aktivitás naplózva részletek nélkül.</div>
                      )}
                      
                      {item.user_id && (
                        <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-1">
                          User ID: {item.user_id}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
             </div>
           )}
        </Tabs.Content>
      </Tabs.Root>
    </SideSheet>
  );
}
