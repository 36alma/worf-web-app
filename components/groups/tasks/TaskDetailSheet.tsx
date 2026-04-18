import {useState, useEffect} from 'react';
import SideSheet from '@/components/ui/SideSheet';
import {Task, TaskHistoryItem} from './types';
import TaskComments from './TaskComments';
import {Calendar, AlignLeft, History, FileText, ArrowRight} from 'lucide-react';
import clsx from 'clsx';
import {modifyTask, getTaskHistory} from '@/lib/api/tasks';
import toast from 'react-hot-toast';
import * as Tabs from '@radix-ui/react-tabs';

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
  }, [open, task?.task_id]);

  useEffect(() => {
    if (activeTab === 'history' && task && permissions.task.read) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
          const res = await getTaskHistory({
            group_id: groupId,
            task_id: task.task_id,
            limit: 50
          });
          const fetchedItems = res.data?.data || res.data || [];
          setHistoryItems(fetchedItems);
        } catch {
          toast.error("Nem sikerült betölteni az előzményeket");
        } finally {
          setHistoryLoading(false);
        }
      };
      
      fetchHistory();
    }
  }, [activeTab, task, groupId, permissions.task.read]);

  if (!task) return null;

  const canEdit = permissions.task.modify;

  const handleUpdate = async (field: string, value: string) => {
    if (!canEdit) return;
    if (task[field as keyof Task] === value) return; // No change

    // Optimistic UI Update
    const updatedTask = {...task, [field]: value};
    if (onUpdateTask) onUpdateTask(updatedTask);

    try {
      await modifyTask({
        group_id: groupId, // decodeURIComponent happens in parent or apiClient, we pass it down identically
        task_id: task.task_id,
        [field]: value
      });
      // Silent success since it's inline-editing
    } catch {
      toast.error('Hiba a szerkesztés során');
    }
  };

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
      'DELETED': 'Törölve'
    };
    return actions[type] || type;
  };

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

        <Tabs.Content value="details" className="flex flex-col gap-8 pb-20 outline-none">
          <div>
            {/* Parent Task Label */}
            {task.parent_task_id && (
              <div className="mb-2 inline-flex border border-[var(--border-default)] items-center px-2 py-1 bg-[var(--bg-elevated)] rounded text-xs px-2 font-semibold text-[var(--text-tertiary)]">
                Szülő feladat: {task.parent_task_id}
              </div>
            )}
            
            {/* Summary */}
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

            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5 font-medium bg-[var(--bg-elevated)] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 relative transition-all">
                Állapot: 
                {canEdit ? (
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdate('status', e.target.value)}
                    className="bg-transparent text-[var(--text-primary)] outline-none border-none cursor-pointer appearance-none font-semibold pl-1"
                  >
                    <option value="TODO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="DONE">Done</option>
                  </select>
                ) : (
                  <span className="text-[var(--text-primary)] font-semibold pl-1">{
                    task.status === 'TODO' ? 'To Do' :
                    task.status === 'IN_PROGRESS' ? 'In Progress' :
                    task.status === 'DONE' ? 'Done' : task.status
                  }</span>
                )}
              </span>

              <span className="flex items-center gap-1.5 font-medium bg-[var(--bg-elevated)] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500 relative transition-all">
                Prioritás: 
                {canEdit ? (
                  <select
                    value={task.priority || 'MEDIUM'}
                    onChange={(e) => handleUpdate('priority', e.target.value)}
                    className={clsx(
                      "bg-transparent outline-none border-none cursor-pointer appearance-none font-bold pl-1",
                      task.priority === 'HIGH' ? 'text-red-500' :
                      task.priority === 'MEDIUM' ? 'text-yellow-500' :
                      'text-blue-500'
                    )}
                  >
                    <option value="LOW" className="text-[var(--text-primary)]">Alacsony</option>
                    <option value="MEDIUM" className="text-[var(--text-primary)]">Közepes</option>
                    <option value="HIGH" className="text-[var(--text-primary)]">Magas</option>
                  </select>
                ) : (
                  <span className={clsx("font-bold pl-1", 
                    task.priority === 'HIGH' ? 'text-red-500' :
                    task.priority === 'MEDIUM' ? 'text-yellow-500' :
                    'text-blue-500'
                  )}>
                    {task.priority === 'HIGH' ? 'Magas' :
                     task.priority === 'MEDIUM' ? 'Közepes' :
                     task.priority === 'LOW' ? 'Alacsony' : task.priority}
                  </span>
                )}
              </span>

              {task.due_at && (
                <span className="flex items-center gap-1.5 font-medium bg-[var(--bg-elevated)] px-3 py-1.5 rounded-md border border-[var(--border-subtle)] opacity-80">
                  <Calendar size={14} />
                  {new Date(task.due_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

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
            taskId={task.task_id} 
            permissions={permissions.comment} 
          />
        </Tabs.Content>

        <Tabs.Content value="history" className="flex flex-col gap-4 pb-20 outline-none">
           {historyLoading ? (
             <div className="flex items-center justify-center p-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--border-default)] border-t-indigo-600" />
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
