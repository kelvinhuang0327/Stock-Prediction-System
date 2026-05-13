/**
 * GET /api/orchestrator/llm-usage/today
 *
 * Orchestrator-namespaced alias for LLM usage — today's aggregated summary.
 * Mirrors /api/system/llm-usage but scoped to orchestrator canonical path.
 *
 * READ-ONLY.
 */

export { GET } from '@/app/api/system/llm-usage/route';
