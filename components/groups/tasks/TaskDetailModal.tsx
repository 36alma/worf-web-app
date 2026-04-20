'use client';

import {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  X, Calendar, AlignLeft, History, FileText, ArrowRight,
  Bug, BookOpen, Zap, Layers, CheckSquare, Clock, CalendarCheck,
  Hash, Archive, User, Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import {Task, TaskHistoryItem, GroupUser, STATUSES, STATUS_LABELS, TASK_TYPES, TASK_TYPE_LABELS, PRIORITIES, PRIORITY_LABELS} from './types';
import AssigneeCombobox from './AssigneeCombobox';
import TaskComments from './TaskComments';
import TaskTypeBadge from './TaskTypeBadge';
import {modifyTask, getTaskHistory} from '@/lib/api/tasks';
import toast from 'react-hot-toast';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';

// ── Task type icon map ──
const TASK_TYPE_ICONS: Record<string, React.ReactNode> = {
  BUG: <Bug size={14} className="text-red-500" />,
  STORY: <BookOpen size={14} className="text-blue-500" />,
  EPIC: <Zap size={14} className="text-purple-500" />,
  SUBTASK: <Layers size={14} className="text-teal-500" />,
  TASK: <CheckSquare size={14} className="text-orange-500" />,
};

// ── Props ──
export interface TaskDetailModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  groupId: string;
  permissions: {
    task: { read: boolean; create: boolean; modify: boolean; delete: boolean; };
    comment: { read: boolean; create: boolean; modify: boolean; delete: boolean; };
  };
  onUpdateTask?: (task: Task) => void;
  /** Cached list of group users for assignee combobox */
  groupUsers?: GroupUser[];
  groupUsersLoading?: boolean;
}

