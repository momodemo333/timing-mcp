// Timing API Types

export interface TimingConfig {
  apiKey: string;
  baseUrl?: string;
  timezone?: string;
}

export interface ProjectRef {
  self: string;
}

export interface Project {
  self: string;
  team_id: string | null;
  title: string;
  title_chain: string[];
  color: string;
  productivity_score: number;
  is_archived: boolean;
  notes: string | null;
  children?: ProjectRef[] | Project[];
  parent: ProjectRef | null;
  default_billing_status: 'not_billable' | 'billable' | null;
  custom_fields: Record<string, string>;
}

export interface TimeEntry {
  self: string;
  start_date: string;
  end_date: string;
  duration: number;
  project: ProjectRef | Project | null;
  title: string | null;
  notes: string | null;
  is_running: boolean;
  creator_id: string;
  creator_name: string;
  billing_status: 'undetermined' | 'not_billable' | 'billable' | 'billed' | 'paid';
  custom_fields: Record<string, string>;
}

export interface Team {
  id: string;
  name: string;
}

export interface TeamMember {
  self: string;
  email: string;
  name: string | null;
}

export interface ReportRow {
  duration: number;
  project?: Project | ProjectRef;
  title?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
  user?: TeamMember;
  billing_status?: string;
}

export interface PaginatedMeta {
  current_page: number;
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export interface PaginatedLinks {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  links?: PaginatedLinks & Record<string, string>;
  meta?: PaginatedMeta;
}

// Request params
export interface StartTimerParams {
  start_date?: string;
  project?: string | string[];
  title?: string;
  notes?: string;
  replace_existing?: boolean;
  billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid';
}

export interface CreateTimeEntryParams {
  start_date: string;
  end_date: string;
  project?: string | string[];
  title?: string;
  notes?: string;
  replace_existing?: boolean;
  billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid';
}

export interface UpdateTimeEntryParams {
  start_date?: string;
  end_date?: string;
  project?: string | string[];
  title?: string;
  notes?: string;
  billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid';
}

export interface ListTimeEntriesParams {
  start_date_min?: string;
  start_date_max?: string;
  projects?: string[];
  include_child_projects?: boolean;
  search_query?: string;
  is_running?: boolean;
  include_project_data?: boolean;
  include_team_members?: boolean;
  team_members?: string[];
  billing_status?: string[];
}

export interface ListProjectsParams {
  title?: string;
  hide_archived?: boolean;
  team_id?: string;
}

export interface CreateProjectParams {
  title: string;
  parent?: string | string[];
  color?: string;
  productivity_score?: number;
  is_archived?: boolean;
  team_id?: string;
  notes?: string;
  default_billing_status?: 'not_billable' | 'billable';
}

export interface UpdateProjectParams {
  title?: string;
  color?: string;
  productivity_score?: number;
  is_archived?: boolean;
  notes?: string;
  default_billing_status?: 'not_billable' | 'billable' | '';
}

export interface ReportParams {
  include_app_usage?: boolean;
  include_team_members?: boolean;
  team_members?: string[];
  start_date_min?: string;
  start_date_max?: string;
  projects?: string[];
  include_child_projects?: boolean;
  search_query?: string;
  billing_status?: string[];
  columns?: ('project' | 'title' | 'notes' | 'timespan' | 'user' | 'billing_status')[];
  project_grouping_level?: number;
  include_project_data?: boolean;
  timespan_grouping_mode?: 'exact' | 'day' | 'week' | 'month' | 'year';
  sort?: string[];
}
