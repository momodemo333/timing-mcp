# PRD — Timing MCP Server

## 1. Overview

### 1.1 Objectif
Développer un serveur MCP (Model Context Protocol) pour l'API Timing, permettant aux assistants IA d'interagir avec l'application de time-tracking Timing via des outils structurés.

### 1.2 Contexte
- **Timing** : Application macOS de time-tracking automatique avec API REST
- **MCP** : Protocole standard d'Anthropic pour connecter des LLMs à des outils externes
- **Cible** : Intégration avec Claude, Clawdbot, et autres clients MCP

### 1.3 Valeur Ajoutée
- Démarrer/arrêter des timers par commande vocale ou texte
- Consulter le temps passé sur des projets
- Créer des time entries et rapports
- Automatiser le time-tracking via l'IA

---

## 2. Stack Technique

### 2.1 Choix Technologique
| Composant | Choix | Justification |
|-----------|-------|---------------|
| Runtime | Node.js 20+ | SDK MCP officiel, écosystème mature |
| Langage | TypeScript 5.x | Type safety, meilleure DX, standard MCP |
| SDK MCP | `@modelcontextprotocol/sdk` | SDK officiel Anthropic |
| HTTP Client | `fetch` (natif) | Zéro dépendance, Node 18+ natif |
| Validation | Zod | Validation schemas, intégration MCP native |
| Build | tsup | Fast bundling, ESM + CJS |
| Tests | Vitest | Fast, TypeScript natif |

### 2.2 Structure du Projet
```
timing-mcp/
├── src/
│   ├── index.ts              # Entry point MCP server
│   ├── client.ts             # Timing API client
│   ├── tools/
│   │   ├── index.ts          # Export tous les tools
│   │   ├── timer.ts          # start/stop timer
│   │   ├── time-entries.ts   # CRUD time entries
│   │   ├── projects.ts       # CRUD projects
│   │   ├── reports.ts        # Generate reports
│   │   └── teams.ts          # Team management
│   ├── resources/
│   │   └── index.ts          # MCP resources (projects list, etc.)
│   └── types.ts              # TypeScript types from API
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 3. Spécifications Fonctionnelles

### 3.1 MCP Tools

#### 3.1.1 Timer Management
| Tool | Description | Paramètres |
|------|-------------|------------|
| `timing_start_timer` | Démarre un nouveau timer | `project?`, `title?`, `notes?`, `billing_status?` |
| `timing_stop_timer` | Arrête le timer en cours | — |
| `timing_get_running` | Récupère le timer actif | — |

#### 3.1.2 Time Entries
| Tool | Description | Paramètres |
|------|-------------|------------|
| `timing_list_entries` | Liste les time entries | `start_date_min?`, `start_date_max?`, `project?`, `search_query?`, `billing_status?`, `limit?` |
| `timing_create_entry` | Crée une time entry | `start_date`, `end_date`, `project?`, `title?`, `notes?`, `billing_status?` |
| `timing_update_entry` | Met à jour une entry | `entry_id`, `title?`, `notes?`, `project?`, `billing_status?` |
| `timing_delete_entry` | Supprime une entry | `entry_id` |
| `timing_get_latest` | Récupère la dernière entry | — |

#### 3.1.3 Projects
| Tool | Description | Paramètres |
|------|-------------|------------|
| `timing_list_projects` | Liste tous les projets | `title?`, `hide_archived?`, `team_id?` |
| `timing_get_project` | Détails d'un projet | `project_id` |
| `timing_create_project` | Crée un projet | `title`, `parent?`, `color?`, `productivity_score?`, `notes?`, `billing_status?` |
| `timing_update_project` | Met à jour un projet | `project_id`, `title?`, `color?`, `is_archived?`, `notes?` |
| `timing_delete_project` | Supprime un projet | `project_id` |
| `timing_project_hierarchy` | Arborescence complète | `team_id?` |

#### 3.1.4 Reports
| Tool | Description | Paramètres |
|------|-------------|------------|
| `timing_generate_report` | Génère un rapport | `start_date_min?`, `start_date_max?`, `projects?`, `columns?`, `timespan_grouping?`, `include_project_data?` |

#### 3.1.5 Teams
| Tool | Description | Paramètres |
|------|-------------|------------|
| `timing_list_teams` | Liste les équipes | — |
| `timing_list_team_members` | Membres d'une équipe | `team_id` |

### 3.2 MCP Resources

| Resource URI | Description |
|--------------|-------------|
| `timing://projects` | Liste des projets (cache-friendly) |
| `timing://projects/{id}` | Détails d'un projet |
| `timing://running` | Timer en cours |
| `timing://today` | Résumé du jour (durée totale, par projet) |

### 3.3 MCP Prompts (optionnel)

| Prompt | Description |
|--------|-------------|
| `timing_daily_summary` | Prompt pour résumé journalier |
| `timing_weekly_report` | Prompt pour rapport hebdomadaire |

---

## 4. Spécifications Techniques

### 4.1 Configuration

```typescript
interface TimingMCPConfig {
  apiKey: string;           // Bearer token (requis)
  baseUrl?: string;         // Default: https://web.timingapp.com/api/v1
  defaultTimezone?: string; // Header X-Time-Zone
  teamId?: string;          // Équipe par défaut (optionnel)
}
```

**Modes de configuration :**
1. Variable d'environnement : `TIMING_API_KEY`
2. Argument CLI : `--api-key`
3. Fichier config MCP standard

### 4.2 API Client

