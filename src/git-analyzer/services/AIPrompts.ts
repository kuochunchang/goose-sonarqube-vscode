/**
 * AI prompt templates for code change analysis
 * Provides specialized prompts for different analysis types
 */

import type { ParsedFileChange } from '../utils/DiffParser.js';

/**
 * Prompt template for code quality analysis
 * @param changes - Array of parsed file changes
 * @returns Quality analysis prompt
 */
export function buildQualityAnalysisPrompt(changes: ParsedFileChange[]): string {
  const filesSummary = changes
    .map(
      (change) =>
        `- ${change.file} (${change.changeType}): +${change.additions} -${change.deletions}`
    )
    .join('\n');

  const diffsContent = changes
    .map((change) => {
      return `
### File: ${change.file}
Change Type: ${change.changeType}
Language: ${getLanguageFromExtension(change.extension)}

\`\`\`diff
${change.diff}
\`\`\`
`;
    })
    .join('\n---\n');

  return `You are an expert code reviewer analyzing Git changes for code quality issues.

## Changes Summary
${filesSummary}

## Task
Analyze the following code changes and identify code quality issues. Focus on:

1. **Code Smells**: Duplicated code, long methods, large classes, excessive complexity
2. **Naming**: Poor variable/function/class names, inconsistent naming conventions
3. **Structure**: Poor code organization, tight coupling, lack of separation of concerns
4. **Readability**: Hard-to-understand code, missing comments where needed, overly complex logic
5. **Maintainability**: Code that will be difficult to maintain or extend

## Changes to Analyze
${diffsContent}

## Response Format
Return your analysis in the following JSON format:

\`\`\`json
{
  "fileAnalyses": [
    {
      "file": "path/to/file.ts",
      "changeType": "modified",
      "issues": [
        {
          "source": "ai",
          "severity": "high",
          "type": "code-smell",
          "file": "path/to/file.ts",
          "line": 42,
          "message": "Brief description of the issue",
          "description": "Detailed explanation of why this is a problem",
          "suggestion": "How to fix it"
        }
      ],
      "summary": "Overall assessment of changes in this file",
      "linesChanged": 45,
      "qualityScore": 75
    }
  ]
}
\`\`\`

## Guidelines
- Be specific with line numbers
- Severity levels: critical, high, medium, low, info
- Issue types: code-smell, bug, performance, architecture, testing
- Quality score: 0-100 (higher is better)
- Focus on actionable feedback
- Prioritize issues that affect maintainability and reliability`;
}

/**
 * Prompt template for security analysis
 * @param changes - Array of parsed file changes
 * @returns Security analysis prompt
 */
export function buildSecurityAnalysisPrompt(changes: ParsedFileChange[]): string {
  const filesSummary = changes
    .map(
      (change) =>
        `- ${change.file} (${change.changeType}): +${change.additions} -${change.deletions}`
    )
    .join('\n');

  const diffsContent = changes
    .map((change) => {
      return `
### File: ${change.file}
Change Type: ${change.changeType}
Language: ${getLanguageFromExtension(change.extension)}

\`\`\`diff
${change.diff}
\`\`\`
`;
    })
    .join('\n---\n');

  return `You are a security expert analyzing Git changes for security vulnerabilities.

## Changes Summary
${filesSummary}

## Task
Analyze the following code changes for security issues. Focus on OWASP Top 10 and common vulnerabilities:

1. **Injection Flaws**: SQL injection, command injection, code injection, XSS
2. **Authentication & Authorization**: Broken authentication, improper access control
3. **Sensitive Data Exposure**: Hardcoded secrets, unencrypted data, exposed credentials
4. **Security Misconfiguration**: Insecure defaults, unnecessary features enabled
5. **Vulnerable Dependencies**: Using outdated or vulnerable libraries
6. **Insufficient Logging**: Missing security event logging
7. **Input Validation**: Improper input validation, unsafe deserialization
8. **CSRF**: Cross-Site Request Forgery vulnerabilities

## Changes to Analyze
${diffsContent}

## Response Format
Return your analysis in the following JSON format:

\`\`\`json
{
  "fileAnalyses": [
    {
      "file": "path/to/file.ts",
      "changeType": "modified",
      "issues": [
        {
          "source": "ai",
          "severity": "critical",
          "type": "vulnerability",
          "file": "path/to/file.ts",
          "line": 42,
          "message": "Brief description of the vulnerability",
          "description": "Detailed explanation of the security risk",
          "suggestion": "How to fix it securely",
          "effort": 30
        }
      ],
      "summary": "Security assessment of changes in this file",
      "linesChanged": 45,
      "qualityScore": 80
    }
  ]
}
\`\`\`

## Guidelines
- Severity: critical (exploitable), high (serious risk), medium (potential risk), low (minor concern)
- Be specific about the attack vector
- Provide secure coding recommendations
- Reference OWASP guidelines where applicable
- Effort: estimated minutes to fix
- Quality score: 0-100 (security perspective, higher is better)`;
}

