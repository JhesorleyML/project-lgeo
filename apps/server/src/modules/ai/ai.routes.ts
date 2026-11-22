import { Router } from 'express';
import {
  AI_FORBIDDEN_PII_COLUMNS,
  AI_WHITELISTED_COLUMNS,
  AiChatRequestSchema,
  CBMS_AI_STARTER_PROMPTS,
} from '@cbms/shared';
import { getEffectiveAiConfig } from '../../config/env.js';
import { processCbmsAiChat } from './ai-orchestrator.service.js';

export const aiRouter = Router();

/**
 * GET /api/v1/ai/metadata
 * Returns AI Decision Support architecture details, starter prompts, active provider,
 * and RA 10173 / RA 11315 Zero-PII column isolation metadata.
 */
aiRouter.get('/metadata', (_req, res) => {
  const aiConfig = getEffectiveAiConfig();
  res.json({
    architecture: 'HYBRID_TOOL_CALLING_AND_DICTIONARY_RAG',
    activeProvider: aiConfig.provider,
    activeModel: aiConfig.model,
    hasApiKeyConfigured: aiConfig.apiKey.length > 0,
    zeroPiiEnforced: true,
    complianceStandards: ['RA 11315 (CBMS Act)', 'RA 10173 (Data Privacy Act of 2012)'],
    forbiddenPiiColumnsCount: AI_FORBIDDEN_PII_COLUMNS.length,
    whitelistedAnalyticalColumnsCount: AI_WHITELISTED_COLUMNS.length,
    starterPrompts: CBMS_AI_STARTER_PROMPTS,
  });
});

/**
 * POST /api/v1/ai/chat
 * Processes a natural language statistical or spatial CBMS query using Method 5
 * (Hybrid Tool-Calling + Whitelisted 312-Column Aggregator + Dictionary RAG)
 * with strict Zero-PII enforcement.
 */
aiRouter.post('/chat', async (req, res) => {
  const parsed = AiChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid AI chat request payload',
      details: parsed.error.flatten(),
    });
    return;
  }

  try {
    const response = await processCbmsAiChat(parsed.data);
    res.json(response);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to process CBMS AI chat query',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});
