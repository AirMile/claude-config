# Route: Fill-In (Missing Sections)

Targets only the missing sections identified in PHASE 1 completeness check. For each missing section, run the corresponding step from the Create route:

| Missing Section | → Run Step                                                               |
| --------------- | ------------------------------------------------------------------------ |
| colors          | Step 1: Colors                                                           |
| typography      | Step 2: Typography                                                       |
| spacing         | Step 3: Spacing                                                          |
| breakpoints     | Step 4: Breakpoints                                                      |
| modes           | Step 5: Dark Mode                                                        |
| motion          | Step 6: Motion                                                           |
| interactions    | Step 7: Interactions                                                     |
| borderRadius    | Generate defaults (0.125rem, 0.25rem, 0.375rem, 0.5rem, 0.75rem, 9999px) |
| shadows         | Generate defaults (sm, md, lg, xl + glow with accent color)              |
| cssVars         | Auto-generate from all present token data                                |

Skip already-present sections. After filling in all missing sections:

1. Regenerate `cssVars` to include all newly added tokens
2. → Go to PHASE X: Post-flight Validation
3. → Go to X.6: Theme Infrastructure Sync
4. → Go to PHASE Y: Website Sync
