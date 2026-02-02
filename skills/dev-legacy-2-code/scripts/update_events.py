#!/usr/bin/env python3
"""
Generate event/listener flow diagram for Laravel.
Scans app/Events/ and app/Providers/EventServiceProvider.php
Outputs to docs/events.mmd as Mermaid diagram.
"""

import os
import sys
import re
from datetime import datetime


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def scan_events(events_dir):
    """
    Scan Events directory for event classes.

    Returns:
        list: ["UserRegistered", "PostCreated", ...]
    """
    if not os.path.exists(events_dir):
        return []

    events = []

    for file in os.listdir(events_dir):
        if not file.endswith('.php'):
            continue

        filepath = os.path.join(events_dir, file)

        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract class name
        class_match = re.search(r'class\s+(\w+)', content)
        if class_match:
            events.append(class_match.group(1))

    return events


def scan_event_service_provider(provider_path):
    """
    Scan EventServiceProvider for event → listener mappings.

    Returns:
        dict: {
            "UserRegistered": ["SendWelcomeEmail", "CreateUserProfile"],
            "PostCreated": ["NotifySubscribers"]
        }
    """
    if not os.path.exists(provider_path):
        return {}

    with open(provider_path, 'r', encoding='utf-8') as f:
        content = f.read()

    mappings = {}

    # Find $listen array
    listen_match = re.search(
        r'\$listen\s*=\s*\[(.*?)\];',
        content,
        re.DOTALL
    )

    if not listen_match:
        return mappings

    listen_content = listen_match.group(1)

    # Extract event => [listeners] pairs
    # Pattern: EventClass::class => [ ListenerClass::class, ...]
    event_pattern = r'(\w+)::class\s*=>\s*\[(.*?)\]'

    for event_match in re.finditer(event_pattern, listen_content, re.DOTALL):
        event_name = event_match.group(1)
        listeners_block = event_match.group(2)

        listeners = []
        listener_matches = re.findall(r'(\w+)::class', listeners_block)
        listeners = listener_matches

        if listeners:
            mappings[event_name] = listeners

    return mappings


def generate_mermaid_diagram(events, mappings):
    """Generate Mermaid flowchart from events and listeners."""
    date = get_current_date()

    diagram = f"""---
title: Events & Listeners Flow
---
graph LR
    %% Events
"""

    # Add event nodes
    for event in events:
        diagram += f"    {event}[{event} Event]\n"

    diagram += "\n    %% Listeners\n"

    # Collect all unique listeners
    all_listeners = set()
    for listeners in mappings.values():
        all_listeners.update(listeners)

    for listener in sorted(all_listeners):
        diagram += f"    {listener}[{listener} Listener]\n"

    diagram += "\n    %% Event → Listener connections\n"

    for event, listeners in mappings.items():
        for listener in listeners:
            diagram += f"    {event} --> {listener}\n"

    # Styling
    diagram += f"""
    %% Styling
    classDef event fill:#3B82F6,stroke:#1E40AF,color:#fff
    classDef listener fill:#10B981,stroke:#059669,color:#fff

    class {','.join(events)} event
    class {','.join(sorted(all_listeners))} listener

%% Legend:
%% Blue = Events
%% Green = Listeners

%% Generated: {date}
%% Auto-updated by /2-code skill
"""

    return diagram


def update_events(root_path=None):
    """Update events documentation."""
    if root_path is None:
        root_path = os.getcwd()

    print(f"Scanning Laravel events in {root_path}...")

    # Scan events directory
    events_dir = os.path.join(root_path, 'app', 'Events')
    events = scan_events(events_dir)
    print(f"  Found {len(events)} events")

    # Scan EventServiceProvider
    provider_path = os.path.join(root_path, 'app', 'Providers', 'EventServiceProvider.php')
    mappings = scan_event_service_provider(provider_path)
    print(f"  Found {len(mappings)} event→listener mappings")

    if not events and not mappings:
        print("No events found. Skipping events diagram generation.")
        return False

    # Generate Mermaid diagram
    diagram = generate_mermaid_diagram(events, mappings)

    # Create docs folder
    docs_dir = os.path.join(root_path, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    # Write to docs/events.mmd
    events_path = os.path.join(docs_dir, 'events.mmd')
    with open(events_path, 'w', encoding='utf-8') as f:
        f.write(diagram)

    print(f"✓ Generated docs/events.mmd")
    print(f"  Events: {len(events)}")
    print(f"  Listeners: {sum(len(l) for l in mappings.values())}")

    return True


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    try:
        success = update_events(root_path)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error updating events diagram: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
