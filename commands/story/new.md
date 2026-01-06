---
description: Start a new story with folder structure and metadata
---

# Story New

Creates a new story project with the complete folder structure.

## When to Use

When starting a new story, novel, or writing project.

## Process

### Step 1: Gather Information

Ask for story details using AskUserQuestion:

**Title:**
- header: "Title"
- question: "Wat is de titel (of werktitel) van je verhaal?"
- options:
  - label: "Ik heb een titel", description: "Vul de titel in via 'Other'"
  - label: "Nog geen titel", description: "Gebruik 'Untitled' als werktitel"
  - label: "Help me brainstormen", description: "Genereer titelsuggesties"
- multiSelect: false

**Genre:**
- header: "Genre"
- question: "Welk genre(s) heeft je verhaal?"
- options:
  - label: "Fantasy", description: "Magie, andere werelden, mythische wezens"
  - label: "Sci-Fi", description: "Toekomst, technologie, ruimte"
  - label: "Horror", description: "Angst, spanning, bovennatuurlijk"
  - label: "Thriller", description: "Spanning, actie, gevaar"
- multiSelect: true

### Step 2: Create Structure

Convert title to kebab-case slug. Create folder structure:

```bash
mkdir -p stories/{slug}/characters
mkdir -p stories/{slug}/world
mkdir -p stories/{slug}/scenes
mkdir -p stories/{slug}/drafts
```

### Step 3: Create Files

**_meta.md** - Use template from `templates/meta.md`:
- Fill `title` with provided title
- Set `working_title: true` if "Untitled" or user indicated werktitel
- Fill `genre` array with selected genres
- Set `status: brainstorm`
- Set `created` and `updated` to today's date

**timeline.md** - Copy from `templates/timeline.md`

**scenes/_outline.md** - Copy from `templates/outline.md`

### Step 4: Confirmation

Show created structure:

```
✅ VERHAAL AANGEMAAKT!

📁 stories/{slug}/
├── _meta.md
├── timeline.md
├── characters/
├── world/
├── scenes/
│   └── _outline.md
└── drafts/

Titel: {title}
Genre: {genres}
Status: brainstorm
```

### Step 5: Optional Brainstorm

Ask user:
- header: "Next"
- question: "Wat wil je nu doen?"
- options:
  - label: "Brainstormen (Recommended)", description: "Ontdek je verhaal met vragen"
  - label: "Personage maken", description: "Start met /character"
  - label: "Worldbuilding", description: "Start met /world"
  - label: "Klaar voor nu", description: "Ik ga later verder"
- multiSelect: false

If "Brainstormen": Start brainstorm session with questions:
- Wat is het eerste beeld dat in je hoofd opkomt?
- Wie is je hoofdpersonage (in één zin)?
- Wat is het centrale conflict?
- Welk gevoel wil je dat de lezer heeft?

Save answers as notes in `_meta.md`.

## Output

- `stories/{slug}/` complete folder structure
- `_meta.md` with frontmatter
- Ready to use with other story commands
