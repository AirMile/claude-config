#!/usr/bin/env python3
"""
Generate output files and folders for /1-plan skill based on FEATURE_FOLDER_STRUCTURE.md

This script handles:
- Folder structure creation (flat structure for all features)
- Intent + Research file generation (split context)
- Multiple modes (NEW, UPDATE_AFTER_DEBUG, UPDATE_PLAN)
- Extends/changes: append sections to existing parent files (no subfolders)
- Parts: sections within parent files with status markers (no subfolders)

Output structure:
- 01-intent.md: User requirements, scope, constraints, part sections
- 01-research.md: Context7 research, patterns, best practices, part sections
- 01-architecture.md: Architecture blueprint (if FASE 3.5 executed)

Status markers for parts:
- ○ = pending (not started)
- ● = in_progress (being worked on)
- ✓ = completed (done)
- ✗ = blocked (has issues)
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


class OutputGenerator:
    """Generates feature/extend/change output folders and files"""

    def __init__(self, input_data: Dict):
        self.data = input_data
        self.mode = input_data.get("mode", "NEW")
        self.decision = input_data.get("decision", "SINGLE_TASK")  # SINGLE_TASK or PARTS
        self.task_type = input_data.get("task_type", "FEATURE")
        self.feature_name = input_data["feature_name"]
        self.parent_feature = input_data.get("parent_feature")
        self.complexity = input_data.get("complexity", 0)

        # Base paths
        self.features_base = Path(".workspace/features")
        self.created_folders = []
        self.created_files = []

    def generate(self) -> Dict:
        """Main generation logic"""
        try:
            # EXTEND/CHANGE: append to existing files instead of creating subfolders
            if self.task_type in ["EXTEND", "CHANGE"]:
                return self._append_to_existing()
            elif self.decision == "SINGLE_TASK":
                return self._generate_single_task()
            else:  # PARTS
                return self._generate_parts()
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def _determine_feature_path(self) -> Path:
        """Determine folder path based on task type - always flat structure"""
        # All task types use flat structure - no subfolders for extend/change
        return self.features_base / self.feature_name

    def _append_to_existing(self) -> Dict:
        """Append extend/change content to existing feature files"""
        if not self.parent_feature:
            raise ValueError(f"{self.task_type} requires parent_feature")

        parent_path = self.features_base / self.parent_feature

        if not parent_path.exists():
            raise ValueError(f"Parent feature '{self.parent_feature}' not found in {self.features_base}")

        # Target files to append to
        intent_file = parent_path / "01-intent.md"
        research_file = parent_path / "01-research.md"
        architecture_file = parent_path / "01-architecture.md"

        modified_files = []

        # Append intent section
        if intent_file.exists():
            self._append_intent_section(intent_file)
            modified_files.append(str(intent_file))

        # Append research section
        if research_file.exists():
            self._append_research_section(research_file)
            modified_files.append(str(research_file))

        # Append architecture section if exists and we have architecture data
        if architecture_file.exists() and self.data.get("selected_architecture"):
            self._append_architecture_section(architecture_file)
            modified_files.append(str(architecture_file))

        return {
            "success": True,
            "mode": self.mode,
            "decision": "APPEND",
            "task_type": self.task_type,
            "feature_path": str(parent_path),
            "feature_name": self.feature_name,
            "parent_feature": self.parent_feature,
            "created_folders": [],
            "created_files": [],
            "modified_files": modified_files,
            "implementation_order": []
        }

    def _append_intent_section(self, path: Path):
        """Append extend/change intent section to existing 01-intent.md"""
        existing_content = path.read_text(encoding="utf-8")
        intent_data = self.data.get("intent", {})
        testable_reqs = intent_data.get("testable_requirements", [])

        type_label = "Extend" if self.task_type == "EXTEND" else "Change"
        date_str = datetime.now().strftime('%Y-%m-%d')

        new_section = f"""

---

## {type_label}: {self.feature_name.replace('-', ' ').title()} ({date_str})

**Complexity:** {self.complexity}/100
**Requirements:** {len(testable_reqs)} testable

### Overview

{self.data.get("intent_summary", "TBD")}

### Testable Requirements

