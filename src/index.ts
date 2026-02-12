#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TimingClient, TimingApiError } from './client.js';

// Get API key from environment
const API_KEY = process.env.TIMING_API_KEY;
if (!API_KEY) {
  console.error('Error: TIMING_API_KEY environment variable is required');
  process.exit(1);
}

const client = new TimingClient({
  apiKey: API_KEY,
  timezone: process.env.TIMING_TIMEZONE,
});

// Helper to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Helper to format time entry for display
function formatTimeEntry(entry: {
  self: string;
  title?: string | null;
  duration: number;
  is_running: boolean;
  start_date: string;
  end_date: string;
  project?: { self: string; title?: string } | null;
  notes?: string | null;
  billing_status?: string;
}): string {
  const lines: string[] = [];
  lines.push(`ID: ${entry.self}`);
  if (entry.title) lines.push(`Title: ${entry.title}`);
  if (entry.project && 'title' in entry.project) {
    lines.push(`Project: ${entry.project.title}`);
  } else if (entry.project) {
    lines.push(`Project: ${entry.project.self}`);
  }
  lines.push(`Duration: ${formatDuration(entry.duration)}${entry.is_running ? ' (running)' : ''}`);
  lines.push(`Start: ${entry.start_date}`);
  if (!entry.is_running) lines.push(`End: ${entry.end_date}`);
  if (entry.notes) lines.push(`Notes: ${entry.notes}`);
  if (entry.billing_status) lines.push(`Billing: ${entry.billing_status}`);
  return lines.join('\n');
}

