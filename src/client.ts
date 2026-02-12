import type {
  TimingConfig,
  Project,
  TimeEntry,
  Team,
  TeamMember,
  ReportRow,
  ApiResponse,
  StartTimerParams,
  CreateTimeEntryParams,
  UpdateTimeEntryParams,
  ListTimeEntriesParams,
  ListProjectsParams,
  CreateProjectParams,
  UpdateProjectParams,
  ReportParams,
} from './types.js';

export class TimingApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'TimingApiError';
  }
}

export class TimingClient {
  private baseUrl: string;
  private apiKey: string;
  private timezone?: string;

  constructor(config: TimingConfig) {
    this.baseUrl = config.baseUrl || 'https://web.timingapp.com/api/v1';
    this.apiKey = config.apiKey;
    this.timezone = config.timezone;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
  ): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          value.forEach((v, i) => url.searchParams.append(`${key}[${i}]`, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.timezone) {
      headers['X-Time-Zone'] = this.timezone;
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      
      if (response.status === 401) {
        throw new TimingApiError('Invalid API key', response.status, errorBody);
      }
      if (response.status === 404) {
        throw new TimingApiError('Resource not found', response.status, errorBody);
      }
      if (response.status === 429) {
        throw new TimingApiError('Rate limit exceeded', response.status, errorBody);
      }
      throw new TimingApiError(
        `API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { data: undefined as T };
    }

    return await response.json();
  }

  // ============ Timer ============

  async startTimer(params: StartTimerParams = {}): Promise<TimeEntry> {
    const res = await this.request<TimeEntry>('POST', '/time-entries/start', params as Record<string, unknown>);
    return res.data;
  }

  async stopTimer(): Promise<TimeEntry> {
    const res = await this.request<TimeEntry>('PUT', '/time-entries/stop');
    return res.data;
  }

  async getRunningTimer(): Promise<TimeEntry | null> {
    try {
      const res = await this.request<TimeEntry>('GET', '/time-entries/running');
      return res.data;
    } catch (e) {
      if (e instanceof TimingApiError && e.status === 404) {
        return null;
      }
      throw e;
    }
  }

  // ============ Time Entries ============

  async listTimeEntries(params: ListTimeEntriesParams = {}): Promise<ApiResponse<TimeEntry[]>> {
    const query: Record<string, unknown> = {
      start_date_min: params.start_date_min,
      start_date_max: params.start_date_max,
      search_query: params.search_query,
      include_child_projects: params.include_child_projects ? '1' : undefined,
      is_running: params.is_running !== undefined ? (params.is_running ? '1' : '0') : undefined,
      include_project_data: params.include_project_data ? '1' : undefined,
      include_team_members: params.include_team_members ? '1' : undefined,
    };

    if (params.projects?.length) {
      query['projects'] = params.projects;
    }
    if (params.team_members?.length) {
      query['team_members'] = params.team_members;
    }
    if (params.billing_status?.length) {
      query['billing_status'] = params.billing_status;
    }

    return this.request<TimeEntry[]>('GET', '/time-entries', undefined, query);
  }

  async getTimeEntry(id: string): Promise<TimeEntry> {
    const entryId = id.startsWith('/time-entries/') ? id.replace('/time-entries/', '') : id;
    const res = await this.request<TimeEntry>('GET', `/time-entries/${entryId}`);
    return res.data;
  }

  async getLatestTimeEntry(): Promise<TimeEntry> {
    const res = await this.request<TimeEntry>('GET', '/time-entries/latest');
    return res.data;
  }

  async createTimeEntry(params: CreateTimeEntryParams): Promise<TimeEntry> {
    const res = await this.request<TimeEntry>('POST', '/time-entries', params as Record<string, unknown>);
    return res.data;
  }

  async updateTimeEntry(id: string, params: UpdateTimeEntryParams): Promise<TimeEntry> {
    const entryId = id.startsWith('/time-entries/') ? id.replace('/time-entries/', '') : id;
    const res = await this.request<TimeEntry>('PUT', `/time-entries/${entryId}`, params as Record<string, unknown>);
    return res.data;
  }

  async deleteTimeEntry(id: string): Promise<void> {
    const entryId = id.startsWith('/time-entries/') ? id.replace('/time-entries/', '') : id;
    await this.request<void>('DELETE', `/time-entries/${entryId}`);
  }

  // ============ Projects ============

  async listProjects(params: ListProjectsParams = {}): Promise<Project[]> {
    const query: Record<string, unknown> = {
      title: params.title,
      hide_archived: params.hide_archived ? '1' : undefined,
      team_id: params.team_id,
    };
    const res = await this.request<Project[]>('GET', '/projects', undefined, query);
    return res.data;
  }

  async getProjectHierarchy(teamId?: string): Promise<Project[]> {
    const query = teamId ? { team_id: teamId } : undefined;
    const res = await this.request<Project[]>('GET', '/projects/hierarchy', undefined, query);
    return res.data;
  }

  async getProject(id: string): Promise<Project> {
    const projectId = id.startsWith('/projects/') ? id.replace('/projects/', '') : id;
    const res = await this.request<Project>('GET', `/projects/${projectId}`);
    return res.data;
  }

  async createProject(params: CreateProjectParams): Promise<Project> {
    const res = await this.request<Project>('POST', '/projects', params as Record<string, unknown>);
    return res.data;
  }

  async updateProject(id: string, params: UpdateProjectParams): Promise<Project> {
    const projectId = id.startsWith('/projects/') ? id.replace('/projects/', '') : id;
    const res = await this.request<Project>('PUT', `/projects/${projectId}`, params as Record<string, unknown>);
    return res.data;
  }

  async deleteProject(id: string): Promise<void> {
    const projectId = id.startsWith('/projects/') ? id.replace('/projects/', '') : id;
    await this.request<void>('DELETE', `/projects/${projectId}`);
  }

  // ============ Reports ============

  async generateReport(params: ReportParams = {}): Promise<ReportRow[]> {
    const query: Record<string, unknown> = {
      include_app_usage: params.include_app_usage ? '1' : '0',
      include_team_members: params.include_team_members ? '1' : '0',
      start_date_min: params.start_date_min,
      start_date_max: params.start_date_max,
      search_query: params.search_query,
      include_child_projects: params.include_child_projects ? '1' : undefined,
      project_grouping_level: params.project_grouping_level,
      include_project_data: params.include_project_data ? '1' : undefined,
      timespan_grouping_mode: params.timespan_grouping_mode,
    };

    if (params.projects?.length) {
      query['projects'] = params.projects;
    }
    if (params.team_members?.length) {
      query['team_members'] = params.team_members;
    }
    if (params.billing_status?.length) {
      query['billing_status'] = params.billing_status;
    }
    if (params.columns?.length) {
      query['columns'] = params.columns;
    }
    if (params.sort?.length) {
      query['sort'] = params.sort;
    }

    const res = await this.request<ReportRow[]>('GET', '/report', undefined, query);
    return res.data;
  }

  // ============ Teams ============

  async listTeams(): Promise<Team[]> {
    const res = await this.request<Team[]>('GET', '/teams');
    return res.data;
  }

  async listTeamMembers(teamId: string): Promise<TeamMember[]> {
    const id = teamId.startsWith('/teams/') ? teamId.replace('/teams/', '') : teamId;
    const res = await this.request<TeamMember[]>('GET', `/teams/${id}/members`);
    return res.data;
  }

  // ============ Activity Hierarchy (Beta) ============

  async getActivityHierarchy(params: {
    start_date: string;
    end_date: string;
    block_size?: 'total' | 'month' | 'week' | 'day' | 'hour' | '15min' | '5min';
    minimum_duration_seconds?: number;
    group_by_project?: boolean;
    max_depth?: number;
    max_lines?: number;
    include_mobile_devices?: boolean;
    project_ids?: string[];
    include_subprojects?: boolean;
  }): Promise<string> {
    const url = new URL(`${this.baseUrl}/activity-hierarchy`);
    
    url.searchParams.append('start_date', params.start_date);
    url.searchParams.append('end_date', params.end_date);
    
    if (params.block_size) {
      url.searchParams.append('block_size', params.block_size);
    }
    if (params.minimum_duration_seconds !== undefined) {
      url.searchParams.append('minimum_duration_seconds', String(params.minimum_duration_seconds));
    }
    if (params.group_by_project !== undefined) {
      url.searchParams.append('group_by_project', params.group_by_project ? 'true' : 'false');
    }
    if (params.max_depth !== undefined) {
      url.searchParams.append('max_depth', String(params.max_depth));
    }
    if (params.max_lines !== undefined) {
      url.searchParams.append('max_lines', String(params.max_lines));
    }
    if (params.include_mobile_devices !== undefined) {
      url.searchParams.append('include_mobile_devices', params.include_mobile_devices ? 'true' : 'false');
    }
    if (params.project_ids && Array.isArray(params.project_ids) && params.project_ids.length) {
      params.project_ids.forEach((id, i) => {
        url.searchParams.append(`project_ids[${i}]`, id);
      });
    }
    if (params.include_subprojects !== undefined) {
      url.searchParams.append('include_subprojects', params.include_subprojects ? 'true' : 'false');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'text/plain',
    };

    if (this.timezone) {
      headers['X-Time-Zone'] = this.timezone;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = 'Unknown error';
      }
      
      if (response.status === 401) {
        throw new TimingApiError('Invalid API key', response.status, errorBody);
      }
      if (response.status === 429) {
        throw new TimingApiError('Rate limit exceeded', response.status, errorBody);
      }
      throw new TimingApiError(
        `API error: ${response.status} ${response.statusText}`,
        response.status,
        errorBody
      );
    }

    return await response.text();
  }
}