{self._format_testable_requirements(testable_reqs)}

### Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

### Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

### Constraints

{intent_data.get('constraints', 'TBD')}

### Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

        path.write_text(existing_content + new_section, encoding="utf-8")

    def _append_research_section(self, path: Path):
        """Append extend/change research section to existing 01-research.md"""
        existing_content = path.read_text(encoding="utf-8")
        research = self.data.get("research", {})

        type_label = "Extend" if self.task_type == "EXTEND" else "Change"
        date_str = datetime.now().strftime('%Y-%m-%d')

        new_section = f"""

---

## {type_label}: {self.feature_name.replace('-', ' ').title()} ({date_str})

### Framework Best Practices

{research.get('conventions', 'TBD')}

### Architecture & Setup

{research.get('architecture', 'TBD')}

### Testing Strategy

{research.get('testing', 'TBD')}

### Common Pitfalls

{research.get('pitfalls', 'TBD')}

### Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
"""

        path.write_text(existing_content + new_section, encoding="utf-8")

    def _append_architecture_section(self, path: Path):
        """Append extend/change architecture section to existing 01-architecture.md"""
        existing_content = path.read_text(encoding="utf-8")
        selected_arch = self.data.get("selected_architecture", {})

        type_label = "Extend" if self.task_type == "EXTEND" else "Change"
        date_str = datetime.now().strftime('%Y-%m-%d')

        files_to_create = selected_arch.get("files_to_create", [])
        files_to_modify = selected_arch.get("files_to_modify", [])

        files_create_str = ""
        for f in files_to_create:
            file_path = f.get('file', '') if isinstance(f, dict) else f
            purpose = f.get('purpose', '') if isinstance(f, dict) else ''
            files_create_str += f"- `{file_path}`"
            if purpose:
                files_create_str += f" - {purpose}"
            files_create_str += "\n"

        files_modify_str = ""
        for f in files_to_modify:
            file_path = f.get('file', '') if isinstance(f, dict) else f
            change = f.get('change', '') if isinstance(f, dict) else ''
            files_modify_str += f"- `{file_path}`"
            if change:
                files_modify_str += f" - {change}"
            files_modify_str += "\n"

        new_section = f"""

---

## {type_label}: {self.feature_name.replace('-', ' ').title()} ({date_str})

**Approach:** {selected_arch.get('approach', 'TBD')}

### Design Overview

{selected_arch.get('design_overview', 'TBD')}

### Files to Create

{files_create_str if files_create_str else 'None'}

### Files to Modify

{files_modify_str if files_modify_str else 'None'}
"""

        path.write_text(existing_content + new_section, encoding="utf-8")

    def _generate_single_task(self) -> Dict:
        """Generate flat structure for single task"""
        feature_path = self._determine_feature_path()

        # Create folder
        feature_path.mkdir(parents=True, exist_ok=True)
        self.created_folders.append(str(feature_path))

        # Generate intent + research files (split context)
        intent_file = feature_path / "01-intent.md"
        research_file = feature_path / "01-research.md"
        architecture_file = feature_path / "01-architecture.md"

        self._write_intent_file(intent_file, is_part=False)
        self._write_research_file(research_file, is_part=False)

        self.created_files.append(str(intent_file))
        self.created_files.append(str(research_file))

        # Generate architecture file if selected_architecture exists
        if self.data.get("selected_architecture"):
            self._write_architecture_file(architecture_file)
            self.created_files.append(str(architecture_file))

        return {
            "success": True,
            "mode": self.mode,
            "decision": self.decision,
            "feature_path": str(feature_path),
            "created_folders": self.created_folders,
            "created_files": self.created_files,
            "implementation_order": []
        }

    def _generate_parts(self) -> Dict:
        """Generate single-file structure with part sections (no subfolders)"""
        feature_path = self._determine_feature_path()

        # Create parent folder
        feature_path.mkdir(parents=True, exist_ok=True)
        self.created_folders.append(str(feature_path))

        # Generate combined intent + research files with part sections
        intent_file = feature_path / "01-intent.md"
        research_file = feature_path / "01-research.md"
        architecture_file = feature_path / "01-architecture.md"

        self._write_combined_intent_with_parts(intent_file)
        self._write_combined_research_with_parts(research_file)
        self.created_files.append(str(intent_file))
        self.created_files.append(str(research_file))

        # Generate architecture file if selected_architecture exists
        if self.data.get("selected_architecture"):
            self._write_architecture_file(architecture_file)
            self.created_files.append(str(architecture_file))

        # Build implementation order from parts
        parts = self.data.get("parts", [])
        implementation_order = [f"{s['number']}-{s['name']}" for s in parts]

        return {
            "success": True,
            "mode": self.mode,
            "decision": self.decision,
            "feature_path": str(feature_path),
            "created_folders": self.created_folders,
            "created_files": self.created_files,
            "implementation_order": implementation_order
        }

    def _write_intent_file(self, path: Path, is_part: bool = False):
        """Write 01-intent.md with user requirements and scope

        Note: EXTEND/CHANGE are handled by _append_to_existing() and never reach here.
        """
        if self.mode == "UPDATE_AFTER_DEBUG":
            content = self._generate_update_after_debug_intent()
        elif self.mode == "UPDATE_PLAN":
            content = self._generate_update_plan_intent()
        else:  # NEW FEATURE only (EXTEND/CHANGE use append)
            content = self._generate_feature_intent()

        path.write_text(content, encoding="utf-8")

    def _write_architecture_file(self, path: Path):
        """Write 01-architecture.md with selected architecture blueprint"""
        selected_arch = self.data.get("selected_architecture", {})
        if not selected_arch:
            return  # Skip if no architecture selected (FASE 3.5 skipped)

        approach = selected_arch.get("approach", "Not specified")
        philosophy = selected_arch.get("philosophy", "")
        design_overview = selected_arch.get("design_overview", "")
        files_to_create = selected_arch.get("files_to_create", [])
        files_to_modify = selected_arch.get("files_to_modify", [])
        implementation_sequence = selected_arch.get("implementation_sequence", [])
        critical_considerations = selected_arch.get("critical_considerations", {})
        estimated_complexity = selected_arch.get("estimated_complexity", {})

        content = f"""# Architecture: {self.feature_name.replace('-', ' ').title()}

**Generated:** {datetime.now().strftime('%Y-%m-%d')}
**Approach:** {approach}
**Philosophy:** {philosophy}

## Design Overview

{design_overview}

## Files to Create

"""
        for f in files_to_create:
            file_path = f.get('file', '') if isinstance(f, dict) else f
            purpose = f.get('purpose', '') if isinstance(f, dict) else ''
            deps = f.get('dependencies', '') if isinstance(f, dict) else ''
            content += f"- `{file_path}`"
            if purpose:
                content += f" - {purpose}"
            if deps:
                content += f" (deps: {deps})"
            content += "\n"

        content += "\n## Files to Modify\n\n"
        for f in files_to_modify:
            file_path = f.get('file', '') if isinstance(f, dict) else f
            change = f.get('change', '') if isinstance(f, dict) else ''
            reason = f.get('reason', '') if isinstance(f, dict) else ''
            content += f"- `{file_path}`"
            if change:
                content += f" - {change}"
            if reason:
                content += f" ({reason})"
            content += "\n"

        content += "\n## Implementation Sequence\n\n"
        for i, phase in enumerate(implementation_sequence, 1):
            phase_name = phase.get('phase', f'Phase {i}') if isinstance(phase, dict) else phase
            steps = phase.get('steps', []) if isinstance(phase, dict) else []
            content += f"### {phase_name}\n"
            for step in steps:
                content += f"- {step}\n"
            content += "\n"

        content += "## Critical Considerations\n\n"
        for key, value in critical_considerations.items():
            content += f"### {key.replace('_', ' ').title()}\n{value}\n\n"

        content += "## Estimated Complexity\n\n"
        content += f"- Files to create: {estimated_complexity.get('files_to_create', 'N/A')}\n"
        content += f"- Files to modify: {estimated_complexity.get('files_to_modify', 'N/A')}\n"
        content += f"- Testing effort: {estimated_complexity.get('testing_effort', 'N/A')}\n"

        path.write_text(content, encoding="utf-8")

    def _write_research_file(self, path: Path, is_part: bool = False):
        """Write 01-research.md with Context7 research and patterns

        Note: EXTEND/CHANGE are handled by _append_to_existing() and never reach here.
        """
        if self.mode == "UPDATE_AFTER_DEBUG":
            content = self._generate_update_after_debug_research()
        elif self.mode == "UPDATE_PLAN":
            content = self._generate_update_plan_research()
        else:  # NEW FEATURE only (EXTEND/CHANGE use append)
            content = self._generate_feature_research()

        path.write_text(content, encoding="utf-8")

    def _write_combined_intent_with_parts(self, path: Path):
        """Write 01-intent.md with all parts as sections (single file model)"""
        intent = self.data.get("intent_summary", "")
        intent_data = self.data.get("intent", {})
        parts = self.data.get("parts", [])
        testable_reqs = intent_data.get("testable_requirements", [])

        # Count total requirements including part requirements
        total_reqs = len(testable_reqs)
        for part in parts:
            part_reqs = part.get("intent", {}).get("testable_requirements", [])
            total_reqs += len(part_reqs)

        # Calculate completed parts
        completed = sum(1 for s in parts if s.get("status") == "completed")

        content = f"""# {self.feature_name.replace('-', ' ').title()}

**Generated:** {datetime.now().strftime('%Y-%m-%d')}
**Complexity:** {self.complexity}/100
**Status:** {completed}/{len(parts)} parts complete

## Feature Overview

{intent}

## Parts

"""

        # Part summary with status markers
        for part in parts:
            number = part["number"]
            name = part["name"]
            status = part.get("status", "pending")
            deps = part.get("dependencies", [])
            part_reqs = part.get("intent", {}).get("testable_requirements", [])

            status_marker = self._get_status_marker(status)
            completed_date = f" ({part.get('completed_date', '')})" if status == "completed" else ""

            content += f"""### {status_marker} {number}-{name}{completed_date}
- Status: {status}
- Dependencies: {', '.join(deps) if deps else 'none'}
- Requirements: {len(part_reqs)}

"""

        # Overall feature requirements
        content += f"""---

## Feature Requirements

### Testable Requirements

{self._format_testable_requirements(testable_reqs)}

### Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

### Data Models

{intent_data.get('data_models', 'TBD')}

### UI Components

{intent_data.get('ui_components', 'TBD')}

### Authentication

{intent_data.get('auth', 'TBD')}

### Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

### Constraints

{intent_data.get('constraints', 'TBD')}

### Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

        # Individual part sections
        for part in parts:
            number = part["number"]
            name = part["name"]
            scope = part.get("scope", "")
            deps = part.get("dependencies", [])
            part_intent = part.get("intent", {})
            part_reqs = part_intent.get("testable_requirements", [])

            content += f"""