// Create MCP server
const server = new Server(
  {
    name: 'timing-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ============ Tools Definition ============

const TOOLS = [
  // Timer
  {
    name: 'timing_start_timer',
    description: 'Start a new timer. Stops any currently running timer.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID (e.g., "My Project" or "/projects/1")',
        },
        title: {
          type: 'string',
          description: 'Timer title/description',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
        billing_status: {
          type: 'string',
          enum: ['not_billable', 'billable', 'billed', 'paid'],
          description: 'Billing status',
        },
      },
    },
  },
  {
    name: 'timing_stop_timer',
    description: 'Stop the currently running timer',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'timing_get_running',
    description: 'Get the currently running timer, if any',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // Time Entries
  {
    name: 'timing_list_entries',
    description: 'List time entries with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date_min: {
          type: 'string',
          description: 'Minimum start date (ISO format, e.g., "2024-01-01")',
        },
        start_date_max: {
          type: 'string',
          description: 'Maximum start date (ISO format)',
        },
        project: {
          type: 'string',
          description: 'Filter by project ID',
        },
        search_query: {
          type: 'string',
          description: 'Search in title and notes',
        },
        include_project_data: {
          type: 'boolean',
          description: 'Include full project details',
        },
        billing_status: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by billing status',
        },
      },
    },
  },
  {
    name: 'timing_create_entry',
    description: 'Create a new time entry (completed, not running)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date: {
          type: 'string',
          description: 'Start date/time (ISO format with timezone)',
        },
        end_date: {
          type: 'string',
          description: 'End date/time (ISO format with timezone)',
        },
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        title: {
          type: 'string',
          description: 'Entry title',
        },
        notes: {
          type: 'string',
          description: 'Additional notes',
        },
        billing_status: {
          type: 'string',
          enum: ['not_billable', 'billable', 'billed', 'paid'],
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'timing_update_entry',
    description: 'Update an existing time entry',
    inputSchema: {
      type: 'object' as const,
      properties: {
        entry_id: {
          type: 'string',
          description: 'Time entry ID (e.g., "/time-entries/123" or "123")',
        },
        title: { type: 'string' },
        notes: { type: 'string' },
        project: { type: 'string' },
        billing_status: {
          type: 'string',
          enum: ['not_billable', 'billable', 'billed', 'paid'],
        },
      },
      required: ['entry_id'],
    },
  },
  {
    name: 'timing_delete_entry',
    description: 'Delete a time entry',
    inputSchema: {
      type: 'object' as const,
      properties: {
        entry_id: {
          type: 'string',
          description: 'Time entry ID',
        },
      },
      required: ['entry_id'],
    },
  },
  {
    name: 'timing_get_latest',
    description: 'Get the most recent time entry',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // Projects
  {
    name: 'timing_list_projects',
    description: 'List all projects',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Filter by title (partial match)',
        },
        hide_archived: {
          type: 'boolean',
          description: 'Hide archived projects',
        },
        team_id: {
          type: 'string',
          description: 'Filter by team ID',
        },
      },
    },
  },
  {
    name: 'timing_project_hierarchy',
    description: 'Get complete project hierarchy tree',
    inputSchema: {
      type: 'object' as const,
      properties: {
        team_id: {
          type: 'string',
          description: 'Filter by team ID',
        },
      },
    },
  },
  {
    name: 'timing_get_project',
    description: 'Get details of a specific project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'timing_create_project',
    description: 'Create a new project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Project title',
        },
        parent: {
          type: 'string',
          description: 'Parent project ID or title',
        },
        color: {
          type: 'string',
          description: 'Color in hex format (#RRGGBB)',
        },
        productivity_score: {
          type: 'number',
          description: 'Productivity score (-1 to 1)',
        },
        notes: {
          type: 'string',
        },
        default_billing_status: {
          type: 'string',
          enum: ['not_billable', 'billable'],
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'timing_update_project',
    description: 'Update an existing project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID',
        },
        title: { type: 'string' },
        color: { type: 'string' },
        is_archived: { type: 'boolean' },
        notes: { type: 'string' },
        productivity_score: { type: 'number' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'timing_delete_project',
    description: 'Delete a project and all its children',
    inputSchema: {
      type: 'object' as const,
      properties: {
        project_id: {
          type: 'string',
          description: 'Project ID',
        },
      },
      required: ['project_id'],
    },
  },

  // Reports
  {
    name: 'timing_generate_report',
    description: 'Generate a time report with aggregated data',
    inputSchema: {
      type: 'object' as const,
      properties: {
        start_date_min: {
          type: 'string',
          description: 'Report start date',
        },
        start_date_max: {
          type: 'string',
          description: 'Report end date',
        },
        projects: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by project IDs',
        },
        include_child_projects: {
          type: 'boolean',
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Columns to include: project, title, notes, timespan, user, billing_status',
        },
        timespan_grouping_mode: {
          type: 'string',
          enum: ['exact', 'day', 'week', 'month', 'year'],
          description: 'How to group time spans',
        },
        include_project_data: {
          type: 'boolean',
          description: 'Include full project details',
        },
      },
    },
  },

  // Teams
  {
    name: 'timing_list_teams',
    description: 'List all teams you are a member of',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'timing_list_team_members',
    description: 'List members of a team',
    inputSchema: {
      type: 'object' as const,
      properties: {
        team_id: {
          type: 'string',
          description: 'Team ID',
        },
      },
      required: ['team_id'],
    },
  },
];

