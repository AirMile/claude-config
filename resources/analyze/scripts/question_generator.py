#!/usr/bin/env python3
"""
Generate smart questions based on analysis findings for interactive plan improvement.

Usage:
    python3 question_generator.py --analysis path/to/01-analysis.md
"""

import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple


class QuestionGenerator:
    """Generates targeted questions based on analysis findings."""

    def __init__(self, analysis_content: str):
        self.analysis_content = analysis_content
        self.questions = []

        # Parse analysis sections
        self.devils_advocate = self._extract_section("Devil's Advocate Analysis")
        self.assumptions = self._extract_section("Assumption Testing")
        self.alternatives = self._extract_section("Alternative Approaches")
        self.simplification = self._extract_section("Simplification Analysis")

        # Extract confidence score
        self.confidence = self._extract_confidence()

    def _extract_section(self, section_name: str) -> str:
        """Extract a specific section from the analysis."""
        pattern = rf"## {section_name}.*?(?=\n---|\n##|\Z)"
        match = re.search(pattern, self.analysis_content, re.DOTALL)
        return match.group(0) if match else ""

    def _extract_confidence(self) -> int:
        """Extract confidence score from analysis."""
        pattern = r"\*\*Confidence Score:\*\* (\d+)/10"
        match = re.search(pattern, self.analysis_content)
        return int(match.group(1)) if match else 5

    def generate_questions(self) -> List[Dict]:
        """Generate all questions based on findings."""
        questions = []

        # Generate questions from each technique
        questions.extend(self._generate_devils_advocate_questions())
        questions.extend(self._generate_assumption_questions())
        questions.extend(self._generate_alternative_questions())
        questions.extend(self._generate_simplification_questions())

        # Prioritize questions based on confidence and impact
        return self._prioritize_questions(questions)

    def _generate_devils_advocate_questions(self) -> List[Dict]:
        """Generate questions from Devil's Advocate findings."""
        questions = []

        # Check for security concerns
        if "security" in self.devils_advocate.lower() or "auth" in self.devils_advocate.lower():
            questions.append({
                "category": "security",
                "priority": "high",
                "question": "Security concern identified in authentication. How should we address this?",
                "header": "Auth Security",
                "options": [
                    {"label": "Laravel Breeze", "description": "Simple, proven authentication with minimal setup"},
                    {"label": "OAuth2", "description": "Industry standard, more complex but very secure"},
                    {"label": "Custom + 2FA", "description": "Keep custom implementation but add two-factor authentication"},
                    {"label": "Document risks", "description": "Keep current plan but add detailed security documentation"}
                ],
                "multiSelect": False
            })

        # Check for payment concerns
        if "payment" in self.devils_advocate.lower() or "transaction" in self.devils_advocate.lower():
            questions.append({
                "category": "payment",
                "priority": "high",
                "question": "Payment processing complexity identified. Which approach do you prefer?",
                "header": "Payments",
                "options": [
                    {"label": "Stripe Checkout", "description": "Simple hosted solution, minimal PCI compliance needed"},
                    {"label": "Stripe API", "description": "More control but requires PCI compliance"},
                    {"label": "PayPal", "description": "Widely accepted, good for international"},
                    {"label": "Manual first", "description": "Start with manual processing, automate later"}
                ],
                "multiSelect": False
            })

        # Check for complexity concerns
        if "complex" in self.devils_advocate.lower() or "complicated" in self.devils_advocate.lower():
            questions.append({
                "category": "complexity",
                "priority": "medium",
                "question": "High complexity detected. How should we manage this?",
                "header": "Complexity",
                "options": [
                    {"label": "Simplify now", "description": "Remove non-essential features before starting"},
                    {"label": "Phase delivery", "description": "Break into phases with incremental releases"},
                    {"label": "Accept complexity", "description": "Proceed with full scope but allocate more time"}
                ],
                "multiSelect": False
            })

        return questions

    def _generate_assumption_questions(self) -> List[Dict]:
        """Generate questions from Assumption Testing findings."""
        questions = []

        # Email assumption
        if "email" in self.assumptions.lower():
            questions.append({
                "category": "assumption",
                "priority": "medium",
                "question": "You're assuming all users have valid email. How to handle this?",
                "header": "Email",
                "options": [
                    {"label": "Require verification", "description": "Email verification required on signup"},
                    {"label": "Phone alternative", "description": "Allow phone number as alternative"},
                    {"label": "Make optional", "description": "Email optional, use username instead"},
                    {"label": "Document requirement", "description": "Make email a documented requirement"}
                ],
                "multiSelect": False
            })

        # Network/connectivity assumption
        if "network" in self.assumptions.lower() or "connectivity" in self.assumptions.lower():
            questions.append({
                "category": "assumption",
                "priority": "low",
                "question": "Assuming stable network connectivity. Need offline support?",
                "header": "Offline",
                "options": [
                    {"label": "Full offline", "description": "Complete offline mode with sync"},
                    {"label": "Basic caching", "description": "Cache critical data only"},
                    {"label": "Online only", "description": "Require internet connection"},
                    {"label": "Progressive", "description": "Start online-only, add offline later"}
                ],
                "multiSelect": False
            })

        # Performance assumption
        if "performance" in self.assumptions.lower() or "load" in self.assumptions.lower():
            questions.append({
                "category": "assumption",
                "priority": "medium",
                "question": "Performance requirements unclear. Expected load?",
                "header": "Load",
                "options": [
                    {"label": "< 100 users", "description": "Small scale, simple infrastructure"},
                    {"label": "100-1000 users", "description": "Medium scale, need caching"},
                    {"label": "1000+ users", "description": "Large scale, need scaling strategy"},
                    {"label": "Variable", "description": "Design for elastic scaling"}
                ],
                "multiSelect": False
            })

        return questions

    def _generate_alternative_questions(self) -> List[Dict]:
        """Generate questions from Alternative Approaches findings."""
        questions = []

        # Custom vs library
        if "custom" in self.alternatives.lower() and "library" in self.alternatives.lower():
            questions.append({
                "category": "alternative",
                "priority": "high",
                "question": "Custom implementation vs existing library?",
                "header": "Implementation",
                "options": [
                    {"label": "Use library", "description": "Faster implementation, proven solution"},
                    {"label": "Custom minimal", "description": "Custom but only essential features"},
                    {"label": "Custom full", "description": "Full custom implementation as planned"},
                    {"label": "Hybrid", "description": "Library with custom extensions"}
                ],
                "multiSelect": False
            })

        # Technology choices
        if "oauth" in self.alternatives.lower() or "breeze" in self.alternatives.lower():
            questions.append({
                "category": "alternative",
                "priority": "medium",
                "question": "Authentication implementation preference?",
                "header": "Auth Method",
                "options": [
                    {"label": "Laravel Breeze", "description": "Simple, fast to implement"},
                    {"label": "Laravel Jetstream", "description": "More features, teams support"},
                    {"label": "Custom OAuth", "description": "Full control, more work"},
                    {"label": "Socialite only", "description": "Social logins only"}
                ],
                "multiSelect": False
            })

        return questions

    def _generate_simplification_questions(self) -> List[Dict]:
        """Generate questions from Simplification Analysis."""
        questions = []

        # Real-time features
        if "real-time" in self.simplification.lower() or "realtime" in self.simplification.lower():
            questions.append({
                "category": "simplification",
                "priority": "high",
                "question": "Real-time features add complexity. When needed?",
                "header": "Real-time",
                "options": [
                    {"label": "MVP essential", "description": "Must have from day one"},
                    {"label": "Phase 2", "description": "Add after initial launch"},
                    {"label": "Use polling", "description": "Simulate with periodic updates"},
                    {"label": "Not needed", "description": "Remove this requirement"}
                ],
                "multiSelect": False
            })

        # Multi-tenancy
        if "multi-tenant" in self.simplification.lower() or "tenancy" in self.simplification.lower():
            questions.append({
                "category": "simplification",
                "priority": "medium",
                "question": "Multi-tenancy adds significant complexity. When to implement?",
                "header": "Multi-tenant",
                "options": [
                    {"label": "From start", "description": "Design for multi-tenancy now"},
                    {"label": "Single first", "description": "Single tenant MVP, multi later"},
                    {"label": "Separate DBs", "description": "Use database-per-tenant approach"},
                    {"label": "Not needed", "description": "Single tenant is sufficient"}
                ],
                "multiSelect": False
            })

        # Reporting features
        if "report" in self.simplification.lower() or "analytics" in self.simplification.lower():
            questions.append({
                "category": "simplification",
                "priority": "low",
                "question": "Complex reporting identified. What level is needed?",
                "header": "Reporting",
                "options": [
                    {"label": "Full analytics", "description": "Complete dashboard with charts"},
                    {"label": "Basic stats", "description": "Simple counts and summaries"},
                    {"label": "Export only", "description": "CSV export, analyze externally"},
                    {"label": "Defer", "description": "No reporting in MVP"}
                ],
                "multiSelect": False
            })

        return questions

    def _prioritize_questions(self, questions: List[Dict]) -> List[Dict]:
        """Prioritize and limit questions to avoid overwhelming user."""
        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        questions.sort(key=lambda q: priority_order.get(q.get("priority", "low"), 3))

        # Group into batches
        batches = []
        current_batch = []

        for question in questions:
            current_batch.append(question)
            if len(current_batch) >= 3:
                batches.append(current_batch)
                current_batch = []

        if current_batch:
            batches.append(current_batch)

        # Return all questions but marked with batch numbers
        for i, batch in enumerate(batches):
            for question in batch:
                question["batch"] = i + 1

        return [q for batch in batches for q in batch]

    def generate_followup_questions(self, answers: Dict) -> List[Dict]:
        """Generate follow-up questions based on initial answers."""
        followups = []

        # If user chose to simplify, ask about specific simplifications
        if any("simplify" in str(answer).lower() for answer in answers.values()):
            followups.append({
                "category": "followup",
                "priority": "high",
                "question": "Which features should we remove or defer?",
                "header": "Features",
                "options": [
                    {"label": "Advanced UI", "description": "Complex interactions, animations"},
                    {"label": "Integrations", "description": "Third-party service connections"},
                    {"label": "Automation", "description": "Background jobs, scheduled tasks"},
                    {"label": "Analytics", "description": "Reporting and dashboards"}
                ],
                "multiSelect": True  # Allow multiple selections
            })

        # If user chose phased delivery, ask about phases
        if any("phase" in str(answer).lower() for answer in answers.values()):
            followups.append({
                "category": "followup",
                "priority": "high",
                "question": "How should we structure the phases?",
                "header": "Phases",
                "options": [
                    {"label": "2 phases", "description": "MVP + Enhanced"},
                    {"label": "3 phases", "description": "Core + Features + Polish"},
                    {"label": "4+ phases", "description": "Gradual weekly releases"},
                    {"label": "Continuous", "description": "Deploy as features complete"}
                ],
                "multiSelect": False
            })

        return followups

    def format_for_claude(self, questions: List[Dict]) -> Dict:
        """Format questions for AskUserQuestion tool."""
        # Get first batch only
        batch_1 = [q for q in questions if q.get("batch", 1) == 1]

        formatted = {
            "questions": []
        }

        for q in batch_1[:4]:  # Max 4 questions per call
            formatted_q = {
                "question": q["question"],
                "header": q["header"],
                "options": q["options"][:4],  # Max 4 options
                "multiSelect": q.get("multiSelect", False)
            }
            formatted["questions"].append(formatted_q)

        return formatted

    def export_questions(self, output_path: Path):
        """Export questions to JSON file."""
        questions = self.generate_questions()

        export_data = {
            "confidence": self.confidence,
            "total_questions": len(questions),
            "batches": max(q.get("batch", 1) for q in questions) if questions else 0,
            "questions": questions
        }

        output_path.write_text(json.dumps(export_data, indent=2), encoding='utf-8')


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Generate questions from analysis')
    parser.add_argument('--analysis', required=True, help='Path to 01-analysis.md')
    parser.add_argument('--output', help='Output JSON file (optional)')
    parser.add_argument('--format', choices=['json', 'claude'], default='claude',
                      help='Output format')
    args = parser.parse_args()

    # Read analysis file
    analysis_path = Path(args.analysis)
    if not analysis_path.exists():
        print(f"Error: Analysis file not found: {analysis_path}", file=sys.stderr)
        sys.exit(1)

    analysis_content = analysis_path.read_text(encoding='utf-8')

    # Generate questions
    generator = QuestionGenerator(analysis_content)
    questions = generator.generate_questions()

    if args.format == 'claude':
        # Format for Claude's AskUserQuestion tool
        formatted = generator.format_for_claude(questions)
        print(json.dumps(formatted, indent=2))
    else:
        # Export all questions
        if args.output:
            output_path = Path(args.output)
            generator.export_questions(output_path)
            print(f"✅ Questions exported to: {output_path}")
        else:
            # Print to stdout
            print(json.dumps(questions, indent=2))

    # Print summary
    if questions:
        print(f"\n📋 Generated {len(questions)} questions", file=sys.stderr)
        print(f"   Confidence: {generator.confidence}/10", file=sys.stderr)
        print(f"   Batches: {max(q.get('batch', 1) for q in questions)}", file=sys.stderr)

    return 0


if __name__ == '__main__':
    sys.exit(main())