import {
  AI_WHITELISTED_COLUMNS,
  REPORT_INDICATOR_MAP,
  type AiChatRequest,
  type AiChatResponse,
  type AiMapAction,
  type AiToolCallTrace,
  type HeadlineChoroplethMetricId,
  type ReportIndicatorId,
  type VulnerabilityCriterionId,
} from '@cbms/shared';
import { getEffectiveAiConfig } from '../../config/env.js';
import {
  detectPiiExtractionAttempt,
  sanitizeAiPayload,
} from './ai-privacy-guard.js';
import {
  aggregateWhitelistedCbmsColumn,
  compareYearOverYearStats,
  getBarangaySummaryStats,
  queryMultiDimensionIndicators,
  querySpatialFacilityCatchment,
  resolveBarangayFilter,
  searchCbmsDictionaryAndMetadata,
} from './ai-tools.service.js';

interface DetectedIntent {
  barangayGeoCode: string;
  barangayName: string | null;
  surveyYear: number;
  isYoYComparison: boolean;
  isSpatialOrLandUse: boolean;
  isDictionaryOrPolicy: boolean;
  specificColumnName: string | null;
  matchedIndicators: ReportIndicatorId[];
  matchMode: 'all' | 'any';
  choroplethMetric: HeadlineChoroplethMetricId;
  radiusMeters: number;
  landmarkSector: string;
  sortOrder: 'asc' | 'desc';
}

const INDICATOR_KEYWORDS: ReadonlyArray<{
  id: ReportIndicatorId;
  patterns: readonly RegExp[];
  vulnerabilityId?: VulnerabilityCriterionId;
  choroplethMetric?: HeadlineChoroplethMetricId;
}> = [
  {
    id: 'no_4ps_poor',
    patterns: [/\b(4ps\s+gap|not\s+covered\s+by\s+4ps|undercoverage|poor\s+without\s+4ps|no\s+4ps)\b/i],
    vulnerabilityId: 'no_4ps_poor',
    choroplethMetric: 'beneficiary_4ps_rate',
  },
  {
    id: 'beneficiary_4ps',
    patterns: [/\b(4ps|pantawid|cct)\b/i],
    choroplethMetric: 'beneficiary_4ps_rate',
  },
  {
    id: 'near_poor_5',
    patterns: [/\b(near[- ]?poor|vulnerability\s+threshold|\+5%)\b/i],
    vulnerabilityId: 'near_poor_5',
    choroplethMetric: 'near_poor_5_rate',
  },
  {
    id: 'poor',
    patterns: [/\b(poor|poverty|impoverished|indigent)\b/i],
    vulnerabilityId: 'poor',
    choroplethMetric: 'poor_rate',
  },
  {
    id: 'senior_citizen',
    patterns: [/\b(senior\s+citizens?|elderly|aged?\s*60|60\s+years?\s+old|60\+)\b/i],
    vulnerabilityId: 'senior_citizen',
  },
  {
    id: 'pwd',
    patterns: [/\b(pwds?|persons?\s+with\s+disabilit(y|ies)|disabled|disability)\b/i],
    vulnerabilityId: 'pwd',
  },
  {
    id: 'solo_parent',
    patterns: [/\b(solo\s+parents?|single\s+parents?)\b/i],
    vulnerabilityId: 'solo_parent',
  },
  {
    id: 'children_under_5',
    patterns: [/\b(under[- ]?5|children\s+under\s+5|0\s*-\s*4\s+years|infants?|toddlers?)\b/i],
  },
  {
    id: 'out_of_school_youth',
    patterns: [/\b(out[- ]?of[- ]?school|osy|not\s+attending\s+school|school\s+dropouts?)\b/i],
  },
  {
    id: 'non_literate',
    patterns: [/\b(non[- ]?literate|illiterate|literacy\s+gap|cannot\s+read)\b/i],
  },
  {
    id: 'tvet_graduate_or_attending',
    patterns: [/\b(tvet|tesda|vocational)\b/i],
  },
  {
    id: 'fisherfolk',
    patterns: [/\b(fisherfolks?|fishermen|fishing|coastal\s+livelihood)\b/i],
  },
  {
    id: 'farmer',
    patterns: [/\b(farmers?|farming|agricultur(e|al))\b/i],
  },
  {
    id: 'unemployed',
    patterns: [/\b(unemployed|unemployment|jobless|looking\s+for\s+work)\b/i],
  },
  {
    id: 'underemployed',
    patterns: [/\b(underemployed|underemployment|more\s+hours)\b/i],
  },
  {
    id: 'ofw_member',
    patterns: [/\b(ofws?|overseas\s+filipino|migrant\s+workers?)\b/i],
  },
  {
    id: 'food_insecure',
    patterns: [/\b(food\s+insecur(e|ity)|fies|hunger|hungry|skipped\s+meals?|ran\s+out\s+of\s+food)\b/i],
    vulnerabilityId: 'food_insecure',
  },
  {
    id: 'unbanked_household',
    patterns: [/\b(unbanked|no\s+bank\s+account|financial\s+account|financial\s+inclusion)\b/i],
  },
  {
    id: 'socpen_beneficiary',
    patterns: [/\b(socpen|social\s+pension)\b/i],
  },
  {
    id: 'aics_or_lgu_assistance',
    patterns: [/\b(aics|lgu\s+assistance|crisis\s+assistance)\b/i],
  },
  {
    id: 'no_philhealth',
    patterns: [/\b(no\s+philhealth|without\s+philhealth|uninsured)\b/i],
  },
  {
    id: 'unimproved_water',
    patterns: [/\b(unimproved\s+water|drinking\s+water|level\s+i\s+water|unsafe\s+water|wash|water\s+access)\b/i],
    vulnerabilityId: 'unimproved_water',
  },
  {
    id: 'unimproved_sanitation',
    patterns: [/\b(unimproved\s+sanitation|unsanitary\s+toilet|no\s+toilet|open\s+defecation|sanitation|toilet)\b/i],
  },
  {
    id: 'makeshift_housing',
    patterns: [/\b(makeshift\s+housing|salvaged|light\s+material|nipa|cogon|roof|outer\s+walls)\b/i],
    vulnerabilityId: 'makeshift_housing',
  },
  {
    id: 'informal_settler',
    patterns: [/\b(informal\s+settlers?|without\s+consent|tenure)\b/i],
  },
  {
    id: 'no_electricity',
    patterns: [/\b(no\s+electricity|without\s+electricity|off[- ]?grid|un-?electrified|electricity)\b/i],
    vulnerabilityId: 'no_electricity',
    choroplethMetric: 'electricity_rate',
  },
  {
    id: 'banca_owner',
    patterns: [/\b(bancas?|boats?|motorized\s+banca)\b/i],
  },
  {
    id: 'no_internet',
    patterns: [/\b(no\s+internet|without\s+internet|digital\s+divide|internet|broadband|connectivity)\b/i],
    vulnerabilityId: 'no_internet',
    choroplethMetric: 'internet_rate',
  },
  {
    id: 'no_puv_access',
    patterns: [/\b(puv|public\s+transport|transport\s+access)\b/i],
  },
  {
    id: 'disaster_shock',
    patterns: [/\b(disaster\s+shocks?|climate\s+shocks?|typhoons?|floods?|flooding|landslides?|calamit(y|ies))\b/i],
    vulnerabilityId: 'disaster_shock',
  },
  {
    id: 'unaware_evacuation_center',
    patterns: [/\b(unaware\s+of\s+evacuation|know\s+evacuation)\b/i],
  },
  {
    id: 'sick_without_treatment',
    patterns: [/\b(sick\s+without\s+treatment|unmet\s+medical|did\s+not\s+avail\s+treatment|illness)\b/i],
  },
  {
    id: 'unregistered_birth_lcr',
    patterns: [/\b(unregistered\s+birth|birth\s+registration|lcr|civil\s+registrar)\b/i],
  },
  {
    id: 'no_philsys_id',
    patterns: [/\b(philsys|national\s+id|phil_id)\b/i],
  },
  {
    id: 'pregnant_or_lactating',
    patterns: [/\b(pregnant|lactating|maternal|breastfeeding)\b/i],
  },
];