// ============ Tool Handlers ============

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Timer
      case 'timing_start_timer': {
        const params = args as { project?: string; title?: string; notes?: string; billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid' };
        const entry = await client.startTimer(params);
        return {
          content: [{ type: 'text', text: `Timer started!\n\n${formatTimeEntry(entry)}` }],
        };
      }

      case 'timing_stop_timer': {
        const entry = await client.stopTimer();
        return {
          content: [{ type: 'text', text: `Timer stopped!\n\n${formatTimeEntry(entry)}` }],
        };
      }

      case 'timing_get_running': {
        const entry = await client.getRunningTimer();
        if (!entry) {
          return { content: [{ type: 'text', text: 'No timer currently running.' }] };
        }
        return {
          content: [{ type: 'text', text: `Currently running:\n\n${formatTimeEntry(entry)}` }],
        };
      }

      // Time Entries
      case 'timing_list_entries': {
        const params = args as {
          start_date_min?: string;
          start_date_max?: string;
          project?: string;
          search_query?: string;
          include_project_data?: boolean;
          billing_status?: string[];
        };
        const response = await client.listTimeEntries({
          ...params,
          projects: params.project ? [params.project] : undefined,
        });
        
        const entries = response.data;
        if (entries.length === 0) {
          return { content: [{ type: 'text', text: 'No time entries found.' }] };
        }

        const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
        const text = `Found ${entries.length} entries (Total: ${formatDuration(totalDuration)})\n\n` +
          entries.slice(0, 20).map(e => formatTimeEntry(e)).join('\n\n---\n\n');
        
        return { content: [{ type: 'text', text }] };
      }

      case 'timing_create_entry': {
        const params = args as {
          start_date: string;
          end_date: string;
          project?: string;
          title?: string;
          notes?: string;
          billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid';
        };
        const entry = await client.createTimeEntry(params);
        return {
          content: [{ type: 'text', text: `Time entry created!\n\n${formatTimeEntry(entry)}` }],
        };
      }

      case 'timing_update_entry': {
        const { entry_id, ...params } = args as {
          entry_id: string;
          title?: string;
          notes?: string;
          project?: string;
          billing_status?: 'not_billable' | 'billable' | 'billed' | 'paid';
        };
        const entry = await client.updateTimeEntry(entry_id, params);
        return {
          content: [{ type: 'text', text: `Time entry updated!\n\n${formatTimeEntry(entry)}` }],
        };
      }

      case 'timing_delete_entry': {
        const { entry_id } = args as { entry_id: string };
        await client.deleteTimeEntry(entry_id);
        return {
          content: [{ type: 'text', text: `Time entry ${entry_id} deleted.` }],
        };
      }

      case 'timing_get_latest': {
        const entry = await client.getLatestTimeEntry();
        return {
          content: [{ type: 'text', text: `Latest entry:\n\n${formatTimeEntry(entry)}` }],
        };
      }

      // Projects
      case 'timing_list_projects': {
        const params = args as { title?: string; hide_archived?: boolean; team_id?: string };
        const projects = await client.listProjects(params);
        
        if (projects.length === 0) {
          return { content: [{ type: 'text', text: 'No projects found.' }] };
        }

        const text = projects.map(p => 
          `• ${p.title} (${p.self})${p.is_archived ? ' [archived]' : ''}`
        ).join('\n');
        
        return { content: [{ type: 'text', text: `Projects:\n\n${text}` }] };
      }

      case 'timing_project_hierarchy': {
        const { team_id } = args as { team_id?: string };
        const projects = await client.getProjectHierarchy(team_id);

        type ProjectNode = { self: string; title: string; children?: ProjectNode[] };
        function formatHierarchy(items: ProjectNode[], indent = 0): string {
          return items.map((p: ProjectNode) => {
            const prefix = '  '.repeat(indent) + (indent > 0 ? '└─ ' : '');
            const children = (p.children && p.children.length > 0)
              ? '\n' + formatHierarchy(p.children, indent + 1)
              : '';
            return `${prefix}${p.title} (${p.self})${children}`;
          }).join('\n');
        }

        return {
          content: [{ type: 'text', text: `Project Hierarchy:\n\n${formatHierarchy(projects as ProjectNode[])}` }],
        };
      }

      case 'timing_get_project': {
        const { project_id } = args as { project_id: string };
        const project = await client.getProject(project_id);
        
        const lines = [
          `Title: ${project.title}`,
          `ID: ${project.self}`,
          `Color: ${project.color}`,
          `Productivity: ${project.productivity_score}`,
          `Archived: ${project.is_archived}`,
          project.notes ? `Notes: ${project.notes}` : null,
          project.default_billing_status ? `Default billing: ${project.default_billing_status}` : null,
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      case 'timing_create_project': {
        const params = args as {
          title: string;
          parent?: string;
          color?: string;
          productivity_score?: number;
          notes?: string;
          default_billing_status?: 'not_billable' | 'billable';
        };
        const project = await client.createProject(params);
        return {
          content: [{ type: 'text', text: `Project created!\n\nTitle: ${project.title}\nID: ${project.self}` }],
        };
      }

      case 'timing_update_project': {
        const { project_id, ...params } = args as {
          project_id: string;
          title?: string;
          color?: string;
          is_archived?: boolean;
          notes?: string;
          productivity_score?: number;
        };
        const project = await client.updateProject(project_id, params);
        return {
          content: [{ type: 'text', text: `Project updated!\n\nTitle: ${project.title}\nID: ${project.self}` }],
        };
      }

      case 'timing_delete_project': {
        const { project_id } = args as { project_id: string };
        await client.deleteProject(project_id);
        return {
          content: [{ type: 'text', text: `Project ${project_id} deleted.` }],
        };
      }

      // Reports
      case 'timing_generate_report': {
        const params = args as {
          start_date_min?: string;
          start_date_max?: string;
          projects?: string[];
          include_child_projects?: boolean;
          columns?: ('project' | 'title' | 'notes' | 'timespan' | 'user' | 'billing_status')[];
          timespan_grouping_mode?: 'exact' | 'day' | 'week' | 'month' | 'year';
          include_project_data?: boolean;
        };
        
        const rows = await client.generateReport({
          ...params,
          include_project_data: params.include_project_data ?? true,
          columns: params.columns ?? ['project'],
        });

        if (rows.length === 0) {
          return { content: [{ type: 'text', text: 'No data for the requested report.' }] };
        }

        const totalDuration = rows.reduce((sum, r) => sum + r.duration, 0);
        
        const text = rows.map(row => {
          const parts = [`Duration: ${formatDuration(row.duration)}`];
          if (row.project && 'title' in row.project) {
            parts.unshift(`Project: ${row.project.title}`);
          }
          if (row.title) parts.push(`Title: ${row.title}`);
          if (row.start_date) parts.push(`Date: ${row.start_date.split('T')[0]}`);
          return parts.join(' | ');
        }).join('\n');

        return {
          content: [{ type: 'text', text: `Report (Total: ${formatDuration(totalDuration)})\n\n${text}` }],
        };
      }

      // Teams
      case 'timing_list_teams': {
        const teams = await client.listTeams();
        if (teams.length === 0) {
          return { content: [{ type: 'text', text: 'No teams found.' }] };
        }
        const text = teams.map(t => `• ${t.name} (${t.id})`).join('\n');
        return { content: [{ type: 'text', text: `Teams:\n\n${text}` }] };
      }

      case 'timing_list_team_members': {
        const { team_id } = args as { team_id: string };
        const members = await client.listTeamMembers(team_id);
        if (members.length === 0) {
          return { content: [{ type: 'text', text: 'No members found.' }] };
        }
        const text = members.map(m => `• ${m.name || m.email} (${m.email})`).join('\n');
        return { content: [{ type: 'text', text: `Team Members:\n\n${text}` }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    if (error instanceof TimingApiError) {
      return {
        content: [{ type: 'text', text: `Timing API Error: ${error.message}` }],
        isError: true,
      };
    }
    throw error;
  }
});

// ============ Resources ============

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'timing://projects',
        name: 'Projects List',
        description: 'List of all Timing projects',
        mimeType: 'application/json',
      },
      {
        uri: 'timing://running',
        name: 'Running Timer',
        description: 'Currently running timer, if any',
        mimeType: 'application/json',
      },
      {
        uri: 'timing://today',
        name: 'Today Summary',
        description: 'Summary of time tracked today',
        mimeType: 'application/json',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'timing://projects': {
      const projects = await client.listProjects({ hide_archived: true });
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(projects, null, 2),
          },
        ],
      };
    }

    case 'timing://running': {
      const timer = await client.getRunningTimer();
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(timer, null, 2),
          },
        ],
      };
    }

    case 'timing://today': {
      const today = new Date().toISOString().split('T')[0];
      const response = await client.listTimeEntries({
        start_date_min: today,
        start_date_max: today,
        include_project_data: true,
      });
      
      const entries = response.data;
      const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
      
      // Group by project
      const byProject: Record<string, { title: string; duration: number }> = {};
      for (const entry of entries) {
        const projectTitle = entry.project && 'title' in entry.project 
          ? entry.project.title 
          : 'No Project';
        if (!byProject[projectTitle]) {
          byProject[projectTitle] = { title: projectTitle, duration: 0 };
        }
        byProject[projectTitle].duration += entry.duration;
      }

      const summary = {
        date: today,
        total_duration: totalDuration,
        total_formatted: formatDuration(totalDuration),
        entries_count: entries.length,
        by_project: Object.values(byProject).map(p => ({
          ...p,
          duration_formatted: formatDuration(p.duration),
        })),
      };

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ============ Start Server ============

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Timing MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
