// ── Status / Priority / TaskType konstansok (DRY) ──────────────────────
export const STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800/50 dark:text-zinc-300',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
  IN_REVIEW: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
  BLOCKED: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
};

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Alacsony',
  MEDIUM: 'Közepes',
  HIGH: 'Magas',
  URGENT: 'Sürgős',
  NORMAL: 'Közepes',
};

export const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  URGENT: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  NORMAL: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300',
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export const TASK_TYPES = ['STORY', 'TASK', 'BUG', 'EPIC', 'SUBTASK'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  STORY: 'Story',
  TASK: 'Task',
  BUG: 'Bug',
  EPIC: 'Epic',
  SUBTASK: 'Subtask',
};

// ── Interfaces ─────────────────────────────────────────────────────────

export interface TaskCategory {
  task_category_id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;                    // UUID vagy titkosított
  issue_key: string;             // KÖTELEZŐ
  summary: string;               // KÖTELEZŐ
  description: string | null;
  task_type: string;             // STORY, TASK, BUG, EPIC, SUBTASK
  status: string;                // TODO, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED
  priority: string;
  parent_task_id: string | null;
  subtasks_total: number;
  subtasks_completed: number;
  created_at: string;            // ISO-8601
  updated_at: string;            // ISO-8601
  // ── Modify-által beállítható mezők (nem minden endpoint adja vissza) ──
  due_at?: string | null;        // ISO-8601 – Határidő
  started_at?: string | null;    // ISO-8601 – Munka kezdés ideje
  completed_at?: string | null;  // ISO-8601 – Befejezés ideje
  story_points?: number | null;  // Erőforrás igény / Story pont
  is_archived?: boolean;         // Archiválva?
  assignee_id?: string | null;   // Felelős user ID
  reporter_id?: string | null;   // Jelentő user ID
  task_group_id?: string | null; // Task csoport ID
  categories?: TaskCategory[];
}

export interface TaskComment {
  task_comment_id: string;
  text: string;
  created_at: string;
  creator_name?: string;
}

export interface TaskPanelResponse {
  tasks: Task[];
  current_page: number;
  total_pages: number;
  total_tasks: number;
}

export interface TimelineItem {
  id: string;
  title: string;
  start: string;
  end?: string;
}

export interface TaskHistoryItem {
  id: string;
  task_id: string;
  user_id?: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  created_at: string;
}

export interface GroupUser {
  user_id: string;
  full_name: string;
  email: string;
  username: string;
}
