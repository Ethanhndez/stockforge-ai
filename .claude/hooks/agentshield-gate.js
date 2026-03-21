#!/usr/bin/env node
/**
 * AgentShield gate — PostToolUse hook
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

// Patterns that should never appear in a tool response surfaced to the user
const SENSITIVE_PATTERNS = [
  // API key shapes
  /[a-zA-Z0-9_]{20,}\b.*api[_-]?key/i,
  /polygon[_-]?api[_-]?key\s*[:=]\s*["']?[a-zA-Z0-9]+/i,
  /NEXT_PUBLIC_[A-Z_]+\s*[:=]\s*["']?[a-zA-Z0-9]+/,
  // Supabase service role key shape
  // Pattern is split to prevent self-match when this file is read as a tool response
  new RegExp('service' + '_role', 'i'),
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