```typescript
class TimingClient {
  constructor(config: TimingMCPConfig);
  
  // Timer
  startTimer(params: StartTimerParams): Promise<TimeEntry>;
  stopTimer(): Promise<TimeEntry>;
  getRunningTimer(): Promise<TimeEntry | null>;
  
  // Time Entries
  listEntries(params: ListEntriesParams): Promise<PaginatedResponse<TimeEntry>>;
  createEntry(params: CreateEntryParams): Promise<TimeEntry>;
  updateEntry(id: string, params: UpdateEntryParams): Promise<TimeEntry>;
  deleteEntry(id: string): Promise<void>;
  getLatestEntry(): Promise<TimeEntry>;
  
  // Projects
  listProjects(params?: ListProjectsParams): Promise<Project[]>;
  getProject(id: string): Promise<Project>;
  createProject(params: CreateProjectParams): Promise<Project>;
  updateProject(id: string, params: UpdateProjectParams): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  getProjectHierarchy(teamId?: string): Promise<ProjectHierarchy[]>;
  
  // Reports
  generateReport(params: ReportParams): Promise<ReportRow[]>;
  
  // Teams
  listTeams(): Promise<Team[]>;
  listTeamMembers(teamId: string): Promise<TeamMember[]>;
}
```

### 4.3 Gestion des Erreurs

| Code HTTP | Comportement MCP |
|-----------|------------------|
| 401 | Erreur auth claire : "Invalid API key" |
| 404 | Ressource non trouvée (timer, entry, project) |
| 422 | Validation error avec détails |
| 429 | Rate limit → message avec retry-after |
| 5xx | Erreur serveur → retry suggestion |

### 4.4 Rate Limiting
- API limite : 500 req/heure, 200 req/min
- Implémenter un tracking côté client
- Exposer via resource `timing://rate-limit`

---

## 5. Sécurité

### 5.1 API Key
- Jamais loggée en clair
- Passée uniquement via env var ou config sécurisée
- Validée au démarrage du serveur

### 5.2 Validation Input
- Tous les paramètres validés via Zod
- Sanitization des dates (ISO8601)
- Project IDs validés (format `/projects/{id}`)

---

## 6. Tests

### 6.1 Unit Tests
- Client API avec mocks
- Validation des paramètres tools
- Parsing des réponses

### 6.2 Integration Tests
- Contre l'API réelle (avec clé de test)
- Création/suppression de données de test
- Vérification rate limiting

### 6.3 MCP Protocol Tests
- Validation du handshake
- Test de chaque tool
- Test des resources

---

## 7. Documentation

### 7.1 README.md
- Installation (npm, usage avec Claude Desktop, Clawdbot)
- Configuration
- Liste des tools avec exemples
- Troubleshooting

### 7.2 Exemples d'Usage
```
User: "Démarre un timer sur le projet Acme"
→ timing_start_timer { project: "Acme" }

User: "Combien de temps j'ai passé sur Acme cette semaine ?"
→ timing_generate_report { projects: ["/projects/1"], start_date_min: "2026-02-05", start_date_max: "2026-02-12" }

User: "Arrête le timer"
→ timing_stop_timer {}
```

---

## 8. Livrables

### 8.1 Phase 1 — MVP (2-3h)
- [x] Setup projet TypeScript
- [ ] Client API Timing complet
- [ ] Tools : timer (start/stop/running)
- [ ] Tools : time entries (list/create)
- [ ] Tools : projects (list/hierarchy)
- [ ] Tests avec vraie API

### 8.2 Phase 2 — Complet (1-2h)
- [ ] Tools : projects CRUD complet
- [ ] Tools : reports
- [ ] Tools : teams
- [ ] Resources MCP
- [ ] Documentation

### 8.3 Phase 3 — Polish (1h)
- [ ] Prompts MCP
- [ ] Error handling avancé
- [ ] Rate limit tracking
- [ ] Publication npm (optionnel)

---

## 9. Dépendances

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## 10. Critères de Succès

1. **Fonctionnel** : Tous les tools répondent correctement
2. **Robuste** : Erreurs API gérées proprement
3. **Documenté** : README clair, exemples d'usage
4. **Testé** : Coverage > 80% sur le client API
5. **Intégrable** : Fonctionne avec mcporter, Claude Desktop, Clawdbot

---

## Annexe A — Mapping API → Tools

| Endpoint API | Tool MCP |
|--------------|----------|
| `POST /time-entries/start` | `timing_start_timer` |
| `PUT /time-entries/stop` | `timing_stop_timer` |
| `GET /time-entries/running` | `timing_get_running` |
| `GET /time-entries` | `timing_list_entries` |
| `POST /time-entries` | `timing_create_entry` |
| `PUT /time-entries/{id}` | `timing_update_entry` |
| `DELETE /time-entries/{id}` | `timing_delete_entry` |
| `GET /time-entries/latest` | `timing_get_latest` |
| `GET /projects` | `timing_list_projects` |
| `GET /projects/hierarchy` | `timing_project_hierarchy` |
| `GET /projects/{id}` | `timing_get_project` |
| `POST /projects` | `timing_create_project` |
| `PUT /projects/{id}` | `timing_update_project` |
| `DELETE /projects/{id}` | `timing_delete_project` |
| `GET /report` | `timing_generate_report` |
| `GET /teams` | `timing_list_teams` |
| `GET /teams/{id}/members` | `timing_list_team_members` |

---

## Annexe B — Types API

Voir fichier `llms.txt` de Timing pour les schémas JSON complets des réponses.