function parseUserIntent(req: AiChatRequest): DetectedIntent {
  const text = req.message;
  const lower = text.toLowerCase();

  // Resolve Barangay from prompt or fallback to request context
  let resolvedBrgy = resolveBarangayFilter(text);
  if (resolvedBrgy.barangayGeoCode === 'ALL' && req.activeBarangayGeoCode !== 'ALL') {
    resolvedBrgy = resolveBarangayFilter(req.activeBarangayGeoCode);
  }

  // Resolve Survey Year
  let surveyYear = req.surveyYear ?? 2024;
  if (/\b2022\b/.test(lower) && !/\b2024\b/.test(lower)) {
    surveyYear = 2022;
  } else if (/\b2024\b/.test(lower) && !/\b2022\b/.test(lower)) {
    surveyYear = 2024;
  }

  const isYoYComparison =
    (/\b2022\b/.test(lower) && /\b2024\b/.test(lower)) ||
    /\b(yoy|year[- ]over[- ]year|compare\s+years|change\s+between|trend|improvement|historical)\b/i.test(
      lower,
    );

  const isSpatialOrLandUse =
    /\b(within\s+\d+\s*m|radius|catchment|meters?\s+of|near\s+|evacuation\s+centers?|landmarks?|health\s+centers?|health\s+stations?|schools?|land\s+use|clup|forestland|mangrove|road\s+networks?|road\s+condition|st_dwithin)\b/i.test(
      lower,
    );

  const isDictionaryOrPolicy =
    /\b(how\s+does\s+cbms|what\s+columns?|which\s+columns?|what\s+is\s+section|dictionary|codebook|ra\s*10173|ra\s*11315|data\s+privacy|why\s+are\s+.*names\s+protected|define|definition|methodology|how\s+is\s+.*measured)\b/i.test(
      lower,
    );

  // Check if a specific whitelisted column identifier is directly mentioned
  let specificColumnName: string | null = null;
  for (const col of AI_WHITELISTED_COLUMNS) {
    if (lower.includes(col.columnName.toLowerCase())) {
      specificColumnName = col.columnName;
      break;
    }
  }

  // Match all referenced CBMS indicators
  const matchedIndicators: ReportIndicatorId[] = [];
  let choroplethMetric: HeadlineChoroplethMetricId = 'poor_rate';

  for (const item of INDICATOR_KEYWORDS) {
    if (item.patterns.some((rx) => rx.test(lower))) {
      // Avoid adding generic 'beneficiary_4ps' or 'poor' if 'no_4ps_poor' was specifically matched
      if (
        (item.id === 'beneficiary_4ps' || item.id === 'poor') &&
        matchedIndicators.includes('no_4ps_poor') &&
        item.patterns.length === 1
      ) {
        continue;
      }
      if (!matchedIndicators.includes(item.id)) {
        matchedIndicators.push(item.id);
      }
      if (item.choroplethMetric && choroplethMetric === 'poor_rate') {
        choroplethMetric = item.choroplethMetric;
      }
    }
  }

  const matchMode: 'all' | 'any' =
    /\b(\bor\b|either|any\s+of)\b/i.test(lower) && !/\bboth\b/i.test(lower) ? 'any' : 'all';

  const radiusMatch = lower.match(/(\d{2,4})\s*(m|meters?)\b/);
  const radiusMeters = radiusMatch ? Number(radiusMatch[1]) : 500;

  let landmarkSector = 'ALL';
  if (/\b(evacuation|drrm|gym)\b/i.test(lower)) landmarkSector = 'DRRM_EVACUATION';
  else if (/\b(health|rhu|clinic|hospital|birthing)\b/i.test(lower)) landmarkSector = 'HEALTH_WELFARE';
  else if (/\b(school|education|elementary|high\s+school)\b/i.test(lower)) landmarkSector = 'EDUCATION';

  const sortOrder: 'asc' | 'desc' = /\b(lowest|least|minimum|smallest|best)\b/i.test(lower)
    ? 'asc'
    : 'desc';

  return {
    barangayGeoCode: resolvedBrgy.barangayGeoCode,
    barangayName: resolvedBrgy.barangayName,
    surveyYear,
    isYoYComparison,
    isSpatialOrLandUse,
    isDictionaryOrPolicy,
    specificColumnName,
    matchedIndicators,
    matchMode,
    choroplethMetric,
    radiusMeters,
    landmarkSector,
    sortOrder,
  };
}

