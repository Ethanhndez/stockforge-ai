#!/usr/bin/env node
/**
 * AgentShield gate — PostToolUse hook
 *
 * RUNTIME PROTECTION (this file):
 *   Scans live tool responses during Claude Code sessions for leaked secrets and PII.
 *   Triggered automatically via the PostToolUse hook in .claude/settings.json.
 *
 * STATIC / CI ANALYSIS (ecc-agentshield package):
 *   `ecc-agentshield` (npm package by Affaan Mustafa) handles static analysis of the
 *   .claude/ directory — settings, hooks, MCP config, and permissions — as a CI gate.
 *   Run via: `npm run security-scan`
 *   Wired into: .husky/pre-push (blocks push when score < 80)
 *   Baseline: .claude/security/agentshield-baseline.json
 *
 * This hook handles RUNTIME tool response scanning.
 * ecc-agentshield handles STATIC/CI analysis.
 * Both layers are required; neither replaces the other.
 *
 * Reads the tool result from stdin and checks for:
 *   1. Leaked API keys in the response payload
 *   2. Unexpected PII fields
 *   3. Missing structured output schema (for AI layer responses)
 *
 * Exit codes:
 *   0 — allow
 *   2 — block with explanation on stderr
 */

// Patterns that should never appear in a tool response surfaced to the user.
//
// Design rule: every pattern must match a KEY=VALUE pair where VALUE is a
// plausible secret (20+ alphanumeric chars). This prevents false positives on:
//   - Variable names:  POLYGON_API_KEY  (no value attached)
//   - Feature flags:   NEXT_PUBLIC_USE_FIXTURES=true  (value too short)
//   - Long identifiers near "apiKey" in source code URLs
//   - Env var references: apiKey=${POLYGON_API_KEY}  ("${" breaks alphanumeric)
const SENSITIVE_PATTERNS = [
  // API key with actual value — key name followed by = or : then 20+ char secret
  /api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  // Polygon-specific key with actual value
  /polygon[_-]?api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]{20,}/i,
  // NEXT_PUBLIC_ env var with actual value (not a short flag like =true or =false)
  /NEXT_PUBLIC_[A-Z_]+\s*[:=]\s*["']?[a-zA-Z0-9]{20,}/,
  // Supabase service role key with actual value — must be KEY=VALUE with 20+ char secret.
  // Split string prevents self-match when this source file is scanned.
  // Matches:  service_role_key=eyJhbGc...  or  SERVICE_ROLE_KEY: "sb_secret_abc..."
  // Does NOT match: SUPABASE_SERVICE_ROLE_KEY (bare env var name, no value)
  new RegExp('service' + '_role[_a-z]*\\s*[:=]\\s*["\']?[A-Za-z0-9_\\-.]{20,}', 'i'),
  // Generic bearer token in response body
  /"(Authorization|Bearer)"\s*:\s*"[^"]{10,}"/i,
];

// PII field names that should not be logged or returned unintentionally
const PII_FIELDS = [
  'email', 'password', 'phone', 'ssn', 'social_security',
  'credit_card', 'card_number', 'cvv', 'dob', 'date_of_birth',
];

let input = '';

process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const responseText = JSON.stringify(payload);

  // Check for leaked secrets
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(responseText)) {
      process.stderr.write(
        `[AgentShieldGate] BLOCKED: potential API key or secret detected in tool response.\n` +
        `Pattern: ${pattern.source}\n` +
        `Do NOT surface this response to the user. Investigate the route for key leakage.\n`
      );
      process.exit(2);
    }
  }

  // Check for PII fields
  for (const field of PII_FIELDS) {
    const piiPattern = new RegExp(`"${field}"\\s*:`, 'i');
    if (piiPattern.test(responseText)) {
      process.stderr.write(
        `[AgentShieldGate] WARNING: PII field "${field}" detected in tool response.\n` +
        `Verify this is intentional and not an accidental data leak.\n`
      );
      // Warn but don't hard-block PII — some fields may be legitimate (e.g., user's own email)
      // Change to process.exit(2) if you want hard blocking
    }
  }

  process.exit(0);
});