---

## Part: {number}-{name}

**Dependencies:** {', '.join(deps) if deps else 'none'}

### Scope

{scope}

### Testable Requirements

{self._format_testable_requirements(part_reqs)}

### Functional Requirements

{self._format_list(part_intent.get('requirements', []))}

### Data Models

{part_intent.get('data_models', 'TBD')}

### UI Components

{part_intent.get('ui_components', 'TBD')}

### Edge Cases

{self._format_list(part_intent.get('edge_cases', []))}

### Constraints

{part_intent.get('constraints', 'TBD')}

### Success Criteria

{self._format_list(part_intent.get('success_criteria', []))}
"""

        path.write_text(content, encoding="utf-8")

    def _write_combined_research_with_parts(self, path: Path):
        """Write 01-research.md with all parts as sections (single file model)"""
        research = self.data.get("research", {})
        parts = self.data.get("parts", [])

        content = f"""# Research: {self.feature_name.replace('-', ' ').title()}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

### API Usage
{research.get('api_usage', 'TBD')}

## Architecture & Setup

### Recommended Approach
{research.get('architecture', 'TBD')}

### Pattern Details
{research.get('pattern_details', 'TBD')}

### Database Schema
{research.get('schema', 'TBD')}

### Models
{research.get('models', 'TBD')}

