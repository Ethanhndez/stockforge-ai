#!/usr/bin/env node
/**
 * Anti-hallucination gate — PreToolUse hook
 *
 * Reads the pending tool input from stdin (Claude Code hook protocol),
 * checks for adversarial patterns, and exits non-zero to block if found.
 *
 * Exit codes:
 *   0 — allow
 *   2 — block (Claude Code interprets exit 2 as a hard block with message on stderr)
 */

const ADVERSARIAL_PATTERNS = [
  /will\s+\w+\s+(go\s+)?(up|down)/i,
  /should\s+i\s+(buy|sell|hold)/i,
  /is\s+\w+\s+a\s+good\s+(buy|investment|stock)/i,
  /ignore\s+(previous|prior|all)\s+instructions/i,
  /guaranteed\s+(return|profit|gain)/i,
  /certain(ty)?\s+about\s+(the\s+)?market/i,
  /pretend\s+you('re|\s+are)\s+a\s+(hedge fund|trader|investor)/i,
];

const SPECULATION_PATTERNS = [
  /will\s+(be\s+worth|reach|hit|trade\s+at)/i,
  /price\s+target/i,
  /next\s+(year|month|quarter|week)/i,
  /forecast(ed)?\s+price/i,
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
    // If we can't parse, allow through — don't block on malformed hook data
    process.exit(0);
  }

  const toolInput = JSON.stringify(payload).toLowerCase();

  for (const pattern of ADVERSARIAL_PATTERNS) {
    if (pattern.test(toolInput)) {
      process.stderr.write(
        `[AntiHallucinationGate] Blocked: adversarial pattern detected ("${pattern.source}").\n` +
        `StockForge AI does not give investment recommendations or speculate about prices.\n`
      );
      process.exit(2);
    }
  }

  for (const pattern of SPECULATION_PATTERNS) {
    if (pattern.test(toolInput)) {
      process.stderr.write(
        `[AntiHallucinationGate] Blocked: speculation pattern detected ("${pattern.source}").\n` +
        `StockForge AI provides research data only — no price predictions.\n`
      );
      process.exit(2);
    }
  }

  process.exit(0);
});
