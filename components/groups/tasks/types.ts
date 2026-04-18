export interface TaskCategory {
  task_category_id: string;
  name: string;
  color: string;
}

export interface Task {
  task_id: string;
  issue_key?: string;
  summary: string;
  description?: string;
  task_type?: string;
  status: string;
  priority?: string;
  parent_task_id?: string;
  subtasks_total?: number;
  subtasks_completed?: number;
  due_at?: string;
  started_at?: string;
  created_at?: string;
  updated_at?: string;
  assignee_id?: string;
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
