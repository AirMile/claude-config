# Research Techniques

## 1. Competitive Landscape

**When to use:** Understand what already exists, who the competitors are, and how the concept differentiates.

**Addresses:** Knowledge Gaps, Decisions

**Sources:** WebSearch (primary), Context7 (for technical alternatives)

**Approach:**

- What existing solutions solve the same problem?
- Who are the main competitors or alternatives?
- What are their strengths and weaknesses?
- How is this concept different or better?
- What market gaps exist that competitors miss?
- What pricing models or business approaches do competitors use?

**Output structure:**

- Competitor/alternative overview (name, description, key features)
- Comparison table (features, pricing, strengths, weaknesses)
- Market gaps identified
- Differentiation opportunities

## 2. Technical Feasibility

**When to use:** Validate technology choices, implementation constraints, or technical unknowns.

**Addresses:** Risks, Decisions

**Sources:** Context7 (primary), WebSearch (for benchmarks, case studies)

**Approach:**

- What libraries, frameworks, or APIs support the required functionality?
- What are the technical constraints or limitations?
- What performance characteristics are expected?
- What integration challenges exist?
- What is the maturity level of required technologies?
- Are there known issues, gotchas, or deprecation risks?

**Context7 workflow:**

1. Identify key technologies mentioned in or required by the concept
2. Use `resolve-library-id` for each technology
3. Query docs for: capabilities, limitations, integration patterns, performance

**Output structure:**

- Technology options evaluated (with Context7 findings)
- Feasibility assessment per key feature
- Technical risks and constraints
- Recommended technology stack

## 3. State of the Art

**When to use:** Understand current best practices, latest developments, and emerging trends.

**Addresses:** Knowledge Gaps, Decisions

**Sources:** WebSearch (primary), Context7 (for framework-specific best practices)

**Approach:**

- What are the current best practices in this domain?
- What recent developments or trends are relevant?
- What emerging technologies could impact this concept?
- What has changed recently in this space?
- What do industry leaders recommend?

**Output structure:**

- Current best practices summary
- Recent developments and trends
- Emerging technologies or approaches
- Relevance to the concept (what to adopt, what to watch)

## 4. Evidence & Validation

**When to use:** Validate assumptions about user behavior, market demand, or effectiveness with data.

**Addresses:** Assumptions

**Sources:** WebSearch (primary)

**Approach:**

- What data supports the core assumptions?
- What case studies or examples demonstrate similar approaches?
- What statistics or research back the value proposition?
- What evidence contradicts the assumptions?
- What metrics do similar products/concepts report?

**Output structure:**

- Assumptions mapped to evidence (confirmed/denied/inconclusive)
- Key data points and statistics
- Case studies summarized
- Confidence level per assumption (high/medium/low)

## 5. Audience & Market

**When to use:** Understand the target audience, their needs, behaviors, and market opportunity.

**Addresses:** Knowledge Gaps, Assumptions

**Sources:** WebSearch (primary)

**Approach:**

- Who is the target audience specifically?
- What are their pain points and needs?
- How do they currently solve this problem?
- What is the market size and growth trajectory?
- What are the user acquisition channels?
- What willingness to pay exists?

**Output structure:**

- Target audience profile (demographics, behaviors, needs)
- Pain points validated with external data
- Market size and growth data
- Audience-concept fit assessment

## 6. Trend Analysis

**When to use:** Track momentum, surface weak signals, and identify platform-specific sentiment divergence for a concept, topic, or market.

**Addresses:** Knowledge Gaps, Decisions

**Sources:** WebSearch (primary)

**Mental models (operational lens — use these actively during analysis):**

- Signal Detection: what stands out, why, and for whom?
- Triangulation: does this signal hold across multiple platforms/sources?
- Counter-Intuitive: where does the consensus break? What is NOT trending that you would expect?
- MECE: are all relevant platform/source types covered?

**Platform DNA (use as interpretation guide):**

| Platform     | Character                                      |
| ------------ | ---------------------------------------------- |
| Twitter/X    | Early adoption, emotional, fast cycles         |
| Reddit       | Critical, detailed, niche communities          |
| LinkedIn     | Professional, lagging indicator, B2B sentiment |
| Hacker News  | Tech/startup, skeptical, anti-hype             |
| Product Hunt | Launch-moment buzz, early adopters             |

Temperature difference = analytical signal: trending on Twitter but not on LinkedIn → emotional/consumer issue without business traction (or not yet filtered through).

**Rank-trajectory vocabulary:**

- `acute_rise`: appears and rises quickly → time-sensitive window
- `plateau`: high but stable → mainstream, commodity-risk
- `zombie`: stagnant with no growth → exhausted momentum, avoid
- `comeback`: was gone, returns → new trigger, investigate the cause

**Approach:**

- Which platforms/communities mention this and in what tone?
- What are the temperature differences per platform?
- What is the trajectory (acute_rise / plateau / zombie / comeback)?
- What weak signals exist that mainstream sources don't yet cover?
- Where does the consensus break — what is the real conflict?

**Anti-hallucination:** "stably high" is NOT a rise. Always define trajectory relative to a time window, not as an absolute claim.

**Output structure:**

- Trend velocity per platform (rising/stable/declining + character)
- Temperature differences interpreted (what does the difference say?)
- Trajectory assessment with vocabulary
- Weak signals (sources mainstream doesn't cover)
- Sentiment conflict: "where does the consensus break?"