### Routes & Controllers
{research.get('routes', 'TBD')}

### Setup Patterns
{research.get('setup', 'TBD')}

## Testing Strategy

### Test Types Needed
{research.get('testing', 'TBD')}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

{research.get('pitfalls', 'TBD')}

## Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
{self._format_context7_sources()}
"""

        # Individual part research sections
        for part in parts:
            number = part["number"]
            name = part["name"]
            part_research = part.get("research", {})
            architecture = part.get("architecture", "")
            setup = part.get("setup", "")
            testing = part.get("testing", "")

            content += f"""
---

## Part: {number}-{name}

### Framework Best Practices

#### Conventions
{part_research.get('conventions', 'TBD')}

#### Idioms & Patterns
{part_research.get('patterns', 'TBD')}

### Architecture & Setup

#### Recommended Approach
{architecture if architecture else 'TBD'}

#### Setup Patterns
{setup if setup else 'TBD'}

#### Database Schema
{part_research.get('schema', 'TBD')}

#### Models
{part_research.get('models', 'TBD')}

### Testing Strategy

#### Test Types Needed
{testing if testing else 'TBD'}

#### What to Test
{part_research.get('test_scenarios', 'TBD')}

#### How to Test
{part_research.get('test_approach', 'TBD')}

### Common Pitfalls & Edge Cases

