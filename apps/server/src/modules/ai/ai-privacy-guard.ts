import {
  AI_FORBIDDEN_PII_COLUMNS,
  AI_FORBIDDEN_PII_SET,
  AI_WHITELISTED_COLUMN_MAP,
  type AiWhitelistedColumnMeta,
} from '@cbms/shared';

export class PiiAccessViolationError extends Error {
  public readonly columnName: string;

  constructor(columnName: string, message?: string) {
    super(
      message ??
        `[RA 10173 / RA 11315 Violation Blocked]: Column "${columnName}" is restricted PII or not in the AI analytical column whitelist.`,
    );
    this.name = 'PiiAccessViolationError';
    this.columnName = columnName;
  }
}

export interface PiiGuardEvaluation {
  blocked: boolean;
  reason?:
    | 'MEMBER_NAME_EXTRACTION'
    | 'SERIAL_OR_UUID_EXTRACTION'
    | 'EXACT_ADDRESS_OR_GPS_EXTRACTION'
    | 'DIRECT_PII_COLUMN_REFERENCE';
  matchedPattern?: string;
  legalCitation: string;
}

const POLICY_EXPLANATION_PATTERNS: readonly RegExp[] = [
  /\bwhy\b.*\b(name|names|pii|personal|protected|redacted|hidden|cannot|can't)\b/i,
  /\bhow\b.*\b(ra\s*10173|ra\s*11315|privacy|protect|anonymiz)/i,
  /\bexplain\b.*\b(ra\s*10173|ra\s*11315|privacy|confidentiality|waiver)\b/i,
];

const DIRECT_PII_COLUMN_REGEX = new RegExp(
  `\\b(${AI_FORBIDDEN_PII_COLUMNS.join('|')})\\b`,
  'i',
);

const MEMBER_NAME_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /\b(what\s+are\s+the\s+names|list\s+the\s+names|show\s+(me\s+)?(the\s+)?names|give\s+(me\s+)?(the\s+)?names|tell\s+(me\s+)?(the\s+)?names)\b/i,
  /\b(names?\s+of\s+(the\s+)?(household|member|members|head|heads|pwd|pwds|senior|seniors|beneficiar|resident|people|person|citizens|children|youth|farmer|fisherfolk|solo\s+parent|poor))\b/i,
  /\b(who\s+is\s+the\s+(household\s+)?head|who\s+are\s+the\s+(household\s+)?(members|heads|residents|beneficiaries|pwds|seniors|poor))\b/i,
  /\b(first\s+name|last\s+name|middle\s+name|surname|full\s+name)s?\s+(of|in|for|from)\b/i,
  /\b(identify|name)\s+(the\s+|each\s+|all\s+|every\s+)?(individual|person|resident|household\s+head|member|beneficiary)\b/i,
  /\bwho\s+lives\s+(in|at|near)\b/i,
];

const SERIAL_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /\b(list|show|give|what\s+is|what\s+are)\s+(the\s+)?(husn|hsn|cbms_uuid|serial\s+number|household\s+serial|housing\s+unit\s+serial)\b/i,
];

const ADDRESS_OR_GPS_EXTRACTION_PATTERNS: readonly RegExp[] = [
  /\b(exact\s+(house\s+number|street\s+address|home\s+address|gps\s+coordinates?|latitude\s+and\s+longitude))\s+(of|for)\b/i,
  /\b(house\s+number|home\s+address)\s+of\s+(the\s+)?(poor|pwd|senior|household|member|beneficiar)/i,
];

/**
 * Evaluates a user prompt before any LLM or SQL tool invocation to block attempts
 * to extract individual member names, HUSN/HSN serials, or exact street addresses.
 */
export function detectPiiExtractionAttempt(prompt: string): PiiGuardEvaluation {
  const normalized = prompt.trim();
  const legalCitation =
    'RA 10173 (Data Privacy Act of 2012) & RA 11315 (CBMS Act Section 10 — Confidentiality of Information)';

  // Allow educational questions asking WHY names/PII are protected
  if (
    POLICY_EXPLANATION_PATTERNS.some((rx) => rx.test(normalized)) &&
    !DIRECT_PII_COLUMN_REGEX.test(normalized)
  ) {
    return { blocked: false, legalCitation };
  }

  const directColMatch = normalized.match(DIRECT_PII_COLUMN_REGEX);
  if (directColMatch) {
    return {
      blocked: true,
      reason: 'DIRECT_PII_COLUMN_REFERENCE',
      matchedPattern: directColMatch[0],
      legalCitation,
    };
  }

  for (const rx of MEMBER_NAME_EXTRACTION_PATTERNS) {
    const match = normalized.match(rx);
    if (match) {
      return {
        blocked: true,
        reason: 'MEMBER_NAME_EXTRACTION',
        matchedPattern: match[0],
        legalCitation,
      };
    }
  }

  for (const rx of SERIAL_EXTRACTION_PATTERNS) {
    const match = normalized.match(rx);
    if (match) {
      return {
        blocked: true,
        reason: 'SERIAL_OR_UUID_EXTRACTION',
        matchedPattern: match[0],
        legalCitation,
      };
    }
  }

  for (const rx of ADDRESS_OR_GPS_EXTRACTION_PATTERNS) {
    const match = normalized.match(rx);
    if (match) {
      return {
        blocked: true,
        reason: 'EXACT_ADDRESS_OR_GPS_EXTRACTION',
        matchedPattern: match[0],
        legalCitation,
      };
    }
  }

  return { blocked: false, legalCitation };
}

/**
 * Validates that a requested CBMS column is strictly non-PII and exists in AI_WHITELISTED_COLUMNS.
 * Throws PiiAccessViolationError if any forbidden PII column or unknown identifier is passed.
 */
export function assertZeroPiiColumn(columnName: string): AiWhitelistedColumnMeta {
  const clean = columnName.trim().toLowerCase();
  if (AI_FORBIDDEN_PII_SET.has(clean)) {
    throw new PiiAccessViolationError(
      columnName,
      `[RA 10173 / RA 11315 Security Block]: Column "${columnName}" contains protected Personal Identifiable Information (PII) and is physically excluded from AI access.`,
    );
  }

  const meta = AI_WHITELISTED_COLUMN_MAP.get(clean);
  if (!meta) {
    throw new PiiAccessViolationError(
      columnName,
      `Column "${columnName}" is not in the approved non-PII CBMS analytical column whitelist.`,
    );
  }

  return meta;
}

/**
 * Recursively strips any forbidden PII keys from an object before it can ever reach an LLM or HTTP response.
 */
export function sanitizeAiPayload<T>(payload: T): T {
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeAiPayload(item)) as unknown as T;
  }

  const record = payload as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (AI_FORBIDDEN_PII_SET.has(key.toLowerCase())) {
      continue;
    }
    cleaned[key] = sanitizeAiPayload(value);
  }

  return cleaned as T;
}