/**
 * Prompt template for impact analysis
 * @param changes - Array of parsed file changes
 * @param commitMessages - Optional commit messages for context
 * @returns Impact analysis prompt
 */
export function buildImpactAnalysisPrompt(
  changes: ParsedFileChange[],
  commitMessages?: string[]
): string {
  const filesSummary = changes
    .map(
      (change) =>
        `- ${change.file} (${change.changeType}): +${change.additions} -${change.deletions}`
    )
    .join('\n');

  const diffsContent = changes
    .map((change) => {
      return `
### File: ${change.file}
Change Type: ${change.changeType}
Language: ${getLanguageFromExtension(change.extension)}

\`\`\`diff
${change.diff}
\`\`\`
`;
    })
    .join('\n---\n');

  const commitsSection = commitMessages
    ? `
## Commit History
${commitMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}
`
    : '';

  return `You are a software architect analyzing the impact of Git changes on the codebase.

## Changes Summary
Total files changed: ${changes.length}
${filesSummary}
${commitsSection}

## Task
Analyze the impact and risks of these changes. Provide:

1. **Risk Assessment**: Overall risk level (low, medium, high, critical)
2. **Breaking Changes**: API changes, interface modifications, removed functionality
3. **Affected Modules**: Which parts of the system are affected
4. **Testing Recommendations**: What needs to be tested
5. **Deployment Risks**: Potential issues during deployment
6. **Quality Score**: Overall quality assessment (0-100)

## Changes to Analyze
${diffsContent}

## Response Format
Return your analysis in the following JSON format:

\`\`\`json
{
  "impactAnalysis": {
    "riskLevel": "medium",
    "affectedModules": [
      "authentication",
      "user-management"
    ],
    "breakingChanges": [
      "Changed UserService.login() signature",
      "Removed deprecated validateUser() method"
    ],
    "testingRecommendations": [
      "Test authentication flow end-to-end",
      "Verify user login with various credentials",
      "Test error handling for invalid inputs"
    ],
    "deploymentRisks": [
      "Database migration required for user schema changes",
      "Potential downtime during auth service restart"
    ],
    "qualityScore": 75
  },
  "fileAnalyses": [
    {
      "file": "path/to/file.ts",
      "changeType": "modified",
      "issues": [
        {
          "source": "ai",
          "severity": "high",
          "type": "breaking-change",
          "file": "path/to/file.ts",
          "line": 42,
          "message": "Breaking change in public API",
          "description": "Method signature changed",
          "suggestion": "Add deprecation notice and migration guide"
        }
      ],
      "summary": "Impact assessment for this file",
      "linesChanged": 45
    }
  ]
}
\`\`\`

## Guidelines
- Risk levels: low (minor changes), medium (moderate impact), high (significant changes), critical (breaking changes)
- Identify ALL breaking changes
- Consider backward compatibility
- Focus on deployment and runtime implications
- Provide specific, actionable testing recommendations
- Quality score: 0-100 (impact perspective, higher means better quality/safer changes)`;
}

/**
 * Prompt template for architecture review
 * @param changes - Array of parsed file changes
 * @returns Architecture review prompt
 */
export function buildArchitectureReviewPrompt(changes: ParsedFileChange[]): string {
  const filesSummary = changes
    .map(
      (change) =>
        `- ${change.file} (${change.changeType}): +${change.additions} -${change.deletions}`
    )
    .join('\n');

  const diffsContent = changes
    .map((change) => {
      return `
### File: ${change.file}
Change Type: ${change.changeType}
Language: ${getLanguageFromExtension(change.extension)}

\`\`\`diff
${change.diff}
\`\`\`
`;
    })
    .join('\n---\n');

  return `You are a software architect reviewing code changes for architectural patterns and design principles.

## Changes Summary
${filesSummary}

## Task
Review these changes for architectural quality. Evaluate:

1. **Design Patterns**: Proper use of design patterns, anti-patterns
2. **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
3. **Separation of Concerns**: Proper layering, module boundaries
4. **Dependency Management**: Coupling, cohesion, circular dependencies
5. **Scalability**: Performance implications, resource usage
6. **Extensibility**: How easy it is to extend this code

## Changes to Analyze
${diffsContent}

## Response Format
Return your analysis as a text review focusing on architectural aspects. Highlight:
- Design pattern usage (good and bad)
- SOLID principle violations
- Architectural improvements needed
- Scalability concerns
- Recommendations for better design

Keep the review concise but insightful.`;
}

/**
 * Get language name from file extension
 * @param extension - File extension
 * @returns Language name
 */
function getLanguageFromExtension(extension: string): string {
  const extensionMap: Record<string, string> = {
    ts: 'TypeScript',
    js: 'JavaScript',
    tsx: 'TypeScript React',
    jsx: 'JavaScript React',
    py: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    cs: 'C#',
    go: 'Go',
    rs: 'Rust',
    rb: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kt: 'Kotlin',
    scala: 'Scala',
    sh: 'Shell',
    bash: 'Bash',
    sql: 'SQL',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    md: 'Markdown',
  };

  return extensionMap[extension?.toLowerCase()] || 'Unknown';
}