export default function TaskDetailModal({
  open, onClose, task, groupId, permissions, onUpdateTask,
  groupUsers = [], groupUsersLoading = false,
}: TaskDetailModalProps) {
  const [summary, setSummary] = useState(task?.summary || '');
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [description, setDescription] = useState(task?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [historyItems, setHistoryItems] = useState<TaskHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  const swipeStartY = useRef(0);

  useEffect(() => {
    if (task) {
      setSummary(task.summary);
      setDescription(task.description || '');
    }
  }, [task]);

  const currentAssigneeId = useMemo(() => {
    if (!task?.assigneer_id?.assigneer_email) return null;
    return groupUsers.find(u => u.email === task.assigneer_id!.assigneer_email)?.user_id || null;
  }, [task?.assigneer_id?.assigneer_email, groupUsers]);

  const currentReporterId = useMemo(() => {
    if (!task?.reporter_id?.reporter_email) return null;
    return groupUsers.find(u => u.email === task.reporter_id!.reporter_email)?.user_id || null;
  }, [task?.reporter_id?.reporter_email, groupUsers]);

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
          const res = await getTaskHistory({group_id: groupId, task_id: task.id, limit: 50});
          const fetchedItems = res.data?.data || res.data || [];
          setHistoryItems(Array.isArray(fetchedItems) ? fetchedItems : []);
        } catch {
          toast.error('Nem sikerült betölteni az előzményeket');
        } finally {
          setHistoryLoading(false);
        }
      };
      fetchHistory();
    }
  }, [activeTab, task, groupId, permissions.task.read]);

  const canEdit = permissions.task.modify;

  // ── Generic inline-save handler ──
  const handleUpdate = useCallback(async (field: string, value: unknown) => {
    if (!task || !canEdit) return;
    
    let currentVal: unknown = task[field as keyof Task];
    if (field === 'assignee_id') currentVal = currentAssigneeId;
    if (field === 'reporter_id') currentVal = currentReporterId;

    if (currentVal === value) return;

    const updatedTask = {...task, [field]: value};
    
    if (field === 'assignee_id') {
      const u = groupUsers.find(x => x.user_id === value);
      updatedTask.assigneer_id = u ? { assigneer_email: u.email, assigneer_fullname: u.full_name || u.username } as any : null;
    }
    if (field === 'reporter_id') {
      const u = groupUsers.find(x => x.user_id === value);
      updatedTask.reporter_id = u ? { reporter_email: u.email, reporter_fullname: u.full_name || u.username } as any : null;
    }

    if (onUpdateTask) onUpdateTask(updatedTask);

    try {
      await modifyTask({group_id: groupId, task_id: task.id, [field]: value});
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 422) toast.error('Hibás érték (422)');
      else if (status === 429) toast.error('Túl sok kérés (429)');
      else toast.error('Hiba a szerkesztés során');
    }
  }, [task, canEdit, groupId, onUpdateTask]);

  const handleDateUpdate = useCallback((field: string, rawValue: string) => {
    if (!canEdit) return;
    const isoValue = rawValue ? new Date(rawValue).toISOString() : null;
    handleUpdate(field, isoValue);
  }, [canEdit, handleUpdate]);

  const handleNumberUpdate = useCallback((field: string, rawValue: string) => {
    if (!canEdit) return;
    const numValue = rawValue !== '' ? parseInt(rawValue, 10) : null;
    if (numValue !== null && isNaN(numValue)) return;
    handleUpdate(field, numValue);
  }, [canEdit, handleUpdate]);

  if (!task) return null;

  const handleDragHandleTouchStart = (e: React.TouchEvent) => {
    swipeStartY.current = e.touches[0].clientY;
  };
  const handleDragHandleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0].clientY - swipeStartY.current > 80) onClose();
  };

  const submitSummary = () => {
    if (!summary.trim()) {
      setSummary(task.summary);
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
      'DELETED': 'Törölve',
    };
    return actions[type] || type;
  };

  const subtasksTotal = task.subtasks_total ?? 0;
  const subtasksCompleted = task.subtasks_completed ?? 0;
  const subtaskPercent = subtasksTotal > 0 ? Math.min(100, (subtasksCompleted / subtasksTotal) * 100) : 0;

  const toLocalDatetime = (iso?: string | null) => {
    if (!iso) return '';
    try { return new Date(iso).toISOString().slice(0, 16); }
    catch { return ''; }
  };

  // ── Priority color helper ──
  const priorityColorCls = (p: string | undefined | null) =>
    p === 'HIGH' || p === 'URGENT' ? 'text-red-500' :
    p === 'MEDIUM' ? 'text-amber-500' : 'text-blue-500';

  // ── Style helpers ──
  const labelCls = 'text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1';
  const fieldCardCls = 'flex flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5 transition-all';
  const inlineDateCls = 'bg-transparent text-[var(--text-primary)] outline-none border-none cursor-pointer font-medium text-sm w-full';
  const inlineNumberCls = 'bg-transparent text-[var(--text-primary)] outline-none border-none font-semibold text-sm w-full';

  // Inline select trigger style (borderless, transparent)
  const inlineSelectTriggerCls = 'h-auto border-none bg-transparent px-0 py-0 text-sm font-semibold shadow-none ring-0 focus:ring-0 focus:border-none';

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[3px] animate-in fade-in-0 duration-200" />

        {/* Bottom sheet mobilon, centered modal md+-on */}
        <Dialog.Content className={[
          // Mobil: bottom sheet
          'fixed inset-x-0 bottom-0 z-50 flex flex-col',
          'max-h-[92dvh] bg-[var(--bg-elevated)]',
          'rounded-t-2xl border border-[var(--border-subtle)] shadow-2xl',
          'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom',
          'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
          'duration-300',
          // md+: centered modal
          'md:inset-0 md:m-auto md:bottom-auto md:left-1/2 md:top-1/2',
          'md:-translate-x-1/2 md:-translate-y-1/2',
          'md:rounded-2xl md:max-w-[920px] md:w-[min(96vw,920px)]',
          'md:max-h-[min(90vh,760px)] md:h-auto',
          'md:data-[state=open]:slide-in-from-bottom-2 md:data-[state=open]:zoom-in-95',
        ].join(' ')}>

          {/* Drag handle – csak mobilon */}
          <div
            ref={dragHandleRef}
            onTouchStart={handleDragHandleTouchStart}
            onTouchMove={handleDragHandleTouchMove}
            className="flex justify-center pt-3 pb-1 md:hidden shrink-0 cursor-grab"
          >
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>

          {/* ── Header ── */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Dialog.Title className="flex items-center m-0" asChild>
                <div className="flex flex-row items-center gap-3">
                  <TaskTypeBadge task_type={task.task_type} issue_key={task.issue_key} size="lg" />
                  {task.parent_task_id && (
                    <span className="text-[11px] text-[var(--text-tertiary)] font-medium bg-[var(--bg-hover)] px-2 py-1 rounded border border-[var(--border-subtle)] mt-0.5">
                      Szülő: {task.parent_task_id}
                    </span>
                  )}
                </div>
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* ── Tabs ── */}
          <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <Tabs.List className="flex border-b border-[var(--border-subtle)] px-6 shrink-0">
              <Tabs.Trigger
                value="details"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all border-b-2 outline-none -mb-px',
                  activeTab === 'details'
                    ? 'border-orange-500 text-orange-500'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-t-lg'
                )}
              >
                <FileText size={15} /> Részletek
              </Tabs.Trigger>
              <Tabs.Trigger
                value="history"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all border-b-2 outline-none -mb-px',
                  activeTab === 'history'
                    ? 'border-orange-500 text-orange-500'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-t-lg'
                )}
              >
                <History size={15} /> Aktivitás napló
              </Tabs.Trigger>
            </Tabs.List>

            {/* ── Details Tab ── */}
            <Tabs.Content value="details" className="flex min-h-0 flex-1 flex-col outline-none">
            {/* Görgethető tartalom + safe-area */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pr-5 pb-[max(20px,env(safe-area-inset-bottom))]">
              <div className="flex flex-col gap-5">

            {/* ── Summary (Inline Edit) ── */}
            <div>
              {isEditingSummary ? (
                <input
                  autoFocus
                  style={{fontSize: '16px'}}
                  className="w-full text-xl font-bold bg-[var(--bg-primary)] text-[var(--text-primary)] border border-orange-500 rounded-lg px-3 py-2 outline-none ring-2 ring-orange-500/20"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  onBlur={submitSummary}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitSummary();
                    if (e.key === 'Escape') { setSummary(task.summary); setIsEditingSummary(false); }
                  }}
                />
              ) : (
                <h2
                  onClick={() => canEdit && setIsEditingSummary(true)}
                  className={clsx(
                    'text-xl font-bold text-[var(--text-primary)] rounded-lg px-3 py-2 -mx-3 transition-all',
                    canEdit && 'cursor-text hover:bg-[var(--bg-hover)] border border-transparent hover:border-[var(--border-subtle)]'
                  )}
                >
                  {task.summary}
                </h2>
              )}
            </div>

            {/* ── Main Fields Grid – 1 col mobilon, 2 col sm+ ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {/* Task Type */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Típus</span>
                    <div className="flex items-center gap-2">
                      {TASK_TYPE_ICONS[task.task_type] || null}
                      {canEdit ? (
                        <Select value={task.task_type} onValueChange={(val) => handleUpdate('task_type', val)}>
                          <SelectTrigger className={inlineSelectTriggerCls}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_TYPES.map(tt => (
                              <SelectItem key={tt} value={tt}>{TASK_TYPE_LABELS[tt]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="font-semibold text-sm text-[var(--text-primary)]">
                          {TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS] || task.task_type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Állapot</span>
                    {canEdit ? (
                      <Select value={task.status} onValueChange={(val) => handleUpdate('status', val)}>
                        <SelectTrigger className={inlineSelectTriggerCls}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="font-semibold text-sm text-[var(--text-primary)]">
                        {STATUS_LABELS[task.status as keyof typeof STATUS_LABELS] || task.status}
                      </span>
                    )}
                  </div>

                  {/* Priority */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Prioritás</span>
                    {canEdit ? (
                      <Select value={task.priority || 'MEDIUM'} onValueChange={(val) => handleUpdate('priority', val)}>
                        <SelectTrigger className={clsx(inlineSelectTriggerCls, priorityColorCls(task.priority))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(p => (
                            <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={clsx('font-semibold text-sm', priorityColorCls(task.priority))}>
                        {PRIORITY_LABELS[task.priority] || task.priority}
                      </span>
                    )}
                  </div>

                  {/* Story Points */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Story Points</span>
                    {canEdit ? (
                      <input
                        type="number" min="0"
                        defaultValue={task.story_points ?? ''}
                        onBlur={(e) => handleNumberUpdate('story_points', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className={inlineNumberCls}
                        placeholder="—"
                      />
                    ) : (
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{task.story_points ?? '—'}</span>
                    )}
                  </div>
                </div>

            {/* ── Reporters and Assignees – 1 col mobilon, 2 col sm+ ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* ── Assignee (Combobox) ── */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Felelős</span>
                    <AssigneeCombobox
                      users={groupUsers}
                      value={currentAssigneeId}
                      onChange={(userId) => handleUpdate('assignee_id', userId)}
                      disabled={!canEdit}
                      loading={groupUsersLoading}
                      placeholder={task.assigneer_id?.assigneer_fullname || "Nincs hozzárendelve"}
                    />
                  </div>

                  {/* ── Reporter (Combobox) ── */}
                  <div className={fieldCardCls}>
                    <span className={labelCls}>Bejelentő</span>
                    <AssigneeCombobox
                      users={groupUsers}
                      value={currentReporterId}
                      onChange={(userId) => handleUpdate('reporter_id', userId)}
                      disabled={!canEdit}
                      loading={groupUsersLoading}
                      placeholder={task.reporter_id?.reporter_fullname || "Ismeretlen"}
                    />
                  </div>
                </div>

            {/* ── Dates Grid – 1 col mobilon, 3 col sm+ ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Started At */}
                  <div className={fieldCardCls}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock size={12} className="text-blue-500" />
                      <span className={labelCls + ' !mb-0'}>Elkezdve</span>
                    </div>
                    {canEdit ? (
                      <input type="datetime-local" defaultValue={toLocalDatetime(task.started_at)}
                        onBlur={(e) => handleDateUpdate('started_at', e.target.value)}
                        style={{fontSize: '16px'}}
                        className={inlineDateCls} />
                    ) : (
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {task.started_at ? new Date(task.started_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                      </span>
                    )}
                  </div>

                  {/* Due At */}
                  <div className={fieldCardCls}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar size={12} className="text-amber-500" />
                      <span className={labelCls + ' !mb-0'}>Határidő</span>
                    </div>
                    {canEdit ? (
                      <input type="datetime-local" defaultValue={toLocalDatetime(task.due_at)}
                        onBlur={(e) => handleDateUpdate('due_at', e.target.value)}
                        style={{fontSize: '16px'}}
                        className={inlineDateCls} />
                    ) : (
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {task.due_at ? new Date(task.due_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                      </span>
                    )}
                  </div>

                  {/* Completed At */}
                  <div className={fieldCardCls}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <CalendarCheck size={12} className="text-emerald-500" />
                      <span className={labelCls + ' !mb-0'}>Befejezve</span>
                    </div>
                    {canEdit ? (
                      <input type="datetime-local" defaultValue={toLocalDatetime(task.completed_at)}
                        onBlur={(e) => handleDateUpdate('completed_at', e.target.value)}
                        style={{fontSize: '16px'}}
                        className={inlineDateCls} />
                    ) : (
                      <span className="font-medium text-sm text-[var(--text-primary)]">
                        {task.completed_at ? new Date(task.completed_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—'}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Archive Toggle ── */}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleUpdate('is_archived', !task.is_archived)}
                    className={clsx(
                      fieldCardCls,
                      'flex-row items-center gap-2 cursor-pointer select-none hover:bg-[var(--bg-hover)]',
                      task.is_archived && 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                    )}
                  >
                    <Archive size={14} className={task.is_archived ? 'text-amber-600' : 'text-[var(--text-tertiary)]'} />
                    <span className={clsx('font-semibold text-sm', task.is_archived ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--text-primary)]')}>
                      {task.is_archived ? 'Archiválva ✓' : 'Archiválás'}
                    </span>
                  </button>
                )}

                {/* ── Subtask Progress ── */}
                {subtasksTotal > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                      Alfeladatok ({subtasksCompleted}/{subtasksTotal})
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-full overflow-hidden">
                        <div
                          className={clsx('h-full transition-all duration-500 ease-out rounded-full',
                            subtasksCompleted === subtasksTotal ? 'bg-emerald-500' : 'bg-orange-500'
                          )}
                          style={{width: `${subtaskPercent}%`}}
                        />
                      </div>
                      <span className="text-sm font-bold text-[var(--text-secondary)] tabular-nums">{Math.round(subtaskPercent)}%</span>
                    </div>
                  </div>
                )}

                {/* ── Categories ── */}
                {task.categories && task.categories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Címkék</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {task.categories.map((c) => (
                        <span key={c.task_category_id}
                          style={{backgroundColor: c.color + '15', color: c.color, borderColor: c.color + '30'}}
                          className="px-2.5 py-1 text-[11px] uppercase font-bold rounded-full border"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Description ── */}
                <div>
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
                    <AlignLeft size={14} /> Leírás
                  </h3>
                  {isEditingDesc ? (
                    <div className="flex flex-col gap-2.5">
                      <textarea
                        autoFocus
                        className="w-full min-h-[120px] rounded-lg border border-orange-500 ring-2 ring-orange-500/20 bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none resize-y"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setDescription(task.description || ''); setIsEditingDesc(false); }}
                          className="px-3 py-1.5 text-sm font-medium border border-[var(--border-subtle)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          Mégse
                        </button>
                        <button type="button" onClick={submitDescription}
                          className="px-4 py-1.5 text-sm font-semibold bg-orange-500 rounded-lg text-white hover:bg-orange-600 transition-colors"
                        >
                          Mentés
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => canEdit && setIsEditingDesc(true)}
                      className={clsx(
                        'rounded-lg border border-transparent p-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap min-h-[60px] transition-all',
                        canEdit ? 'cursor-text hover:bg-[var(--bg-hover)] hover:border-[var(--border-subtle)]' : ''
                      )}
                    >
                      {task.description ? (
                        task.description
                      ) : (
                        <span className="text-[var(--text-tertiary)] italic">
                          {canEdit ? 'Kattints ide a leírás hozzáadásához...' : 'Nincs megadva leírás.'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Separator ── */}
                <div className="h-px w-full bg-[var(--border-subtle)]" />

                {/* ── Comments ── */}
                <TaskComments
                  groupId={groupId}
                  taskId={task.id}
                  permissions={permissions.comment}
                />
              </div>
              </div>
            </Tabs.Content>

            {/* ── History Tab ── */}
            <Tabs.Content value="history" className="flex min-h-0 flex-1 flex-col outline-none">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pr-5">
              {historyLoading ? (
                <div className="relative border-l-2 border-[var(--border-subtle)] ml-4 py-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="mb-8 ml-6 relative animate-pulse">
                      <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-[var(--border-default)] border-4 border-[var(--bg-elevated)]" />
                      <div className="flex flex-col gap-2 border border-[var(--border-subtle)] p-3 rounded-lg bg-[var(--bg-primary)]">
                        <div className="flex justify-between">
                          <div className="h-4 w-28 rounded bg-[var(--bg-hover)]" />
                          <div className="h-4 w-32 rounded bg-[var(--bg-hover)]" />
                        </div>
                        <div className="h-8 w-full rounded bg-[var(--bg-hover)]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="flex flex-col h-full w-full items-center justify-center pt-16 text-[var(--text-tertiary)] font-medium">
                  <History size={48} className="mb-4 opacity-40" />
                  <p className="text-sm">Nincsenek elérhető előzmények.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-orange-200 dark:border-orange-900 ml-4 py-2">
                  {historyItems.map((item, index) => (
                    <div key={item.id || index} className="mb-6 ml-6 relative group">
                      <div className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-orange-500 border-4 border-[var(--bg-elevated)] group-hover:bg-orange-400 transition-colors" />
                      <div className="flex flex-col gap-1.5 border border-[var(--border-subtle)] p-3 rounded-lg bg-[var(--bg-primary)]">
                        <div className="flex items-center gap-2 justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                            {formatActionType(item.action_type)}
                          </span>
                          <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-md font-medium">
                            {new Date(item.created_at).toLocaleString([], {year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </span>
                        </div>

                        {(item.old_value !== null && item.old_value !== undefined) || (item.new_value !== null && item.new_value !== undefined) ? (
                          <div className="flex items-center gap-3 text-sm mt-1 p-2 bg-[var(--bg-elevated)] rounded-md border border-[var(--border-subtle)]">
                            {item.old_value !== null && item.old_value !== undefined && (
                              <div className="text-[var(--text-secondary)] font-medium line-through decoration-red-500/50 decoration-2 flex-1 break-all text-xs">
                                {item.old_value || <span className="italic text-gray-500">Üres</span>}
                              </div>
                            )}
                            {item.old_value !== null && item.new_value !== null && (
                              <ArrowRight size={12} className="text-[var(--text-tertiary)] flex-shrink-0" />
                            )}
                            {item.new_value !== null && item.new_value !== undefined && (
                              <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex-1 break-all text-xs">
                                {item.new_value || <span className="italic text-gray-500">Üres</span>}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-[var(--text-tertiary)]">Aktivitás naplózva.</div>
                        )}

                        {item.user_id && (
                          <div className="text-[10px] text-[var(--text-tertiary)] font-medium mt-0.5">
                            User: {item.user_id}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
