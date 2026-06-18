# Dashboard Schema — Index

The project dashboard is an interactive UI (served by `{skills_path}/shared/references/serve-backlog.js`, port 9876) that displays and edits project metadata from two files: `.project/project.json` (project metadata: seed, design, theme, stack, data, endpoints, optimization runs, team — `schemaVersion: 2`) and `.project/project-context.json` (runtime context for build/test/refactor skills: architecture, context, learnings). Feature data lives in `.project/backlog.json` (see [BACKLOG.md](BACKLOG.md)); the server merges it into the dashboard view in-memory. All skills read and write these files via the schemas and merge strategies documented in the three files below — this index only routes you to the right one.

| File                                         | Covers                                                                                                            |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [DASHBOARD-PROJECT.md](DASHBOARD-PROJECT.md) | `project.json`: full + empty schema, merge strategies, all sections, writer tables, Design Section, server        |
| [DASHBOARD-CONTEXT.md](DASHBOARD-CONTEXT.md) | `project-context.json`: architecture (component-first model), routes, context, learnings, thinking, writer tables |
| [DASHBOARD-THEME.md](DASHBOARD-THEME.md)     | `theme` section of `project.json`: tokens, motion packs, springs, choreography, glass surfaces                    |

## Section map

| Topic (§ reference)                                               | Lives in                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------- |
| Reading / Writing the dashboard, **empty schema** scaffold        | DASHBOARD-PROJECT.md § Writing the dashboard            |
| Merge strategy per section (**merge strategies**)                 | DASHBOARD-PROJECT.md § Merge strategy per section       |
| `seed`, single source of truth, `project-seed.md`                 | DASHBOARD-PROJECT.md § seed                             |
| `stack`, `data` (entities), `endpoints`, `localUrl`               | DASHBOARD-PROJECT.md § Section schemas                  |
| `team` (mode, commitConvention, ticketPrefix, tracker)            | DASHBOARD-PROJECT.md § team                             |
| `features` (derived — canonical in backlog.json), `recentChanges` | DASHBOARD-PROJECT.md § features + BACKLOG.md            |
| § `optimization_runs` (schema + append strategy)                  | DASHBOARD-PROJECT.md § optimization_runs                |
| § Design Section (pages, flows, principles, components)           | DASHBOARD-PROJECT.md § Design Section                   |
| `design` schema + scope/appliesTo                                 | DASHBOARD-PROJECT.md § design schema / § Design Section |
| Writer tables: project.json sections, skill sync overview         | DASHBOARD-PROJECT.md § Which skills write what          |
| Server (URLs, start command)                                      | DASHBOARD-PROJECT.md § Server                           |
| `project-context.json` file schema                                | DASHBOARD-CONTEXT.md § project-context.json             |
| `architecture` + **component-first model**, **Edge fields**       | DASHBOARD-CONTEXT.md § architecture                     |
| Skills that write architecture, write strategy                    | DASHBOARD-CONTEXT.md § Skills that write architecture   |
| `architecture.routes`                                             | DASHBOARD-CONTEXT.md § architecture.routes              |
| § `context` (**context.structure**, routing, patterns)            | DASHBOARD-CONTEXT.md § context                          |
| § `learnings` (schema, source mapping tables)                     | DASHBOARD-CONTEXT.md § learnings                        |
| Thinking log / **thinking-output** (`.project/thinking/`)         | DASHBOARD-CONTEXT.md § thinking-output                  |
| Writer table: project-context.json sections                       | DASHBOARD-CONTEXT.md § Which skills write what          |
| § `theme` (tokens, motion, springs, choreography, glass)          | DASHBOARD-THEME.md § theme                              |

Game projects: `architecture` may contain game-specific fields (`componentTree`, `scenes[]`, `scripts[]`, `signals[]`, `resources[]`) — same component-first model, see DASHBOARD-CONTEXT.md § architecture.

Feature detail schema (`feature.json`): see `shared/FEATURE.md`.