let cachedGeminiModels: string[] | null = null;
let cachedGeminiModelsTimestamp = 0;

/**
 * Dynamically discovers available generateContent-capable Gemini models for the user's API key,
 * prioritizing gemini-3.8-flash and active flash-lite / pro fallbacks when a primary model has a 503 spike.
 */
async function getAvailableGeminiModels(apiKey: string, preferredModel: string): Promise<string[]> {
  const cleanPreferred = preferredModel.replace(/^models\//, '');
  const now = Date.now();
  if (cachedGeminiModels && now - cachedGeminiModelsTimestamp < 10 * 60 * 1000) {
    return Array.from(new Set([cleanPreferred, ...cachedGeminiModels]));
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as {
        models?: Array<{
          name?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const discovered = (data.models ?? [])
        .filter(
          (m) =>
            m.name &&
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.name.includes('gemini') &&
            !m.name.includes('embedding') &&
            !m.name.includes('imagen') &&
            !m.name.includes('veo') &&
            !m.name.includes('tts') &&
            !m.name.includes('audio') &&
            !m.name.includes('2.5-flash') &&
            !m.name.includes('2.0-') &&
            !m.name.includes('1.5-'),
        )
        .map((m) => m.name!.replace(/^models\//, ''))
        .sort((a, b) => {
          const score = (name: string) => {
            if (name === cleanPreferred) return 0;
            if (name.includes('3.8-flash') && !name.includes('lite')) return 1;
            if (name.includes('flash-lite') || name.includes('lite')) return 2;
            if (name.includes('flash')) return 3;
            if (name.includes('pro')) return 4;
            return 5;
          };
          return score(a) - score(b);
        });

      if (discovered.length > 0) {
        cachedGeminiModels = discovered.slice(0, 5);
        cachedGeminiModelsTimestamp = now;
        return Array.from(new Set([cleanPreferred, ...cachedGeminiModels]));
      }
    }
  } catch {
    // Fallback to static modern model list if ListModels fails
  }

  return Array.from(
    new Set([
      cleanPreferred,
      'gemini-3.8-flash',
      'gemini-3.8-flash-lite',
      'gemini-2.5-flash-lite',
    ]),
  );
}

const sleepMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Optional External LLM Enhancement (Gemini / OpenAI / Ollama)
 * Receives ONLY the sanitized, aggregated JSON tool output (0 PII) to polish prose if configured.
 * Automatically retries transient HTTP 503 ("high demand") spikes and falls back across active models.
 */
async function tryExternalLlmPolish(
  userMessage: string,
  deterministicMarkdown: string,
  aggregatedContextJson: unknown,
): Promise<{ text: string; providerUsed: 'builtin' | 'gemini' | 'openai' | 'ollama' }> {
  const aiConfig = getEffectiveAiConfig();
  const provider = aiConfig.provider;
  if (provider === 'builtin') {
    return { text: deterministicMarkdown, providerUsed: 'builtin' };
  }

  const systemInstruction = [
    'You are the CBMS Web-GIS AI Decision Support Analyst for LGU San Jose, Province of Dinagat Islands.',
    'STRICT GUARDRAILS (RA 11315 & RA 10173):',
    '1. NEVER invent, guess, or alter numbers. Use ONLY the exact statistical numbers in the provided Aggregated Kysely/PostGIS Tool Output.',
    '2. NEVER output or claim to know individual household member names, HUSN/HSN serials, or exact street addresses.',
    '3. Keep the response concise, well-formatted in GitHub Flavored Markdown with clear tables and actionable LGU planning takeaways.',
  ].join('\n');

  const userPayload = `User Question: "${userMessage}"\n\nVerified Aggregated Tool Data (JSON):\n${JSON.stringify(
    sanitizeAiPayload(aggregatedContextJson),
  )}\n\nReference Draft:\n${deterministicMarkdown}`;

  try {
    if (provider === 'gemini' && aiConfig.apiKey) {
      const candidateModels = await getAvailableGeminiModels(
        aiConfig.apiKey,
        aiConfig.model || 'gemini-3.8-flash',
      );

      for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${aiConfig.apiKey}`;
        // Up to 2 attempts per model if experiencing temporary 503 high-demand spikes
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [{ role: 'user', parts: [{ text: userPayload }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 4096,
              },
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (res.ok) {
            const data = (await res.json()) as {
              candidates?: Array<{
                content?: {
                  parts?: Array<{ text?: string; thought?: boolean }>;
                };
              }>;
            };
            const parts = data.candidates?.[0]?.content?.parts ?? [];
            const replyText = parts
              .filter((p) => !p.thought && typeof p.text === 'string')
              .map((p) => p.text)
              .join('\n')
              .trim();
            if (replyText) {
              return { text: replyText, providerUsed: 'gemini' };
            }
            break;
          }

          const errText = await res.text().catch(() => '');
          // If 503 High Demand or 429 Rate Limit, wait briefly and retry once before moving to next active model
          if ((res.status === 503 || res.status === 429) && attempt === 1) {
            console.warn(
              `[CBMS AI Gemini] Model "${model}" experiencing temporary high demand (HTTP ${res.status}), retrying in 800ms...`,
            );
            await sleepMs(800);
            continue;
          }

          console.warn(
            `[CBMS AI Gemini] Model "${model}" returned HTTP ${res.status}: ${errText.slice(0, 200)}`,
          );
          break;
        }
      }
    } else if (provider === 'ollama') {
      const baseUrl = (aiConfig.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
      const model = aiConfig.model || 'qwen2.5:3b';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPayload },
          ],
          options: { temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as { message?: { content?: string } };
        const replyText = data.message?.content?.trim();
        if (replyText) {
          return { text: replyText, providerUsed: 'ollama' };
        }
      }
    } else if (provider === 'openai' && aiConfig.apiKey) {
      const baseUrl = (aiConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const model = aiConfig.model || 'gpt-4o-mini';
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPayload },
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const replyText = data.choices?.[0]?.message?.content?.trim();
        if (replyText) {
          return { text: replyText, providerUsed: 'openai' };
        }
      }
    }
  } catch {
    // Gracefully fallback to deterministic output if external provider is unreachable
  }

  return { text: deterministicMarkdown, providerUsed: 'builtin' };
}

/**
 * Main Entry Point: processCbmsAiChat
 * Executes the Method 5 Hybrid Tool-Calling + Whitelisted Aggregator + Dictionary RAG pipeline.
 */
export async function processCbmsAiChat(req: AiChatRequest): Promise<AiChatResponse> {
  const startMs = performance.now();
  const piiEval = detectPiiExtractionAttempt(req.message);
  const intent = parseUserIntent(req);

  // -------------------------------------------------------------------------
  // STEP 1: ZERO-PII GUARDRAIL INTERCEPTION (RA 10173 & RA 11315)
  // If the user asks for member names, household head names, HUSN/HSN serials,
  // or street addresses, refuse the PII disclosure and proactively offer safe
  // aggregated barangay statistics for the topic they asked about.
  // -------------------------------------------------------------------------
  if (piiEval.blocked) {
    const toolTraces: AiToolCallTrace[] = [
      {
        toolName: 'privacyGuardrailRefusal',
        summary: `Blocked PII extraction request (${piiEval.reason}: "${piiEval.matchedPattern ?? 'PII'}") under ${piiEval.legalCitation}`,
        tablesQueried: [],
        spatialOrDbIndexesUsed: ['zero_pii_firewall_guard'],
        executionTimeMs: Math.max(1, Math.round(performance.now() - startMs)),
        zeroPiiVerified: true,
      },
    ];

    // Still provide safe aggregated statistics for the barangay/indicator mentioned
    let safeAggregateNote = '';
    if (intent.matchedIndicators.length > 0 || intent.barangayName) {
      const multiRes = await queryMultiDimensionIndicators({
        surveyYear: intent.surveyYear,
        indicators: intent.matchedIndicators.length > 0 ? intent.matchedIndicators : ['poor'],
        matchMode: 'all',
        barangayNameOrCode: intent.barangayGeoCode,
      });
      toolTraces.push(multiRes.trace);
      const labels = multiRes.indicators.map((i) => i.label).join(' + ');
      safeAggregateNote = [
        '',
        '### Safe Aggregated Statistical Alternative (Zero-PII)',
        `While individual names cannot be accessed, here is the **anonymized statistical summary** for **${
          intent.barangayName ?? 'Municipality of San Jose (12 Barangays)'
        }** (${intent.surveyYear}):`,
        `- **Target Indicator(s)**: ${labels}`,
        `- **Matching Households**: **${multiRes.totals.matchingHouseholds.toLocaleString()}** out of **${multiRes.totals.totalHouseholds.toLocaleString()}** households (**${multiRes.totals.matchingRate}%**)`,
      ].join('\n');
    }

    const refusalReply = [
      `### Privacy & Confidentiality Guardrail (**${piiEval.legalCitation}**)`,
      '',
      'I **cannot retrieve, view, or disclose the exact names of individual household members**, household heads, Housing/Household Serial Numbers (`HUSN`/`HSN`), or exact residential street addresses.',
      '',
      '**Why this architectural boundary exists:**',
      '- **Physical Column Isolation**: Columns `a01_last_name`, `a01_first_name`, `a01_middle_name`, `a01_suffix` (`member_demographics_core` Cols 12–15), `husn`, `hsn`, and `address_house_number` are permanently excluded from all AI tools and query whitelists.',
      '- **Aggregation-Only Execution**: My tools only execute `COUNT()`, `SUM()`, and percentage `GROUP BY` aggregations at the Barangay and Municipal levels.',
      '- **Authorized Roster Access**: If you hold an authorized LGU clearance (`ADMIN`, `MUNICIPAL_STATISTICIAN`, or `MPDC`) and require an official beneficiary roster with waiver verification (`agree_to_sign_the_waiver = 1`), please use the RBAC-gated **Report Generation & Export** module.',
      safeAggregateNote,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      reply: refusalReply,
      providerUsed: 'builtin',
      privacyStatus: 'BLOCKED_PII_REQUEST',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions: [
        {
          label: 'Open RBAC Report Generator',
          targetPage: 'reports',
          surveyYear: intent.surveyYear,
        },
      ],
      suggestedFollowUps: [
        `How many households match ${
          intent.matchedIndicators[0] ?? 'poverty'
        } criteria per barangay in ${intent.surveyYear}?`,
        'Which barangay has the highest 4Ps undercoverage gap?',
        'Explain how CBMS measures multi-dimensional vulnerability across 8 dimensions.',
      ],
    };
  }

  const toolTraces: AiToolCallTrace[] = [];
  const mapActions: AiMapAction[] = [];

  // -------------------------------------------------------------------------
  // STEP 2: ROUTE TO DETERMINISTIC KYSELY / POSTGIS TOOLS
  // -------------------------------------------------------------------------

  // CASE A: Year-over-Year (2022 vs 2024) Comparison
  if (intent.isYoYComparison) {
    const yoy = await compareYearOverYearStats({
      baseYear: 2022,
      targetYear: 2024,
      barangayNameOrCode: intent.barangayGeoCode,
    });
    toolTraces.push(yoy.trace);

    const md = yoy.municipalityDelta;
    const topImprovers = [...yoy.barangayComparisons]
      .sort((a, b) => a.poorRateChangePts - b.poorRateChangePts)
      .slice(0, 12);

    const tableRows = topImprovers
      .map(
        (b) =>
          `| **${b.barangayName}** | ${b.poorRateBase}% | **${b.poorRateTarget}%** | ${
            b.poorRateChangePts > 0 ? `+${b.poorRateChangePts}` : b.poorRateChangePts
          } pts | ${b.electricityRateBase}% → **${b.electricityRateTarget}%** | ${b.internetRateBase}% → **${b.internetRateTarget}%** |`,
      )
      .join('\n');

    const draftMarkdown = [
      `### Longitudinal CBMS Comparison: **${yoy.baseYear} vs. ${yoy.targetYear}** (${yoy.barangayScope})`,
      '',
      `Across **${yoy.barangayScope}**, total enumerated households grew from **${md.householdsBase.toLocaleString()}** (${yoy.baseYear}) to **${md.householdsTarget.toLocaleString()}** (${yoy.targetYear}), covering **${md.populationTarget.toLocaleString()}** residents.`,
      '',
      '- **Poverty Incidence Delta**: Changed from **' +
        `${md.poorRateBase}%** in ${yoy.baseYear} to **${md.poorRateTarget}%** in ${yoy.targetYear} (**${
          md.poorRateChangePts > 0 ? `+${md.poorRateChangePts}` : md.poorRateChangePts
        } percentage points**).`,
      `- **Electricity Coverage**: Improved from **${md.electricityRateBase}%** to **${md.electricityRateTarget}%** (**+${md.electricityRateChangePts} pts**).`,
      `- **Home Internet Access**: Expanded from **${md.internetRateBase}%** to **${md.internetRateTarget}%** (**+${md.internetRateChangePts} pts**).`,
      `- **4Ps Coverage**: Moved from **${md.fourPsRateBase}%** to **${md.fourPsRateTarget}%** (**${md.fourPsRateChangePts} pts**).`,
      '',
      '| Barangay | 2022 Poverty % | 2024 Poverty % | YoY Poverty Delta | Electricity (2022 → 2024) | Home Internet (2022 → 2024) |',
      '| :--- | :---: | :---: | :---: | :---: | :---: |',
      tableRows,
    ].join('\n');

    mapActions.push(
      {
        label: 'Open Multi-Year YoY Analytics Page',
        targetPage: 'yoy',
        surveyYear: 2024,
      },
      {
        label: 'View 2024 Poverty Choropleth on GIS Map',
        targetPage: 'map',
        surveyYear: 2024,
        choroplethMetric: 'poor_rate',
      },
    );

    const polished = await tryExternalLlmPolish(req.message, draftMarkdown, yoy);
    return {
      reply: polished.text,
      providerUsed: polished.providerUsed,
      privacyStatus: 'CLEARED_AGGREGATE_ONLY',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions,
      suggestedFollowUps: [
        'Which barangays still have the highest 4Ps undercoverage gap in 2024?',
        'Show the breakdown of households without electricity in 2024.',
        'How many households are exposed to typhoon or flood shocks across barangays?',
      ],
    };
  }

  // CASE B: PostGIS Spatial Facility Catchment (ST_DWithin ::geography), Land Use & Roads
  if (intent.isSpatialOrLandUse) {
    const spatialRes = await querySpatialFacilityCatchment({
      surveyYear: intent.surveyYear,
      radiusMeters: intent.radiusMeters,
      sectorCategory: intent.landmarkSector,
      barangayNameOrCode: intent.barangayGeoCode,
    });
    toolTraces.push(spatialRes.trace);

    const facilityRows = spatialRes.facilitiesEvaluated
      .slice(0, 8)
      .map(
        (f) =>
          `| **${f.landmarkName}** | ${f.barangayName} | ${f.sectorCategory} | **${f.householdsInRadius.toLocaleString()}** | ${f.populationInRadius.toLocaleString()} | **${f.poorHouseholdsInRadius.toLocaleString()}** |`,
      )
      .join('\n');

    const luRows = spatialRes.landUseSummary
      .map(
        (l) =>
          `| **${l.luCategory}** | ${l.zoneCount} zones | **${l.totalAreaHectares.toLocaleString()} ha** |`,
      )
      .join('\n');

    const roadRows = spatialRes.roadNetworkSummary
      .map(
        (r) =>
          `| **${r.roadClass}** | ${r.roadCondition} | ${r.segmentCount} | **${r.totalLengthKm} km** |`,
      )
      .join('\n');

    const draftMarkdown = [
      `### PostGIS Spatial Analysis & Infrastructure Summary (${intent.surveyYear})`,
      '',
      `#### 1. Critical Facility Service Catchments (\`ST_DWithin(geom_point::geography, ${spatialRes.radiusMeters}m)\`)`,
      `Evaluated using spheroidal metric distance (\`::geography\`) over \`idx_households_geom\` and \`idx_municipal_landmarks_geom\`:`,
      '',
      `| Facility / Landmark | Barangay | Sector | HH Within ${spatialRes.radiusMeters}m | Pop Within ${spatialRes.radiusMeters}m | Poor HH in Radius |`,
      '| :--- | :--- | :--- | :---: | :---: | :---: |',
      facilityRows,
      '',
      '#### 2. Comprehensive Land Use Plan (CLUP) Zones (`land_use_zones`)',
      '| Land Use Category | Polygon Zones | Total Area (Hectares) |',
      '| :--- | :---: | :---: |',
      luRows,
      '',
      '#### 3. Municipal Road Network Inventory (`road_networks`)',
      '| Road Classification | Surface / Condition | Segments | Spheroidal Length (km) |',
      '| :--- | :--- | :---: | :---: |',
      roadRows,
    ].join('\n');

    const firstFacility = spatialRes.facilitiesEvaluated[0];
    mapActions.push({
      label: `View ${spatialRes.radiusMeters}m Facility Catchment on Web-GIS Map`,
      targetPage: 'map',
      surveyYear: intent.surveyYear,
      landmarkSector:
        intent.landmarkSector !== 'ALL'
          ? (intent.landmarkSector as AiMapAction['landmarkSector'])
          : 'DRRM_EVACUATION',
      catchmentLandmarkId: firstFacility?.landmarkId ?? 1,
      catchmentRadiusMeters: spatialRes.radiusMeters,
      enableLandUse: true,
      enableRoads: true,
    });

    const polished = await tryExternalLlmPolish(req.message, draftMarkdown, spatialRes);
    return {
      reply: polished.text,
      providerUsed: polished.providerUsed,
      privacyStatus: 'CLEARED_AGGREGATE_ONLY',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions,
      suggestedFollowUps: [
        'How many households are unaware of their barangay evacuation center location?',
        'Which barangays have the highest climate and disaster shock exposure?',
        'Compare poverty incidence across coastal barangays in 2024.',
      ],
    };
  }

  // CASE C: Specific Whitelisted Column Frequency Distribution
  if (intent.specificColumnName) {
    const colDist = await aggregateWhitelistedCbmsColumn({
      surveyYear: intent.surveyYear,
      columnName: intent.specificColumnName,
      barangayNameOrCode: intent.barangayGeoCode,
    });
    toolTraces.push(colDist.trace);

    const distRows = colDist.distribution
      .map(
        (d) =>
          `| \`${d.code}\` | **${d.label}** | **${d.count.toLocaleString()}** | **${d.percentage}%** |`,
      )
      .join('\n');

    const draftMarkdown = [
      `### CBMS Column Distribution: **${colDist.label}** (${colDist.surveyYear})`,
      `- **Database Table & Column**: \`${colDist.tableName}.${colDist.columnName}\` (Column #${colDist.columnNumber}, Section \`${colDist.sectionCode}\`, ${colDist.level} Level)`,
      `- **Geographic Scope**: ${colDist.barangayScope}`,
      `- **Total ${colDist.level === 'MEMBER' ? 'Members' : 'Households'} Evaluated**: **${colDist.totalEvaluated.toLocaleString()}**`,
      '',
      '| PSA Code | Category Description | Count | Share (%) |',
      '| :---: | :--- | :---: | :---: |',
      distRows,
    ].join('\n');

    mapActions.push({
      label: 'Explore Layer on Web-GIS Map',
      targetPage: 'map',
      surveyYear: intent.surveyYear,
      choroplethMetric: intent.choroplethMetric,
    });

    const polished = await tryExternalLlmPolish(req.message, draftMarkdown, colDist);
    return {
      reply: polished.text,
      providerUsed: polished.providerUsed,
      privacyStatus: 'CLEARED_AGGREGATE_ONLY',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions,
      suggestedFollowUps: [
        'Which barangays have the highest poverty incidence in 2024?',
        'Show the breakdown of WASH drinking water and sanitation across barangays.',
        'Compare 2022 vs 2024 CBMS indicators across San Jose.',
      ],
    };
  }

  // CASE D: CBMS Dictionary / PSA Methodology / Privacy Policy Explanation (RAG)
  if (intent.isDictionaryOrPolicy && intent.matchedIndicators.length === 0) {
    const dictRes = await searchCbmsDictionaryAndMetadata({ query: req.message });
    toolTraces.push(dictRes.trace);

    const secRows = dictRes.matchingSections
      .map(
        (s) =>
          `| **Section ${s.code}** | \`${s.tableName}\` | ${s.level} | Cols ${s.columnRange[0]}–${s.columnRange[1]} | ${s.title} |`,
      )
      .join('\n');

    const indRows = dictRes.matchingIndicators
      .slice(0, 6)
      .map(
        (i) =>
          `| \`${i.id}\` | **${i.label}** | Sec ${i.sectionCode} | \`${i.columnRef}\` |`,
      )
      .join('\n');

    const draftMarkdown = [
      '### CBMS 312-Column Schema, PSA Methodology & RA 10173 Privacy Architecture',
      '',
      `> **Zero-PII Compliance**: ${dictRes.privacyPolicySummary}`,
      '',
      '#### 1. Matching CBMS Survey Sections (`001_initial_cbms_schema.sql`)',
      '| Section | PostgreSQL Table | Grain | Column Range | Description |',
      '| :--- | :--- | :---: | :---: | :--- |',
      secRows,
      '',
      '#### 2. Key Analytical Indicators & SQL Column Formulas',
      '| Indicator ID | Label | Section | CBMS Column Predicate |',
      '| :--- | :--- | :---: | :--- |',
      indRows,
      '',
      '#### 3. Near-Poor Vulnerability Buffer Thresholds (Columns 306–311)',
      '- **`poor = 1` (Col 306)**: Household per-capita income falls below the official PSA provincial poverty threshold.',
      '- **`near_poor_5_pct` to `near_poor_25_pct` (Cols 307–311)**: Households whose income is within **+5%, +10%, +15%, +20%, or +25%** above the poverty line—identifying families highly vulnerable to falling into poverty after a typhoon, illness, or price shock.',
    ].join('\n');

    const polished = await tryExternalLlmPolish(req.message, draftMarkdown, dictRes);
    return {
      reply: polished.text,
      providerUsed: polished.providerUsed,
      privacyStatus: 'CLEARED_AGGREGATE_ONLY',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions: [
        {
          label: 'View Near-Poor (+5%) Choropleth on GIS Map',
          targetPage: 'map',
          surveyYear: intent.surveyYear,
          choroplethMetric: 'near_poor_5_rate',
        },
      ],
      suggestedFollowUps: [
        'Which barangays have the highest Near-Poor (+5%) rate in 2024?',
        'How many households have both senior citizens and food insecurity?',
        'Compare 2022 vs 2024 poverty incidence across all 12 barangays.',
      ],
    };
  }

  // CASE E: Multi-Dimension Indicator Query (1 or more specific CBMS indicators from the 8 dimensions)
  if (intent.matchedIndicators.length > 0) {
    const [multiRes, headlineRes] = await Promise.all([
      queryMultiDimensionIndicators({
        surveyYear: intent.surveyYear,
        indicators: intent.matchedIndicators,
        matchMode: intent.matchMode,
        barangayNameOrCode: intent.barangayGeoCode,
      }),
      getBarangaySummaryStats({
        surveyYear: intent.surveyYear,
        barangayNameOrCode: intent.barangayGeoCode,
        sortOrder: intent.sortOrder,
      }),
    ]);

    toolTraces.push(multiRes.trace);

    const indicatorHeaders = multiRes.indicators.map((i) => i.label).join(
      intent.matchMode === 'all' ? ' **AND** ' : ' **OR** ',
    );

    const perIndBullets = multiRes.indicators
      .map((ind) => {
        const cnt = multiRes.totals.perIndicatorTotals[ind.id] ?? 0;
        const pct =
          multiRes.totals.totalHouseholds > 0
            ? Number(((cnt / multiRes.totals.totalHouseholds) * 100).toFixed(1))
            : 0;
        return `- **${ind.label}** (\`Section ${ind.sectionCode}\` • \`${ind.columnRef}\`): **${cnt.toLocaleString()}** (${pct}% of households)`;
      })
      .join('\n');

    const sortedRows = [...multiRes.barangayBreakdown].sort((a, b) =>
      intent.sortOrder === 'asc'
        ? a.matchingRate - b.matchingRate
        : b.matchingRate - a.matchingRate,
    );

    const dynamicColHeaders = multiRes.indicators.map((i) => i.id).join(' | ');
    const dynamicColAlign = multiRes.indicators.map(() => ':---:').join(' | ');

    const brgyTableRows = sortedRows
      .map((r) => {
        const indVals = multiRes.indicators
          .map((i) => `**${(r.indicatorCounts[i.id] ?? 0).toLocaleString()}**`)
          .join(' | ');
        return `| **${r.barangayName}** | ${r.totalHouseholds.toLocaleString()} | **${r.matchingHouseholds.toLocaleString()}** | **${r.matchingRate}%** | ${indVals} |`;
      })
      .join('\n');

    const topBrgy = sortedRows[0];

    const draftMarkdown = [
      `### CBMS Multi-Dimension Statistical Analysis (${intent.surveyYear})`,
      `**Scope**: ${
        intent.barangayName
          ? `Barangay **${intent.barangayName}**`
          : 'All **12 Barangays** of San Jose, Dinagat Islands'
      } (${headlineRes.municipalityTotals.totalPopulation.toLocaleString()} population across ${multiRes.totals.totalHouseholds.toLocaleString()} households)`,
      '',
      `- **Evaluated Condition**: ${indicatorHeaders}`,
      `- **Total Matching Households**: **${multiRes.totals.matchingHouseholds.toLocaleString()}** out of **${multiRes.totals.totalHouseholds.toLocaleString()}** (**${multiRes.totals.matchingRate}%**)`,
      topBrgy
        ? `- **${intent.sortOrder === 'asc' ? 'Lowest' : 'Highest'} Concentration**: **Barangay ${
            topBrgy.barangayName
          }** with **${topBrgy.matchingHouseholds.toLocaleString()} households** (**${topBrgy.matchingRate}%**)`
        : '',
      '',
      '#### Individual Indicator Breakdown:',
      perIndBullets,
      '',
      `| Barangay | Total HH | Matching HH | Matching Rate (%) | ${dynamicColHeaders} |`,
      `| :--- | :---: | :---: | :---: | ${dynamicColAlign} |`,
      brgyTableRows,
      '',
      `*SQL Optimization Note*: Pruned query joined only \`${multiRes.prunedTablesJoined.join(
        '`, `',
      )}\` with zero PII columns accessed.`,
    ]
      .filter(Boolean)
      .join('\n');

    const vulnIds = intent.matchedIndicators.filter((id): id is VulnerabilityCriterionId =>
      [
        'poor',
        'near_poor_5',
        'senior_citizen',
        'pwd',
        'solo_parent',
        'food_insecure',
        'no_electricity',
        'no_internet',
        'no_4ps_poor',
        'unimproved_water',
        'makeshift_housing',
        'disaster_shock',
      ].includes(id),
    );

    mapActions.push({
      label: `Visualize on Web-GIS Map (${intent.choroplethMetric.replace(/_/g, ' ')})`,
      targetPage: 'map',
      surveyYear: intent.surveyYear,
      choroplethMetric: intent.choroplethMetric,
      vulnerabilityCriteria: vulnIds.length > 0 ? vulnIds : undefined,
    });

    const polished = await tryExternalLlmPolish(req.message, draftMarkdown, {
      multiDimension: multiRes,
      municipalityTotals: headlineRes.municipalityTotals,
    });

    return {
      reply: polished.text,
      providerUsed: polished.providerUsed,
      privacyStatus: 'CLEARED_AGGREGATE_ONLY',
      surveyYear: intent.surveyYear,
      toolTraces,
      mapActions,
      suggestedFollowUps: [
        `Compare 2022 vs 2024 trends for ${
          intent.barangayName ?? 'all barangays'
        }.`,
        'How many of these households are within 500m of an evacuation center or health facility?',
        'Which barangays have the highest out-of-school youth and fisherfolk households?',
      ],
    };
  }

  // CASE F: Default Executive Municipal & Barangay Headline Summary
  const summaryStats = await getBarangaySummaryStats({
    surveyYear: intent.surveyYear,
    barangayNameOrCode: intent.barangayGeoCode,
    sortBy: 'poor_rate',
    sortOrder: intent.sortOrder,
  });
  toolTraces.push(summaryStats.trace);

  const mt = summaryStats.municipalityTotals;
  const brgyRows = summaryStats.barangays
    .map(
      (b) =>
        `| **${b.barangayName}** | ${b.totalHouseholds.toLocaleString()} | ${b.totalPopulation.toLocaleString()} | **${b.poorHouseholds.toLocaleString()} (${b.poorRate}%)** | ${b.nearPoor5Rate}% | ${b.fourPsRate}% (Gap: ${b.no4psPoorHouseholds}) | ${b.electricityRate}% | ${b.internetRate}% |`,
    )
    .join('\n');

  const draftMarkdown = [
    `### CBMS Socio-Economic Statistical Summary — ${
      intent.barangayName ? `Barangay ${intent.barangayName}` : 'Municipality of San Jose'
    } (${summaryStats.surveyYear})`,
    '',
    `- **Total Enumerated Households**: **${mt.totalHouseholds.toLocaleString()}** (**${mt.totalPopulation.toLocaleString()}** residents: ${mt.totalMales.toLocaleString()} males, ${mt.totalFemales.toLocaleString()} females)`,
    `- **Poverty Incidence (\`poor = 1\`)**: **${mt.poorHouseholds.toLocaleString()} households** (**${mt.poorRate}%**)`,
    `- **Near-Poor Vulnerability (\`+5% buffer\`)**: **${mt.nearPoor5Households.toLocaleString()} households** (**${mt.nearPoor5Rate}%**)`,
    `- **4Ps Coverage & Gap (\`m05_a_4ps\`)**: **${mt.fourPsHouseholds.toLocaleString()}** covered (**${mt.fourPsRate}%**) • **${mt.no4psPoorHouseholds.toLocaleString()}** poor households not yet enrolled in 4Ps`,
    `- **Infrastructure Access**: **${mt.electricityRate}%** with electricity • **${mt.internetRate}%** with home internet`,
    '',
    '| Barangay | Households | Population | Poor HH (%) | Near-Poor +5% | 4Ps Coverage & Gap | Electricity % | Internet % |',
    '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |',
    brgyRows,
  ].join('\n');

  mapActions.push({
    label: 'Open Barangay Choropleth on Web-GIS Map',
    targetPage: 'map',
    surveyYear: intent.surveyYear,
    choroplethMetric: 'poor_rate',
  });

  const polished = await tryExternalLlmPolish(req.message, draftMarkdown, summaryStats);
  return {
    reply: polished.text,
    providerUsed: polished.providerUsed,
    privacyStatus: 'CLEARED_AGGREGATE_ONLY',
    surveyYear: intent.surveyYear,
    toolTraces,
    mapActions,
    suggestedFollowUps: [
      'Which barangays have the highest number of senior citizens, PWDs, and food insecurity?',
      'Show the WASH (unimproved water & sanitation) and makeshift housing breakdown.',
      'Compare 2022 vs 2024 poverty incidence and internet coverage across barangays.',
    ],
  };
}
