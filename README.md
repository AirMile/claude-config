# Claude Code Command System

> Tutorial and documentation for using Claude Code commands in this project.

---

## Quick Start

### First Use

```bash
# Start Claude Code in your project
cd /path/to/your/project
claude
```

### Set Language Preference

Open `.claude/CLAUDE.md` and adjust:

```markdown
## User Preferences

Language: English
```

**Supported languages:** English, Nederlands, Deutsch, Français, Español

### The Standard Workflow

```
/setup → /1-plan → /2-code → /3-verify → /save
```

| Situation | Start with |
|-----------|------------|
| New project | `/setup` |
| New feature | `/1-plan` |
| Done for today | `/save` |

---

## Available Commands

### Development Workflow

The numbered commands form a complete pipeline:

| Command | Description |
|---------|-------------|
| `/1-plan` | Classifies tasks, clarifies requirements and does research via Context7 |
| `/2-code` | Guides implementation with architecture patterns, testing and documentation |
| `/3-verify` | Complete verification and testing with intelligent issue handling |
| `/4-refine` | Refines features with small functional changes |
| `/5-refactor` | Refactors code for security, performance and quality. Non-breaking changes only |

### Debugging & Security

| Command | Description |
|---------|-------------|
| `/debug` | Systematic debugging with parallel agents and fix options |
| `/owasp` | Complete OWASP Top 10:2025 security audit with parallel scanners |

### Ideas & Creativity

| Command | Description |
|---------|-------------|
| `/idea` | Articulates and develops ideas through targeted questions |
| `/brainstorm` | Creatively expands ideas with techniques like Extreme Possibilities |
| `/critique` | Critically analyzes ideas and identifies weaknesses |
| `/analyze` | Analyzes plans with 3 parallel agents for risks and alternatives |

### Code Review & Testing

| Command | Description |
|---------|-------------|
| `/review-other` | Code review for feature branches before PR |
| `/test-other` | Test teammate's code on feature branch |

### UI/UX

| Command | Description |
|---------|-------------|
| `/style` | Lightweight workflow for styling, layout and UX flows |
| `/wireframe` | Generates low-fidelity HTML wireframes with design agents |

### Git

| Command | Description |
|---------|-------------|
| `/commit` | Commit changes with auto-generated conventional commit message |

### Meta/Setup

| Command | Description |
|---------|-------------|
| `/setup` | Interactive project setup wizard |
| `/create` | Create new custom commands |
| `/edit` | Edit existing commands |
| `/save` | Close chat session with save/delete choice |

---

## Session Tracking

Session Tracking saves your progress so work isn't lost on interruption.

### The Two-Layer System

```
┌─────────────────────────────────────────────────────────┐
│  CHAT SESSION (the outer layer)                         │
│  Location: .claude/sessions/.chat/current-{id}.md        │
│                                                         │
│  Contains:                                              │
│  - Free conversations and questions                     │
│  - Summaries of completed commands                      │
│  - Discussions after command completion                 │
├─────────────────────────────────────────────────────────┤
│  COMMAND SESSION (the inner layer)                      │
│  Location: .claude/sessions/{command}/current.md        │
│                                                         │
│  Contains:                                              │
│  - FASE tracking (where you are in the workflow)        │
│  - Decisions per FASE                                   │
│  - Deleted after completion                             │
└─────────────────────────────────────────────────────────┘
```

### How It Works

| Moment | What Happens |
|--------|--------------|
| Chat start | Chat session automatically created |
| Command start | Command session created (FASE tracking) |
| Command done | Summary → chat session, command session deleted |
| `/save` | Choice: save or delete |

### Resuming Sessions

On interruption (crash, disconnect):

```
You: /2-code

Claude: An open session was found:
        portfolio-grid (FASE 2, 1 day ago)

        ○ Resume (Recommended)
        ○ New Session
```

### Using `/save`

At the end of your session:

```
Claude: What do you want to do with this chat session?

○ Save as: "portfolio-planning" (Recommended)
○ Save with different name
○ Delete
```

### VSCode Blur Workaround

When a modal appears in VSCode, the background content gets blurred. This makes it hard to reference context while making decisions.