{self._get_relevant_pitfalls(name)}
"""

        path.write_text(content, encoding="utf-8")

    def _get_status_marker(self, status: str) -> str:
        """Get status marker symbol for part status"""
        markers = {
            "pending": "○",
            "in_progress": "●",
            "completed": "✓",
            "blocked": "✗"
        }
        return markers.get(status, "○")

    def _write_parent_intent(self, path: Path):
        """Write parent overview 01-intent.md for feature with parts

        DEPRECATED: Use _write_combined_intent_with_parts instead.
        Kept for backwards compatibility with UPDATE modes.
        """
        intent = self.data.get("intent_summary", "")
        intent_data = self.data.get("intent", {})
        parts = self.data.get("parts", [])
        testable_reqs = intent_data.get("testable_requirements", [])

        content = f"""# {self.feature_name.replace('-', ' ').title()}

**Generated:** {datetime.now().strftime('%Y-%m-%d')}
**Task Type:** {self.task_type}
**Complexity:** {self.complexity}/100 (decomposed into {len(parts)} parts)
**Requirements:** {len(testable_reqs)} testable

## User Request

{intent}

## Testable Requirements

{self._format_testable_requirements(testable_reqs)}

## Parts

This feature is split into {len(parts)} parts due to complexity:

"""

        for part in parts:
            number = part["number"]
            name = part["name"]
            scope = part.get("scope", "")
            content += f"""### {number}-{name}
{scope}

"""

        content += f"""## Dependencies

{self._format_dependencies()}

## Implementation Order

"""

        for i, part in enumerate(parts, 1):
            number = part["number"]
            name = part["name"]
            deps = part.get("dependencies", [])
            deps_str = f" (requires: {', '.join(deps)})" if deps else " (no dependencies)"
            content += f"{i}. {number}-{name}{deps_str}\n"

        # Add intent-specific sections
        content += f"""

## Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

## Data Models

{intent_data.get('data_models', 'TBD')}

## UI Components

{intent_data.get('ui_components', 'TBD')}

## Authentication

{intent_data.get('auth', 'TBD')}

## Constraints

{intent_data.get('constraints', 'TBD')}

## Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

        path.write_text(content, encoding="utf-8")

    def _write_parent_research(self, path: Path):
        """Write parent overview 01-research.md for feature with parts

        DEPRECATED: Use _write_combined_research_with_parts instead.
        Kept for backwards compatibility with UPDATE modes.
        """
        research = self.data.get("research", {})

        content = f"""# Research: {self.feature_name.replace('-', ' ').title()}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

### API Usage
{research.get('api_usage', 'TBD')}

## Architecture & Setup

### Recommended Approach
{research.get('architecture', 'TBD')}

### Pattern Details
{research.get('pattern_details', 'TBD')}

### Database Schema
{research.get('schema', 'TBD')}

### Models
{research.get('models', 'TBD')}

### Routes & Controllers
{research.get('routes', 'TBD')}

## Testing Strategy

### Test Types Needed
{research.get('testing', 'TBD')}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

{research.get('pitfalls', 'TBD')}

## Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
{self._format_context7_sources()}
"""

        path.write_text(content, encoding="utf-8")

    def _write_part_intent(self, path: Path, part: Dict):
        """Write 01-intent.md for individual part

        DEPRECATED: No longer used - parts are now sections in main 01-intent.md.
        Kept for backwards compatibility with existing part folders.
        """
        number = part["number"]
        name = part["name"]
        scope = part.get("scope", "")
        dependencies = part.get("dependencies", [])
        intent_data = part.get("intent", {})
        testable_reqs = intent_data.get("testable_requirements", [])

        content = f"""# {name.replace('-', ' ').title()}

**Generated:** {datetime.now().strftime('%Y-%m-%d')}
**Part of:** {self.feature_name}
**Part:** {number} of {len(self.data.get("parts", []))}
**Dependencies:** {', '.join(dependencies) if dependencies else 'none'}
**Requirements:** {len(testable_reqs)} testable

## Task Type

{self.task_type}

## User Request

{scope}

## Testable Requirements

{self._format_testable_requirements(testable_reqs)}

## Scope

This part covers:
{self._format_list(scope.split('\n') if scope else [])}

## Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

## Data Models

{intent_data.get('data_models', 'TBD')}

## UI Components

{intent_data.get('ui_components', 'TBD')}

## Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

## Constraints

{intent_data.get('constraints', 'TBD')}

## Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

        path.write_text(content, encoding="utf-8")

    def _write_part_research(self, path: Path, part: Dict):
        """Write 01-research.md for individual part

        DEPRECATED: No longer used - parts are now sections in main 01-research.md.
        Kept for backwards compatibility with existing part folders.
        """
        name = part["name"]
        architecture = part.get("architecture", "")
        setup = part.get("setup", "")
        testing = part.get("testing", "")
        research = part.get("research", {})

        content = f"""# Research: {name.replace('-', ' ').title()}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

## Architecture & Setup

### Recommended Approach
{architecture if architecture else 'TBD'}

### Setup Patterns
{setup if setup else 'TBD'}

### Database Schema
{research.get('schema', 'TBD')}

### Models
{research.get('models', 'TBD')}

## Testing Strategy

### Test Types Needed
{testing if testing else 'TBD'}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

{self._get_relevant_pitfalls(name)}

## Context7 Sources

{self._format_context7_sources()}
"""

        path.write_text(content, encoding="utf-8")

    def _generate_feature_intent(self) -> str:
        """Generate 01-intent.md for new feature"""
        intent = self.data.get("intent_summary", "")
        intent_data = self.data.get("intent", {})
        testable_reqs = intent_data.get("testable_requirements", [])

        return f"""# {self.feature_name.replace('-', ' ').title()}

**Generated:** {datetime.now().strftime('%Y-%m-%d')}
**Task Type:** FEATURE
**Complexity:** {self.complexity}/100
**Requirements:** {len(testable_reqs)} testable

## User Request

{intent}

## Testable Requirements

{self._format_testable_requirements(testable_reqs)}

## Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

## Data Models

{intent_data.get('data_models', 'TBD')}

## UI Components

{intent_data.get('ui_components', 'TBD')}

## Interactions

{intent_data.get('interactions', 'TBD')}

## Authentication

{intent_data.get('auth', 'TBD')}

## Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

## Constraints

{intent_data.get('constraints', 'TBD')}

## Validation Rules

{self._format_list(intent_data.get('validation', []))}

## Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

    def _generate_feature_research(self) -> str:
        """Generate 01-research.md for new feature"""
        research = self.data.get("research", {})

        return f"""# Research: {self.feature_name.replace('-', ' ').title()}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

### API Usage
{research.get('api_usage', 'TBD')}

## Architecture & Setup

### Recommended Approach
{research.get('architecture', 'TBD')}

### Pattern Details
{research.get('pattern_details', 'TBD')}

### Database Schema
{research.get('schema', 'TBD')}

### Models
{research.get('models', 'TBD')}

### Routes & Controllers
{research.get('routes', 'TBD')}

### Setup Patterns
{research.get('setup', 'TBD')}

## Testing Strategy

### Test Types Needed
{research.get('testing', 'TBD')}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

{research.get('pitfalls', 'TBD')}

## Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
{self._format_context7_sources()}
"""

    # Note: _generate_extend_change_intent and _generate_extend_change_research
    # were removed because EXTEND/CHANGE now use _append_to_existing() which
    # appends sections to existing files instead of creating new ones.

    def _generate_update_after_debug_intent(self) -> str:
        """Generate 01-intent.md after debug - includes debug history"""
        debug_history = self.data.get("debug_history", {})
        intent = self.data.get("intent_summary", "")
        intent_data = self.data.get("intent", {})
        testable_reqs = intent_data.get("testable_requirements", [])

        return f"""# {self.feature_name.replace('-', ' ').title()}

**Revised:** {datetime.now().strftime('%Y-%m-%d')}
**Reason:** Revision after debug attempts
**Original approach:** {debug_history.get('failed_approach', 'TBD')}
**Requirements:** {len(testable_reqs)} testable

## Debug History - Failed Implementation Attempt

{debug_history.get('summary', 'TBD')}

### Failure Reason
{debug_history.get('failure_reason', 'TBD')}

### Learnings
{debug_history.get('learnings', 'TBD')}

## User Request

{intent}

## Testable Requirements

{self._format_testable_requirements(testable_reqs)}

## Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

## Data Models

{intent_data.get('data_models', 'TBD')}

## UI Components

{intent_data.get('ui_components', 'TBD')}

## Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

## Constraints

{intent_data.get('constraints', 'TBD')}

## Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

    def _generate_update_after_debug_research(self) -> str:
        """Generate 01-research.md after debug - revised approach"""
        debug_history = self.data.get("debug_history", {})
        research = self.data.get("research", {})

        return f"""# Research: {self.feature_name.replace('-', ' ').title()} (REVISED)

**New approach:** {research.get('architecture', 'TBD')}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

## Architecture & Setup (REVISED)

Based on debug attempts that showed {debug_history.get('failure_reason', 'issues')}, using alternative approach:

### Recommended Approach
{research.get('architecture', 'TBD')}

### Pattern Details
{research.get('pattern_details', 'TBD')}

### Setup Patterns
{research.get('setup', 'TBD')}

## Testing Strategy

### Test Types Needed
{research.get('testing', 'TBD')}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

Learnings from debug attempts:
{debug_history.get('learnings', 'TBD')}

Additional pitfalls:
{research.get('pitfalls', 'TBD')}

## Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
{self._format_context7_sources()}
"""

    def _generate_update_plan_intent(self) -> str:
        """Generate updated 01-intent.md for plan changes"""
        changes = self.data.get("changes_requested", "")
        intent = self.data.get("intent_summary", "")
        intent_data = self.data.get("intent", {})
        testable_reqs = intent_data.get("testable_requirements", [])

        return f"""# {self.feature_name.replace('-', ' ').title()}

**Updated:** {datetime.now().strftime('%Y-%m-%d')}
**Changes:** {changes}
**Requirements:** {len(testable_reqs)} testable

## User Request

{intent}

## Testable Requirements

{self._format_testable_requirements(testable_reqs)}

## Functional Requirements

{self._format_list(intent_data.get('requirements', []))}

## Data Models

{intent_data.get('data_models', 'TBD')}

## UI Components

{intent_data.get('ui_components', 'TBD')}

## Edge Cases

{self._format_list(intent_data.get('edge_cases', []))}

## Constraints

{intent_data.get('constraints', 'TBD')}

## Success Criteria

{self._format_list(intent_data.get('success_criteria', []))}
"""

    def _generate_update_plan_research(self) -> str:
        """Generate updated 01-research.md for plan changes"""
        research = self.data.get("research", {})

        return f"""# Research: {self.feature_name.replace('-', ' ').title()}

## Framework Best Practices

### Conventions
{research.get('conventions', 'TBD')}

### Idioms & Patterns
{research.get('patterns', 'TBD')}

## Architecture & Setup

### Recommended Approach
{research.get('architecture', 'TBD')}

