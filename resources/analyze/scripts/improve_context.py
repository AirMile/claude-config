#!/usr/bin/env python3
"""
Improve intent based on user answers to analysis questions.

Usage:
    python3 improve_context.py --context path/to/01-intent.md \
                               --analysis path/to/00-analysis.md \
                               --answers path/to/answers.json \
                               --output path/to/01-intent-improved.md
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


class ContextImprover:
    """Improves context based on user feedback to analysis questions."""

    def __init__(self, original_context: str, analysis_content: str, answers: Dict):
        self.original_context = original_context
        self.analysis_content = analysis_content
        self.answers = answers

        # Parse context sections
        self.sections = self._parse_sections(original_context)

        # Track improvements made
        self.improvements = []

    def _parse_sections(self, content: str) -> Dict[str, List[str]]:
        """Parse context into sections."""
        sections = {}
        current_section = None
        section_content = []

        for line in content.split('\n'):
            if line.startswith('## '):
                if current_section:
                    sections[current_section] = section_content
                current_section = line[3:].strip().upper()
                section_content = []
            elif current_section:
                section_content.append(line)

        if current_section:
            sections[current_section] = section_content

        return sections

    def apply_improvements(self) -> str:
        """Apply all improvements based on user answers."""
        # Process each answer
        for question_id, answer in self.answers.items():
            self._apply_improvement(question_id, answer)

        # Add new sections if needed
        self._add_assumptions_section()
        self._add_risk_mitigation_section()
        self._add_phasing_section()

        # Rebuild context
        return self._rebuild_context()

    def _apply_improvement(self, question_id: str, answer: str):
        """Apply a specific improvement based on an answer."""
        answer_lower = answer.lower()

        # Authentication improvements
        if "auth" in question_id.lower():
            if "breeze" in answer_lower:
                self._simplify_authentication("Laravel Breeze")
            elif "oauth" in answer_lower:
                self._upgrade_authentication("OAuth2")
            elif "2fa" in answer_lower:
                self._add_two_factor_auth()

        # Payment improvements
        elif "payment" in question_id.lower():
            if "stripe checkout" in answer_lower:
                self._simplify_payments("Stripe Checkout")
            elif "manual" in answer_lower:
                self._defer_payment_automation()

        # Complexity management
        elif "complex" in question_id.lower():
            if "simplify" in answer_lower:
                self._mark_features_for_simplification()
            elif "phase" in answer_lower:
                self._create_phased_delivery()
            elif "split" in answer_lower:
                self._add_decomposition_note()

        # Real-time features
        elif "real-time" in question_id.lower() or "realtime" in question_id.lower():
            if "phase 2" in answer_lower:
                self._defer_realtime_features()
            elif "polling" in answer_lower:
                self._replace_realtime_with_polling()
            elif "not needed" in answer_lower:
                self._remove_realtime_features()

        # Email handling
        elif "email" in question_id.lower():
            if "verification" in answer_lower:
                self._add_email_verification()
            elif "phone" in answer_lower:
                self._add_phone_alternative()
            elif "optional" in answer_lower:
                self._make_email_optional()

        # Multi-tenancy
        elif "tenant" in question_id.lower():
            if "single first" in answer_lower:
                self._defer_multitenancy()
            elif "separate" in answer_lower:
                self._use_database_per_tenant()

        # Reporting
        elif "report" in question_id.lower():
            if "basic" in answer_lower:
                self._simplify_reporting()
            elif "export" in answer_lower:
                self._replace_reporting_with_export()
            elif "defer" in answer_lower:
                self._defer_reporting()

    def _simplify_authentication(self, method: str):
        """Simplify authentication implementation."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'auth' in line.lower() or 'login' in line.lower():
                    if not line.strip().startswith('#'):
                        new_architecture.append(f"- {method} for authentication [SIMPLIFIED from custom]")
                        self.improvements.append(f"Simplified authentication to {method}")
                        continue
                new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _upgrade_authentication(self, method: str):
        """Upgrade authentication to more secure method."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'auth' in line.lower():
                    new_architecture.append(f"- {method} implementation [UPGRADED for security]")
                    self.improvements.append(f"Upgraded authentication to {method}")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _add_two_factor_auth(self):
        """Add two-factor authentication requirement."""
        if 'ARCHITECTURE' in self.sections:
            self.sections['ARCHITECTURE'].append("- Two-factor authentication (TOTP) [ADDED for security]")
            self.improvements.append("Added two-factor authentication")

    def _simplify_payments(self, provider: str):
        """Simplify payment processing."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'payment' in line.lower() or 'transaction' in line.lower():
                    new_architecture.append(f"- {provider} for payments [SIMPLIFIED]")
                    self.improvements.append(f"Simplified payments to {provider}")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _defer_payment_automation(self):
        """Defer payment automation to later phase."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'payment' in line.lower() and 'automat' in line.lower():
                    new_architecture.append("- Manual payment processing [DEFERRED: automation to Phase 2]")
                    self.improvements.append("Deferred payment automation to Phase 2")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _mark_features_for_simplification(self):
        """Mark complex features for simplification."""
        if 'SCOPE' not in self.sections:
            self.sections['SCOPE'] = []

        self.sections['SCOPE'].insert(0, "")
        self.sections['SCOPE'].insert(0, "**SIMPLIFICATION APPLIED**: Non-essential features marked for removal")
        self.improvements.append("Marked features for simplification")

    def _create_phased_delivery(self):
        """Create phased delivery plan."""
        self.sections['PHASES'] = [
            "",
            "### Phase 1 (MVP - 2 weeks)",
            "- Core functionality only",
            "- Basic user authentication",
            "- Essential CRUD operations",
            "",
            "### Phase 2 (Enhanced - 2 weeks)",
            "- Advanced features",
            "- Real-time updates",
            "- Analytics dashboard",
            "",
            "### Phase 3 (Polish - 1 week)",
            "- Performance optimization",
            "- UI/UX improvements",
            "- Additional integrations"
        ]
        self.improvements.append("Created phased delivery plan")

    def _add_decomposition_note(self):
        """Add note about simplifying or phasing the implementation."""
        if 'NOTES' not in self.sections:
            self.sections['NOTES'] = []

        self.sections['NOTES'].append("")
        self.sections['NOTES'].append("**RECOMMENDATION**: Consider simplifying scope or breaking into phases")
        self.improvements.append("Added recommendation to simplify or phase")

    def _defer_realtime_features(self):
        """Defer real-time features to Phase 2."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'real-time' in line.lower() or 'realtime' in line.lower() or 'websocket' in line.lower():
                    new_architecture.append(f"{line} [DEFERRED to Phase 2]")
                    self.improvements.append("Deferred real-time features to Phase 2")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _replace_realtime_with_polling(self):
        """Replace real-time with polling."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'real-time' in line.lower() or 'websocket' in line.lower():
                    new_architecture.append("- Polling every 30 seconds [SIMPLIFIED from real-time]")
                    self.improvements.append("Replaced real-time with polling")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _remove_realtime_features(self):
        """Remove real-time features entirely."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'real-time' not in line.lower() and 'websocket' not in line.lower():
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture
            self.improvements.append("Removed real-time features")

    def _add_email_verification(self):
        """Add email verification requirement."""
        if 'SETUP' not in self.sections:
            self.sections['SETUP'] = []

        self.sections['SETUP'].append("")
        self.sections['SETUP'].append("### Email Verification")
        self.sections['SETUP'].append("- Implement email verification on signup")
        self.sections['SETUP'].append("- Use Laravel's built-in email verification")
        self.improvements.append("Added email verification requirement")

    def _add_phone_alternative(self):
        """Add phone number as alternative to email."""
        if 'ARCHITECTURE' in self.sections:
            self.sections['ARCHITECTURE'].append("- Support phone number as alternative to email [ADDED]")
            self.improvements.append("Added phone number as email alternative")

    def _make_email_optional(self):
        """Make email optional."""
        if 'ARCHITECTURE' in self.sections:
            for i, line in enumerate(self.sections['ARCHITECTURE']):
                if 'email' in line.lower() and 'required' in line.lower():
                    self.sections['ARCHITECTURE'][i] = line.replace('required', 'optional')
            self.improvements.append("Made email optional")

    def _defer_multitenancy(self):
        """Defer multi-tenancy to later phase."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'tenant' in line.lower():
                    new_architecture.append(f"{line} [DEFERRED to future release]")
                    self.improvements.append("Deferred multi-tenancy")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _use_database_per_tenant(self):
        """Use database-per-tenant approach."""
        if 'ARCHITECTURE' in self.sections:
            for i, line in enumerate(self.sections['ARCHITECTURE']):
                if 'tenant' in line.lower():
                    self.sections['ARCHITECTURE'][i] = "- Database-per-tenant architecture [SIMPLIFIED]"
            self.improvements.append("Using database-per-tenant approach")

    def _simplify_reporting(self):
        """Simplify reporting to basic stats."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'report' in line.lower() or 'analytics' in line.lower():
                    new_architecture.append("- Basic statistics and counts [SIMPLIFIED from full analytics]")
                    self.improvements.append("Simplified reporting to basic stats")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _replace_reporting_with_export(self):
        """Replace reporting with CSV export."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'report' in line.lower() or 'analytics' in line.lower():
                    new_architecture.append("- CSV export for data analysis [SIMPLIFIED from dashboards]")
                    self.improvements.append("Replaced reporting with CSV export")
                else:
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture

    def _defer_reporting(self):
        """Defer all reporting features."""
        if 'ARCHITECTURE' in self.sections:
            architecture = self.sections['ARCHITECTURE']
            new_architecture = []

            for line in architecture:
                if 'report' not in line.lower() and 'analytics' not in line.lower():
                    new_architecture.append(line)

            self.sections['ARCHITECTURE'] = new_architecture
            self.improvements.append("Deferred all reporting features")

    def _add_assumptions_section(self):
        """Add explicit assumptions section if needed."""
        if self.improvements and 'ASSUMPTIONS' not in self.sections:
            self.sections['ASSUMPTIONS'] = [
                "",
                "### Validated Assumptions",
                "- Users have valid email addresses (verification required)",
                "- Modern browsers with JavaScript enabled",
                "- Stable internet connectivity for core features",
                "",
                "### Deferred Validations",
                "- Performance under high load (validate in Phase 2)",
                "- Multi-device synchronization (future enhancement)"
            ]

    def _add_risk_mitigation_section(self):
        """Add risk mitigation section if security improvements were made."""
        security_improved = any('security' in imp.lower() or 'auth' in imp.lower()
                              for imp in self.improvements)

        if security_improved and 'RISK MITIGATION' not in self.sections:
            self.sections['RISK MITIGATION'] = [
                "",
                "### Security Measures",
                "- Authentication using proven framework",
                "- Input validation on all forms",
                "- CSRF protection enabled",
                "- Rate limiting on API endpoints",
                "",
                "### Failure Recovery",
                "- Database backups every 6 hours",
                "- Error logging and monitoring",
                "- Graceful degradation for non-critical features"
            ]

    def _add_phasing_section(self):
        """Add phasing information if phased delivery was chosen."""
        if 'PHASES' in self.sections and 'SUCCESS CRITERIA' in self.sections:
            # Update success criteria to be phase-specific
            criteria = self.sections['SUCCESS CRITERIA']
            new_criteria = [
                "",
                "### Phase 1 Success Criteria"
            ]

            # Move basic criteria to Phase 1
            for line in criteria[:3]:
                new_criteria.append(line)

            new_criteria.extend([
                "",
                "### Phase 2 Success Criteria"
            ])

            # Move advanced criteria to Phase 2
            for line in criteria[3:]:
                new_criteria.append(line)

            self.sections['SUCCESS CRITERIA'] = new_criteria

    def _rebuild_context(self) -> str:
        """Rebuild the context with improvements."""
        lines = []

        # Add improvement header
        if self.improvements:
            lines.extend([
                "<!-- IMPROVED CONTEXT -->",
                f"<!-- Improvements applied: {len(self.improvements)} -->",
                f"<!-- Date: {datetime.now().strftime('%Y-%m-%d %H:%M')} -->",
                f"<!-- Based on analysis confidence score and user feedback -->",
                ""
            ])

        # Add title
        lines.append("# Context: [IMPROVED]")
        lines.append("")

        # Add improvement summary
        if self.improvements:
            lines.append("## IMPROVEMENTS APPLIED")
            lines.append("")
            for improvement in self.improvements:
                lines.append(f"- {improvement}")
            lines.append("")

        # Define section order
        section_order = [
            'TASK TYPE',
            'INTENT',
            'SCOPE',
            'ASSUMPTIONS',
            'ARCHITECTURE',
            'ARCHITECTURE & SETUP',
            'SETUP',
            'SETUP PATTERNS',
            'PHASES',
            'TESTING',
            'TESTING STRATEGY',
            'RISK MITIGATION',
            'SUCCESS CRITERIA',
            'NOTES'
        ]

        # Add sections in order
        for section_name in section_order:
            if section_name in self.sections:
                lines.append(f"## {section_name}")
                lines.extend(self.sections[section_name])
                lines.append("")

        # Add any sections not in the predefined order
        for section_name, content in self.sections.items():
            if section_name not in section_order:
                lines.append(f"## {section_name}")
                lines.extend(content)
                lines.append("")

        return '\n'.join(lines)

    def calculate_new_confidence(self, original_confidence: int) -> int:
        """Calculate new confidence score based on improvements."""
        new_confidence = original_confidence

        # Add points for each improvement type
        for improvement in self.improvements:
            imp_lower = improvement.lower()

            if 'simplif' in imp_lower:
                new_confidence += 1
            elif 'defer' in imp_lower:
                new_confidence += 0.5
            elif 'security' in imp_lower or 'auth' in imp_lower:
                new_confidence += 1
            elif 'phase' in imp_lower:
                new_confidence += 0.5
            elif 'remove' in imp_lower:
                new_confidence += 0.5

        # Cap at 10
        return min(10, int(new_confidence))


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Improve context based on user feedback')
    parser.add_argument('--context', required=True, help='Path to original 01-intent.md')
    parser.add_argument('--analysis', required=True, help='Path to 00-analysis.md')
    parser.add_argument('--answers', required=True, help='Path to answers JSON file')
    parser.add_argument('--output', help='Output path (default: 01-intent-improved.md)')
    args = parser.parse_args()

    # Read input files
    context_path = Path(args.context)
    if not context_path.exists():
        print(f"Error: Context file not found: {context_path}", file=sys.stderr)
        sys.exit(1)

    analysis_path = Path(args.analysis)
    if not analysis_path.exists():
        print(f"Error: Analysis file not found: {analysis_path}", file=sys.stderr)
        sys.exit(1)

    answers_path = Path(args.answers)
    if not answers_path.exists():
        print(f"Error: Answers file not found: {answers_path}", file=sys.stderr)
        sys.exit(1)

    original_context = context_path.read_text(encoding='utf-8')
    analysis_content = analysis_path.read_text(encoding='utf-8')
    answers = json.loads(answers_path.read_text(encoding='utf-8'))

    # Apply improvements
    improver = ContextImprover(original_context, analysis_content, answers)
    improved_context = improver.apply_improvements()

    # Save output
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = context_path.parent / '01-intent-improved.md'

    output_path.write_text(improved_context, encoding='utf-8')

    # Extract original confidence
    confidence_match = re.search(r"Confidence.*?(\d+)/10", analysis_content)
    original_confidence = int(confidence_match.group(1)) if confidence_match else 5

    # Calculate new confidence
    new_confidence = improver.calculate_new_confidence(original_confidence)

    # Print summary
    print(f"✅ Context improved successfully")
    print(f"   Improvements applied: {len(improver.improvements)}")
    print(f"   Confidence: {new_confidence}/10 (was {original_confidence}/10)")
    print(f"   Saved to: {output_path}")

    if improver.improvements:
        print(f"\n📋 Improvements made:")
        for improvement in improver.improvements[:5]:
            print(f"   - {improvement}")
        if len(improver.improvements) > 5:
            print(f"   ... and {len(improver.improvements) - 5} more")

    return 0


if __name__ == '__main__':
    sys.exit(main())