**Solution:** Before showing a modal that requires context (e.g., "Approve this plan?"), the context is written to the session file first. You can open the session file to read the context while modal is open.

**Which file to open:**
- During a command: `.claude/sessions/{command}/current.md`
- During free chat: `.claude/sessions/.chat/current-{id}.md`

**Tip:** Keep the session file open in a separate tab while working.

---

## Workflow Examples

### 1. Building a New Feature

**Flow:** `/1-plan` → `/2-code` → `/3-verify`

```
/1-plan
├── Classification (New Feature / Extend / Update)
├── Gather requirements
├── Research via Context7 (3 parallel agents)
├── Generate architecture options
└── Output: Plan document

/2-code
├── Load plan
├── Implementation strategies (3 parallel agents)
├── Write code
├── Generate tests
└── Output: Working code + tests

/3-verify
├── Check requirements
├── Run tests
├── Fix issues (if needed)
└── Output: Verified feature
```

**Session tracking:** Each step saves progress. On crash, resume where you left off.

### 2. Fixing Bugs

**Flow:** `/debug`

```
/debug
├── Describe problem
├── 3 Debug Agents (parallel):
│   ├── error-tracer: finds errors
│   ├── change-detective: checks recent commits
│   └── context-mapper: analyzes code
├── Root cause analysis
├── Fix options:
│   ├── Minimal: smallest change
│   ├── Thorough: complete fix
│   └── Defensive: with safeguards
└── Apply fix
```

### 3. Developing an Idea

**Flow:** `/idea` → `/brainstorm` → `/critique` → `/1-plan`

```
/idea
├── Articulate concept
├── Targeted questions
└── Output: Structured concept

/brainstorm
├── Apply techniques:
│   ├── Extreme Possibilities
│   ├── Perspective Shifting
│   └── Analogical Thinking
└── Output: Expanded concept

/critique
├── Analysis techniques:
│   ├── Devil's Advocate
│   ├── Assumption Testing
│   └── Feasibility Analysis
└── Output: Strengthened concept

/1-plan
├── Concept → Feature planning
└── Output: Implementable plan
```

---

## Tips for Effective Use

1. **Always start with a plan**
   `/1-plan` prevents writing code you'll have to throw away later.

2. **Be specific**
   "Add a contact form with name, email and message" works better than "make a form".

3. **Use session tracking**
   If your chat interrupts, Claude automatically picks up where you left off.

4. **Let Claude ask questions**
   When unclear, you get options with a recommendation.

5. **Trust the workflow**
   The numbered commands (`/1-plan` → `/2-code` → `/3-verify`) are designed to work together.

---

## FAQ

**Where do I find the project instructions?**
In `.claude/CLAUDE.md` - this contains language preference, project info and rules.

**Can I resume my session later?**
Yes. When starting a command, Claude asks if you want to resume or start fresh.

**What if I don't know which command I need?**
Just describe what you want to achieve. Claude helps you choose the right path.

**How do I save my progress?**
Use `/save` at the end of your session.

**Does this work with existing projects?**
Yes. Use `/setup` to make Claude familiar with your existing codebase.

**What are Smart Suggestions?**
For questions, you get concrete options with a recommendation, so you can decide quickly.

---

## File Structure

```
.claude/
├── CLAUDE.md                    # Project instructions & settings
├── README.md                    # This tutorial
├── commands/                    # Command definitions
│   ├── 1-plan.md
│   ├── 2-code.md
│   ├── ...
│   └── save.md
├── sessions/                    # Session tracking
│   ├── chat/                    # Chat sessions
│   │   ├── current-{id}.md      # Active chats
│   │   └── {name}.md            # Saved chats
│   ├── 1-plan/
│   │   └── current.md           # Active command session
│   └── .../
├── plans/                       # Generated plans
├── docs/                        # Documentation
└── resources/                   # Command resources
```

---

## More Information

- **Design documents:** `.claude/docs/improvements/`
- **Command source:** `.claude/commands/`
- **Session tracking details:** `.claude/docs/improvements/03-chat-session-tracking.md`