### Pattern Details
{research.get('pattern_details', 'TBD')}

### Setup Patterns
{research.get('setup', 'TBD')}

## Testing Strategy

### Test Types Needed
{research.get('testing', 'TBD')}

### What to Test
{research.get('test_scenarios', 'TBD')}

### How to Test
{research.get('test_approach', 'TBD')}

## Common Pitfalls & Edge Cases

{research.get('pitfalls', 'TBD')}

## Context7 Sources

Coverage: {research.get('coverage', {}).get('overall', 0)}%
{self._format_context7_sources()}
"""

    def _format_dependencies(self) -> str:
        """Format dependencies list"""
        parts = self.data.get("parts", [])
        if not parts:
            return "None"

        deps_text = ""
        for part in parts:
            deps = part.get("dependencies", [])
            if deps:
                deps_text += f"- {part['number']}-{part['name']}: Requires {', '.join(deps)}\n"

        return deps_text if deps_text else "All parts can be implemented independently"

    def _format_list(self, items: List[str]) -> str:
        """Format list as markdown bullets"""
        if not items:
            return "- TBD"
        return "\n".join(f"- {item.strip()}" for item in items if item.strip())

    def _format_testable_requirements(self, requirements: List[Dict]) -> str:
        """Format testable requirements as markdown table"""
        if not requirements:
            return "No requirements defined yet."

        # Group by category
        categories = {}
        for req in requirements:
            cat = req.get("category", "core")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(req)

        output = ""
        category_order = ["core", "api", "ui", "integration", "edge_case"]

        for cat in category_order:
            if cat not in categories:
                continue

            cat_reqs = categories[cat]
            cat_label = cat.replace("_", " ").title()
            output += f"### {cat_label} Requirements ({len(cat_reqs)})\n\n"
            output += "| ID | Description | Test Type | Status |\n"
            output += "|----|-------------|-----------|--------|\n"

            for req in cat_reqs:
                req_id = req.get("id", "REQ-???")
                desc = req.get("description", "TBD")
                test_type = req.get("test_type", "manual")
                passes = req.get("passes", False)
                status = "✓" if passes else "○"
                output += f"| {req_id} | {desc} | {test_type} | {status} |\n"

            output += "\n"

        return output

    def _get_relevant_pitfalls(self, part_name: str) -> str:
        """Get relevant pitfalls for specific part"""
        research = self.data.get("research", {})
        pitfalls = research.get("pitfalls", "")

        # In a more sophisticated version, filter pitfalls by part
        # For now, return all
        return pitfalls if pitfalls else "TBD"

    def _format_context7_sources(self) -> str:
        """Format Context7 sources"""
        research = self.data.get("research", {})
        coverage = research.get("coverage", {})

        sources = []
        for key, value in coverage.items():
            if key != "overall":
                sources.append(f"- {key}: {value}%")

        return "\n".join(sources) if sources else "TBD"


def main():
    parser = argparse.ArgumentParser(description="Generate output folders and files for /1-plan skill")
    parser.add_argument("--input", required=True, help="Input JSON file path")
    parser.add_argument("--output-summary", required=True, help="Output summary JSON file path")
    parser.add_argument("--mode", help="Override mode (NEW, update)")
    parser.add_argument("--existing-context", help="Path to existing context file (for updates)")

    args = parser.parse_args()

    # Load input data
    try:
        with open(args.input, 'r', encoding='utf-8') as f:
            input_data = json.load(f)
    except Exception as e:
        print(f"Error loading input file: {e}", file=sys.stderr)
        sys.exit(1)

    # Override mode if specified
    if args.mode:
        input_data["mode"] = args.mode.upper()

    # Generate output
    generator = OutputGenerator(input_data)
    result = generator.generate()

    # Write summary
    try:
        with open(args.output_summary, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        print(f"Error writing output summary: {e}", file=sys.stderr)
        sys.exit(1)

    # Print result
    if result["success"]:
        print(f"✅ Successfully generated output")
        print(f"   Created {len(result['created_folders'])} folders")
        print(f"   Created {len(result['created_files'])} files")
    else:
        print(f"❌ Error: {result.get('error', 'Unknown error')}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
