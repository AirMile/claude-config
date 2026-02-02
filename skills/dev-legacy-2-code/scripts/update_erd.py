#!/usr/bin/env python3
"""
Update ERD (Entity Relationship Diagram) in Mermaid format.
Scans database models/migrations and generates erd.mmd file.
"""

import os
import sys
import re
from pathlib import Path
from datetime import datetime


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def scan_laravel_models(root_path):
    """
    Scan Laravel models to extract entities and relationships.
    Returns dict with entities and their attributes/relationships.
    """
    entities = {}

    models_path = os.path.join(root_path, 'app', 'Models')

    if not os.path.exists(models_path):
        print(f"Models directory not found at {models_path}")
        return entities

    for file in os.listdir(models_path):
        if not file.endswith('.php'):
            continue

        file_path = os.path.join(models_path, file)
        entity_name = file.replace('.php', '')

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        entities[entity_name] = {
            'attributes': extract_attributes(content),
            'relationships': extract_relationships(content, entity_name)
        }

    return entities


def extract_attributes(content):
    """Extract fillable/casts attributes from model content."""
    attributes = []

    # Extract fillable attributes
    fillable_match = re.search(r'\$fillable\s*=\s*\[(.*?)\]', content, re.DOTALL)
    if fillable_match:
        fillable_content = fillable_match.group(1)
        # Extract quoted strings
        attrs = re.findall(r"['\"](\w+)['\"]", fillable_content)
        attributes.extend(attrs)

    # Extract casts (gives type hints)
    casts_match = re.search(r'\$casts\s*=\s*\[(.*?)\]', content, re.DOTALL)
    if casts_match:
        casts_content = casts_match.group(1)
        # Extract key => type pairs
        cast_pairs = re.findall(r"['\"](\w+)['\"]\s*=>\s*['\"](\w+)['\"]", casts_content)
        for attr, type_name in cast_pairs:
            if attr not in attributes:
                attributes.append(f"{attr} ({type_name})")

    return attributes


def extract_relationships(content, entity_name):
    """Extract relationships (hasMany, belongsTo, etc.) from model."""
    relationships = []

    # Pattern for relationships
    relationship_types = [
        ('hasMany', '1--*'),
        ('hasOne', '1--1'),
        ('belongsTo', '*--1'),
        ('belongsToMany', '*--*'),
        ('morphMany', '1--*'),
        ('morphTo', '*--1')
    ]

    for rel_type, cardinality in relationship_types:
        # Match: public function relationName(): HasMany
        pattern = rf'public\s+function\s+(\w+)\s*\([^)]*\)\s*:\s*{rel_type}'
        matches = re.finditer(pattern, content, re.IGNORECASE)

        for match in matches:
            relation_name = match.group(1)

            # Try to extract the related model
            # Look for return $this->hasMany(Model::class)
            return_pattern = rf'return\s+\$this->{rel_type}\s*\(\s*(\w+)::class'
            return_match = re.search(return_pattern, content[match.end():match.end()+200], re.IGNORECASE)

            if return_match:
                related_model = return_match.group(1)
                relationships.append({
                    'type': rel_type,
                    'name': relation_name,
                    'target': related_model,
                    'cardinality': cardinality
                })

    return relationships


def scan_migrations(root_path):
    """
    Scan Laravel migrations to extract table structures.
    Returns dict with tables and their columns.
    """
    tables = {}

    migrations_path = os.path.join(root_path, 'database', 'migrations')

    if not os.path.exists(migrations_path):
        print(f"Migrations directory not found at {migrations_path}")
        return tables

    for file in sorted(os.listdir(migrations_path)):
        if not file.endswith('.php'):
            continue

        file_path = os.path.join(migrations_path, file)

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract table name from Schema::create('table_name')
        create_match = re.search(r"Schema::create\(['\"](\w+)['\"]", content)
        if create_match:
            table_name = create_match.group(1)
            tables[table_name] = extract_columns_from_migration(content)

    return tables


def extract_columns_from_migration(content):
    """Extract column definitions from migration content."""
    columns = []

    # Common column types in Laravel migrations
    column_patterns = [
        r"\$table->id\(\)",
        r"\$table->(\w+)\(['\"](\w+)['\"]",
        r"\$table->(\w+)\(\)",
    ]

    for pattern in column_patterns:
        matches = re.finditer(pattern, content)
        for match in matches:
            if len(match.groups()) >= 2:
                col_type = match.group(1)
                col_name = match.group(2)
                columns.append(f"{col_name}: {col_type}")
            elif len(match.groups()) == 1:
                col_type = match.group(1)
                columns.append(f"{col_type}")
            else:
                # id() case
                columns.append("id: bigInteger")

    return columns[:10]  # Limit to first 10 columns


def generate_mermaid_erd(entities, tables):
    """Generate Mermaid ERD syntax from entities and relationships."""

    date = get_current_date()

    mermaid = f"""---
title: Entity Relationship Diagram
---
erDiagram
"""

    # Add entities with attributes
    for entity_name, entity_data in entities.items():
        # Convert singular model name to plural table name (simple pluralization)
        table_name = entity_name.lower() + 's'

        mermaid += f"\n  {entity_name} {{\n"

        # Use table columns if available, otherwise use model attributes
        if table_name in tables and tables[table_name]:
            for column in tables[table_name][:8]:  # Limit attributes
                mermaid += f"    string {column}\n"
        elif entity_data['attributes']:
            for attr in entity_data['attributes'][:8]:  # Limit attributes
                mermaid += f"    string {attr}\n"
        else:
            mermaid += f"    string id\n"

        mermaid += "  }\n"

    # Add relationships
    mermaid += "\n"
    for entity_name, entity_data in entities.items():
        for rel in entity_data['relationships']:
            target = rel['target']
            rel_type = rel['type']
            cardinality = rel['cardinality']

            # Mermaid relationship syntax
            # Entity1 ||--o{ Entity2 : "relationship"
            if cardinality == '1--*':
                symbol = '||--o{'
            elif cardinality == '1--1':
                symbol = '||--||'
            elif cardinality == '*--1':
                symbol = '}o--||'
            elif cardinality == '*--*':
                symbol = '}o--o{'
            else:
                symbol = '||--||'

            mermaid += f"  {entity_name} {symbol} {target} : \"{rel['name']}\"\n"

    # Add metadata comment
    mermaid += f"\n%% Generated: {date}\n"
    mermaid += f"%% Auto-updated by /2-code skill\n"

    return mermaid


def update_erd(root_path=None):
    """Update ERD file with current database structure."""
    if root_path is None:
        root_path = os.getcwd()

    print(f"Scanning database structure in {root_path}...")

    # Scan Laravel models
    entities = scan_laravel_models(root_path)

    # Scan migrations for table structure
    tables = scan_migrations(root_path)

    if not entities and not tables:
        print("No models or migrations found. Skipping ERD generation.")
        return False

    # Generate Mermaid ERD
    erd_content = generate_mermaid_erd(entities, tables)

    # Create docs folder if it doesn't exist
    docs_dir = os.path.join(root_path, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    # Write to docs/erd.mmd
    erd_path = os.path.join(docs_dir, 'erd.mmd')
    with open(erd_path, 'w', encoding='utf-8') as f:
        f.write(erd_content)

    print(f"✓ Updated docs/erd.mmd")
    print(f"  Entities: {len(entities)}")
    print(f"  Tables: {len(tables)}")

    return True


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    try:
        success = update_erd(root_path)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error updating ERD: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
