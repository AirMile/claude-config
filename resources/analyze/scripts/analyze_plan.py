#!/usr/bin/env python3
"""
Analyze a feature plan using three core techniques.

Usage:
    python3 analyze_plan.py --input path/to/01-intent.md
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


class PlanAnalyzer:
    """Analyzes feature plans using multiple techniques."""

    def __init__(self, content: str, feature_name: str):
        self.content = content
        self.feature_name = feature_name
        self.lines = content.split('\n')
        self.sections = self._parse_sections()

        # Analysis results
        self.devils_advocate_results = {}
        self.assumption_results = {}
        self.alternatives_results = {}
        self.simplification_results = {}
        self.confidence_score = 0

    def _parse_sections(self) -> Dict[str, List[str]]:
        """Parse content into sections."""
        sections = {}
        current_section = None
        section_content = []

        for line in self.lines:
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

    def analyze_devils_advocate(self) -> Dict:
        """Identify potential problems and failure points."""
        results = {
            'major_concerns': [],
            'weak_points': [],
            'failure_modes': [],
            'mitigations': []
        }

        content_lower = self.content.lower()

        # Check for common concerns
        if 'authentication' in content_lower or 'auth' in content_lower:
            results['major_concerns'].append({
                'concern': 'Security vulnerabilities in authentication',
                'impact': 'Unauthorized access to system'
            })
            results['mitigations'].append('Implement OAuth or use established auth library')

        if 'payment' in content_lower or 'transaction' in content_lower:
            results['major_concerns'].append({
                'concern': 'Payment processing failures',
                'impact': 'Lost revenue and customer trust'
            })
            results['mitigations'].append('Use established payment provider (Stripe/PayPal)')

        if 'real-time' in content_lower or 'realtime' in content_lower:
            results['weak_points'].append({
                'weakness': 'Real-time sync complexity',
                'risk': 'High - May cause race conditions'
            })

        # Check for complexity indicators
        line_count = len(self.lines)
        if line_count > 500:
            results['weak_points'].append({
                'weakness': 'Plan complexity ({}+ lines)'.format(line_count),
                'risk': 'Medium - Difficult to implement in one go'
            })
            results['mitigations'].append('Consider simplifying scope or breaking into phases')

        # Check for missing sections
        expected_sections = ['INTENT', 'ARCHITECTURE', 'TESTING']
        for section in expected_sections:
            if section not in self.sections or not self.sections[section]:
                results['weak_points'].append({
                    'weakness': f'Missing or empty {section} section',
                    'risk': 'Medium - Incomplete planning'
                })

        # Identify failure modes based on patterns
        if 'database' in content_lower or 'migration' in content_lower:
            results['failure_modes'].append({
                'scenario': 'Database migration failure',
                'likelihood': 'Medium',
                'consequence': 'Data corruption or loss'
            })

        if 'api' in content_lower or 'endpoint' in content_lower:
            results['failure_modes'].append({
                'scenario': 'API rate limiting or downtime',
                'likelihood': 'Medium',
                'consequence': 'Service unavailable'
            })

        # Generic concerns if none found
        if not results['major_concerns']:
            results['major_concerns'].append({
                'concern': 'Scope creep during implementation',
                'impact': 'Timeline and complexity increase'
            })

        if not results['mitigations']:
            results['mitigations'].append('Implement comprehensive error handling')
            results['mitigations'].append('Add detailed logging for debugging')

        self.devils_advocate_results = results
        return results

    def analyze_assumptions(self) -> Dict:
        """Test and validate plan assumptions."""
        results = {
            'core_assumptions': [],
            'unvalidated': [],
            'testing_plan': [],
            'contingencies': []
        }

        content_lower = self.content.lower()

        # Common assumptions to check
        assumptions_to_check = [
            ('user', 'Users will understand the interface', 'Usability testing'),
            ('performance', 'System can handle expected load', 'Load testing'),
            ('network', 'Network connectivity is reliable', 'Offline mode'),
            ('data', 'Data format remains consistent', 'Validation layer'),
            ('third-party', 'External services are available', 'Fallback options'),
            ('browser', 'Modern browser features supported', 'Polyfills'),
            ('mobile', 'Mobile devices have sufficient resources', 'Progressive enhancement')
        ]

        for keyword, assumption, test_method in assumptions_to_check:
            if keyword in content_lower:
                results['core_assumptions'].append({
                    'assumption': assumption,
                    'type': 'Critical' if keyword in ['user', 'data'] else 'Important',
                    'validated': False,
                    'test_method': test_method,
                    'if_wrong': f'{keyword.title()} requirements not met'
                })

        # Check for implicit assumptions
        if 'email' in content_lower:
            results['unvalidated'].append({
                'assumption': 'All users have valid email addresses',
                'risk': 'Registration/notification failures'
            })

        if 'javascript' in content_lower or 'js' in content_lower:
            results['unvalidated'].append({
                'assumption': 'JavaScript is enabled in browser',
                'risk': 'Complete functionality loss'
            })

        # Generate testing plan
        for assumption in results['core_assumptions']:
            results['testing_plan'].append(
                f"Test {assumption['assumption']} using {assumption['test_method']}"
            )

        # Add contingencies
        for assumption in results['core_assumptions']:
            if assumption['type'] == 'Critical':
                results['contingencies'].append({
                    'if_fails': assumption['assumption'],
                    'then': f"Implement {assumption['test_method']} as fallback"
                })

        self.assumption_results = results
        return results

    def analyze_alternatives(self) -> Dict:
        """Explore alternative approaches."""
        results = {
            'alternatives': [],
            'comparison': [],
            'recommendation': ''
        }

        # Analyze current approach complexity
        current_complexity = self._assess_complexity()

        # Generate alternatives based on content
        content_lower = self.content.lower()

        # Alternative 1: Simpler approach
        results['alternatives'].append({
            'name': 'Minimal MVP',
            'description': 'Implement only core features, defer nice-to-haves',
            'pros': ['Faster delivery', 'Lower complexity', 'Earlier feedback'],
            'cons': ['Missing features', 'May need rework'],
            'effort': 'Low',
            'effectiveness': '60%'
        })

        # Alternative 2: Different technology
        if 'custom' in content_lower:
            results['alternatives'].append({
                'name': 'Use existing library/service',
                'description': 'Replace custom implementation with third-party solution',
                'pros': ['Proven solution', 'Less maintenance', 'Faster implementation'],
                'cons': ['Less control', 'Potential vendor lock-in', 'Cost'],
                'effort': 'Low',
                'effectiveness': '80%'
            })

        # Alternative 3: Progressive approach
        if current_complexity == 'High':
            results['alternatives'].append({
                'name': 'Phased rollout',
                'description': 'Implement in phases with continuous deployment',
                'pros': ['Risk mitigation', 'Early value delivery', 'Feedback incorporation'],
                'cons': ['Longer total timeline', 'Integration complexity'],
                'effort': 'Medium',
                'effectiveness': '90%'
            })

        # Create comparison matrix
        results['comparison'] = [
            {
                'approach': 'Original Plan',
                'complexity': current_complexity,
                'time': self._estimate_time(current_complexity),
                'risk': 'Medium',
                'effectiveness': '100%'
            }
        ]

        for alt in results['alternatives']:
            results['comparison'].append({
                'approach': alt['name'],
                'complexity': alt['effort'],
                'time': self._estimate_time(alt['effort']),
                'risk': 'Low' if alt['effort'] == 'Low' else 'Medium',
                'effectiveness': alt['effectiveness']
            })

        # Make recommendation
        if current_complexity == 'High':
            results['recommendation'] = (
                "Consider the Phased rollout approach to reduce risk while maintaining effectiveness."
            )
        elif 'custom' in content_lower:
            results['recommendation'] = (
                "Evaluate existing libraries/services before building custom solution. "
                "This could save significant development time."
            )
        else:
            results['recommendation'] = (
                "Current approach seems reasonable. "
                "Consider Minimal MVP if timeline is critical."
            )

        self.alternatives_results = results
        return results

    def analyze_simplification(self) -> Dict:
        """Analyze opportunities for simplification."""
        results = {
            'can_eliminate': [],
            'can_simplify': [],
            'can_reuse': [],
            'can_defer': [],
            'simplification_score': 0,
            'time_saved': '',
            'recommendation': ''
        }

        content_lower = self.content.lower()

        # Check for features that can be eliminated
        eliminatable = [
            ('advanced reporting', 'analytics', 'Complex reporting not essential for MVP'),
            ('multi-tenant', 'tenancy', 'Single tenant simpler for start'),
            ('real-time', 'websocket', 'Polling or SSE often sufficient'),
            ('custom auth', 'authentication system', 'Use existing framework'),
            ('complex permissions', 'rbac', 'Simple roles often enough')
        ]

        for feature, keywords, reason in eliminatable:
            if any(kw in content_lower for kw in keywords.split()):
                results['can_eliminate'].append({
                    'feature': feature,
                    'reason': reason,
                    'impact': 'High complexity reduction'
                })

        # Check for features that can be simplified
        simplifiable = [
            ('authentication', 'Use Laravel Breeze instead of custom'),
            ('file upload', 'Use Laravel Media Library'),
            ('api', 'Start with REST instead of GraphQL'),
            ('ui', 'Use pre-built components'),
            ('search', 'Basic search before elasticsearch')
        ]

        for area, suggestion in simplifiable:
            if area in content_lower:
                results['can_simplify'].append({
                    'area': area.title(),
                    'current': 'Complex implementation',
                    'suggestion': suggestion
                })

        # Check for reusable components
        if 'custom' in content_lower:
            # Count custom implementations
            custom_count = content_lower.count('custom')
            if custom_count > 3:
                results['can_reuse'].append({
                    'finding': f'{custom_count} custom implementations detected',
                    'suggestion': 'Consider existing packages/libraries',
                    'examples': 'Spatie packages, Laravel packages, npm libraries'
                })

        # Check for features that can be deferred
        deferrable = [
            ('reporting', 'Reports and analytics', 'After gathering user feedback'),
            ('integration', 'Third-party integrations', 'Phase 2'),
            ('automation', 'Background jobs', 'Start manual, automate later'),
            ('notification', 'Complex notifications', 'Email first, enhance later'),
            ('mobile', 'Mobile app', 'Web-first approach')
        ]

        for keyword, feature, when in deferrable:
            if keyword in content_lower:
                results['can_defer'].append({
                    'feature': feature,
                    'defer_to': when,
                    'benefit': 'Faster initial delivery'
                })

        # Calculate simplification score
        total_opportunities = (
            len(results['can_eliminate']) * 3 +
            len(results['can_simplify']) * 2 +
            len(results['can_reuse']) +
            len(results['can_defer']) * 2
        )

        # Score out of 100
        results['simplification_score'] = min(100, total_opportunities * 10)

        # Estimate time saved
        if results['simplification_score'] >= 70:
            results['time_saved'] = '2+ weeks'
        elif results['simplification_score'] >= 40:
            results['time_saved'] = '1-2 weeks'
        elif results['simplification_score'] >= 20:
            results['time_saved'] = '3-5 days'
        else:
            results['time_saved'] = '1-2 days'

        # Generate recommendation
        if results['simplification_score'] >= 60:
            results['recommendation'] = (
                "Significant simplification possible. Strongly recommend applying "
                "simplifications before implementation to reduce complexity and time."
            )
        elif results['simplification_score'] >= 30:
            results['recommendation'] = (
                "Moderate simplification opportunities available. Consider applying "
                "key simplifications to streamline development."
            )
        else:
            results['recommendation'] = (
                "Plan is reasonably simple. Minor simplifications available "
                "but current approach is acceptable."
            )

        self.simplification_results = results
        return results

    def _assess_complexity(self) -> str:
        """Assess overall plan complexity."""
        score = 0

        # Line count
        if len(self.lines) > 500:
            score += 3
        elif len(self.lines) > 300:
            score += 2
        elif len(self.lines) > 150:
            score += 1

        # Component count
        content_lower = self.content.lower()
        components = ['model', 'controller', 'service', 'view', 'component', 'migration']
        component_count = sum(1 for c in components if c in content_lower)

        if component_count > 5:
            score += 3
        elif component_count > 3:
            score += 2
        elif component_count > 1:
            score += 1

        # Technical complexity indicators
        complex_patterns = ['real-time', 'websocket', 'payment', 'oauth', 'encryption']
        if any(p in content_lower for p in complex_patterns):
            score += 2

        # Return complexity level
        if score >= 6:
            return 'High'
        elif score >= 3:
            return 'Medium'
        else:
            return 'Low'

    def _estimate_time(self, complexity: str) -> str:
        """Estimate implementation time based on complexity."""
        if complexity == 'High':
            return '2+ weeks'
        elif complexity == 'Medium':
            return '1 week'
        else:
            return '2-3 days'

    def calculate_confidence(self) -> int:
        """Calculate overall confidence score (1-10)."""
        score = 10

        # Deduct for devil's advocate concerns
        major_concerns = len(self.devils_advocate_results.get('major_concerns', []))
        score -= min(major_concerns * 1.5, 4)

        weak_points = len(self.devils_advocate_results.get('weak_points', []))
        score -= min(weak_points * 0.5, 2)

        # Deduct for unvalidated assumptions
        unvalidated = len(self.assumption_results.get('unvalidated', []))
        score -= min(unvalidated * 0.5, 2)

        # Deduct for high complexity
        if self._assess_complexity() == 'High':
            score -= 1

        # Add points if simplification is possible (shows plan can be improved)
        simplification_score = self.simplification_results.get('simplification_score', 0)
        if simplification_score >= 60:
            score -= 1  # High simplification needed means current plan is too complex
        elif simplification_score <= 20:
            score += 0.5  # Low simplification needed means plan is already simple

        # Ensure score is between 1 and 10
        self.confidence_score = max(1, min(10, int(score)))
        return self.confidence_score

    def generate_report(self) -> str:
        """Generate complete analysis report."""
        report = []

        # Header
        report.append(f"# Analysis Report: {self.feature_name}")
        report.append(f"**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        report.append("**Analyzer:** Claude Code Analyze Skill v1.0")
        report.append("")

        # Executive Summary
        report.append("## Executive Summary")
        report.append("")
        report.append(f"**Confidence Score:** {self.confidence_score}/10")
        report.append("")

        report.append("**Top 3 Concerns:**")
        concerns = self.devils_advocate_results.get('major_concerns', [])[:3]
        for i, concern in enumerate(concerns, 1):
            report.append(f"{i}. {concern['concern']}")
        report.append("")

        report.append("**Key Recommendations:**")
        mitigations = self.devils_advocate_results.get('mitigations', [])[:3]
        for i, mitigation in enumerate(mitigations, 1):
            report.append(f"{i}. {mitigation}")
        report.append("")
        report.append("---")
        report.append("")

        # Devil's Advocate Analysis
        report.append("## Devil's Advocate Analysis")
        report.append("")

        if self.devils_advocate_results.get('major_concerns'):
            report.append("### Major Concerns")
            for concern in self.devils_advocate_results['major_concerns']:
                report.append(f"- **{concern['concern']}**")
                report.append(f"  - Impact: {concern['impact']}")
            report.append("")

        if self.devils_advocate_results.get('weak_points'):
            report.append("### Weak Points")
            for weak in self.devils_advocate_results['weak_points']:
                report.append(f"- {weak['weakness']}")
                report.append(f"  - Risk: {weak['risk']}")
            report.append("")

        if self.devils_advocate_results.get('failure_modes'):
            report.append("### Potential Failure Modes")
            for failure in self.devils_advocate_results['failure_modes']:
                report.append(f"- **{failure['scenario']}**")
                report.append(f"  - Likelihood: {failure['likelihood']}")
                report.append(f"  - Consequence: {failure['consequence']}")
            report.append("")

        report.append("---")
        report.append("")

        # Assumption Testing
        report.append("## Assumption Testing")
        report.append("")

        if self.assumption_results.get('core_assumptions'):
            report.append("### Core Assumptions")
            for assumption in self.assumption_results['core_assumptions']:
                report.append(f"- **{assumption['assumption']}**")
                report.append(f"  - Type: {assumption['type']}")
                report.append(f"  - Test method: {assumption['test_method']}")
            report.append("")

        if self.assumption_results.get('unvalidated'):
            report.append("### Unvalidated Assumptions")
            for unval in self.assumption_results['unvalidated']:
                report.append(f"- {unval['assumption']}")
                report.append(f"  - Risk: {unval['risk']}")
            report.append("")

        report.append("---")
        report.append("")

        # Alternative Approaches
        report.append("## Alternative Approaches")
        report.append("")

        for alt in self.alternatives_results.get('alternatives', []):
            report.append(f"### {alt['name']}")
            report.append(f"**Description:** {alt['description']}")
            report.append(f"**Pros:** {', '.join(alt['pros'])}")
            report.append(f"**Cons:** {', '.join(alt['cons'])}")
            report.append(f"**Effort:** {alt['effort']} | **Effectiveness:** {alt['effectiveness']}")
            report.append("")

        if self.alternatives_results.get('recommendation'):
            report.append("### Recommendation")
            report.append(self.alternatives_results['recommendation'])
            report.append("")

        report.append("---")
        report.append("")

        # Simplification Analysis
        report.append("## Simplification Analysis")
        report.append("")

        if self.simplification_results.get('can_eliminate'):
            report.append("### What to Eliminate")
            for item in self.simplification_results['can_eliminate']:
                report.append(f"- **{item['feature']}**: {item['reason']}")
            report.append("")

        if self.simplification_results.get('can_simplify'):
            report.append("### What to Simplify")
            for item in self.simplification_results['can_simplify']:
                report.append(f"- **{item['area']}**: {item['suggestion']}")
            report.append("")

        if self.simplification_results.get('can_reuse'):
            report.append("### What to Reuse")
            for item in self.simplification_results['can_reuse']:
                report.append(f"- {item['finding']}")
                report.append(f"  - Suggestion: {item['suggestion']}")
            report.append("")

        if self.simplification_results.get('can_defer'):
            report.append("### What to Defer")
            for item in self.simplification_results['can_defer']:
                report.append(f"- **{item['feature']}** → {item['defer_to']}")
            report.append("")

        if self.simplification_results.get('simplification_score'):
            report.append("### Simplification Impact")
            report.append(f"- Simplification potential: {self.simplification_results['simplification_score']}%")
            report.append(f"- Time saved: {self.simplification_results.get('time_saved', 'Unknown')}")
            report.append("")
            report.append("### Recommendation")
            report.append(self.simplification_results.get('recommendation', ''))
            report.append("")

        report.append("---")
        report.append("")

        # Next Steps
        report.append("## Recommended Next Steps")
        report.append("")

        if self.confidence_score >= 8:
            report.append("✅ **Plan is solid.** Proceed with implementation via `/2-code`")
        elif self.confidence_score >= 5:
            report.append("⚠️ **Plan needs refinement.** Consider:")
            report.append("- Address critical issues identified above")
            report.append("- Validate key assumptions before proceeding")
        else:
            report.append("🔴 **Plan needs significant revision.** Recommend:")
            report.append("- Review alternative approaches section")
            report.append("- Consider running `/1-plan` with refined requirements")

        return '\n'.join(report)


def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description='Analyze feature plan')
    parser.add_argument('--input', required=True, help='Path to 01-intent.md')
    parser.add_argument('--output', help='Output path (default: same folder)')
    args = parser.parse_args()

    # Read input file
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: File not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    content = input_path.read_text(encoding='utf-8')
    feature_name = input_path.parent.name

    # Analyze
    analyzer = PlanAnalyzer(content, feature_name)

    # Run all analyses
    analyzer.analyze_devils_advocate()
    analyzer.analyze_assumptions()
    analyzer.analyze_alternatives()
    analyzer.analyze_simplification()
    analyzer.calculate_confidence()

    # Generate report
    report = analyzer.generate_report()

    # Save output
    if args.output:
        output_path = Path(args.output)
    else:
        output_path = input_path.parent / '01-analysis.md'

    output_path.write_text(report, encoding='utf-8')

    # Print summary
    print(f"✅ Analysis complete for: {feature_name}")
    print(f"   Confidence score: {analyzer.confidence_score}/10")
    print(f"   Report saved to: {output_path}")

    if analyzer.confidence_score < 5:
        print("   ⚠️ Low confidence - significant issues identified")
    elif analyzer.confidence_score < 8:
        print("   ℹ️ Medium confidence - some refinement needed")
    else:
        print("   ✅ High confidence - ready to proceed")

    return 0


if __name__ == '__main__':
    sys.exit(main())