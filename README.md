# Timing MCP Server

MCP (Model Context Protocol) server for the [Timing](https://timingapp.com) time-tracking API.

## Features

- **17 Tools** covering all Timing API functionality
- **Timer Management**: Start, stop, check running timer
- **Time Entries**: List, create, update, delete entries
- **Projects**: Full CRUD + hierarchy view
- **Reports**: Generate aggregated reports
- **Teams**: List teams and members
- **Resources**: Quick access to projects, running timer, daily summary

## Installation

### Via npx (recommended)

```bash
npx timing-mcp
```

### From source

```bash
git clone https://github.com/momodemo333/timing-mcp
cd timing-mcp
npm install
npm run build
```

## Configuration

Set your Timing API key as an environment variable:

```bash
export TIMING_API_KEY="your-api-key"
```

Get your API key from: https://web.timingapp.com/integrations/tokens

Optional: Set timezone
```bash
export TIMING_TIMEZONE="Europe/Brussels"
```

## Usage

### With mcporter

```bash
# List tools
mcporter list-tools --stdio "node dist/index.js"

# List projects
mcporter call --stdio "node dist/index.js" timing_list_projects

# Start a timer
mcporter call --stdio "node dist/index.js" 'timing_start_timer(project: "My Project", title: "Working")'

# Stop timer
mcporter call --stdio "node dist/index.js" timing_stop_timer
```

### With Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "timing": {
      "command": "node",
      "args": ["/path/to/timing-app-mcp/dist/index.js"],
      "env": {
        "TIMING_API_KEY": "your-api-key"
      }
    }
  }
}
```

### With Clawdbot

Add to your mcporter config:

```json
{
  "mcpServers": {
    "timing": {
      "command": "node",
      "args": ["/home/morgan/project/timing-app-mcp/dist/index.js"],
      "env": {
        "TIMING_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### Timer
| Tool | Description |
|------|-------------|
| `timing_start_timer` | Start a new timer (stops any running timer) |
| `timing_stop_timer` | Stop the currently running timer |
| `timing_get_running` | Get the currently running timer |

### Time Entries
| Tool | Description |
|------|-------------|
| `timing_list_entries` | List time entries with filters |
| `timing_create_entry` | Create a completed time entry |
| `timing_update_entry` | Update an existing entry |
| `timing_delete_entry` | Delete a time entry |
| `timing_get_latest` | Get the most recent entry |

### Projects
| Tool | Description |
|------|-------------|
| `timing_list_projects` | List all projects |
| `timing_project_hierarchy` | Get project tree structure |
| `timing_get_project` | Get project details |
| `timing_create_project` | Create a new project |
| `timing_update_project` | Update a project |
| `timing_delete_project` | Delete a project |

### Reports & Teams
| Tool | Description |
|------|-------------|
| `timing_generate_report` | Generate aggregated report |
| `timing_list_teams` | List your teams |
| `timing_list_team_members` | List team members |

## MCP Resources

| URI | Description |
|-----|-------------|
| `timing://projects` | All projects (JSON) |
| `timing://running` | Running timer (JSON) |
| `timing://today` | Today's summary with totals |

## Examples

```
User: "Start a timer on Kuzco project"
→ timing_start_timer { project: "Kuzco" }

User: "How much time did I spend on Kuzco this week?"
→ timing_generate_report { 
    projects: ["/projects/3776384873043072256"], 
    start_date_min: "2026-02-05", 
    start_date_max: "2026-02-12" 
  }

User: "Stop the timer"
→ timing_stop_timer {}

User: "What projects do I have?"
→ timing_list_projects {}
```

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Type check
npm run typecheck
```

## License

MIT
