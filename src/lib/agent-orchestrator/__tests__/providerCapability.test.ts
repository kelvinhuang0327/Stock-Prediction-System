/**
 * B-103 Provider Capability Registry Tests
 *
 * Verifies:
 *  1.  provider_capabilities.json can be parsed as valid JSON
 *  2.  copilot-daemon entry exists with required fields
 *  3.  classification is one of the three allowed values
 *  4.  WORKER_MODEL_PROPAGATION_READY classification for CLI v1.0.40
 *  5.  supportsModelParam = true (CLI --model flag confirmed)
 *  6.  modelParamFlag = "--model"
 *  7.  commandAvailable = true
 *  8.  readProviderCapabilityRegistry returns registry object
 *  9.  getProviderCapability returns copilot-daemon record
 * 10.  providerSupportsModelParam returns true for copilot-daemon
 * 11.  getProviderModelParamFlag returns "--model" for copilot-daemon
 * 12.  providerSupportsModelParam returns false for unknown provider
 * 13.  Runtime safety: schedulerEnabled = false
 * 14.  Runtime safety: plannerProvider = local-planner
 * 15.  Runtime safety: workerProvider = copilot-daemon
 * 16.  Runtime safety: workerCopilotModel = gpt-5-mini
 * 17.  No provider_execution_success records in llm_usage (baseline)
 * 18.  isValidClassification validates allowed values correctly
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// ── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const RUNTIME_DIR = join(PROJECT_ROOT, 'runtime', 'agent_orchestrator');
const CAPABILITIES_FILE = join(RUNTIME_DIR, 'provider_capabilities.json');
const SCHEDULER_STATE_FILE = join(RUNTIME_DIR, 'scheduler_state.json');
const LLM_USAGE_FILE = join(RUNTIME_DIR, 'llm_usage.jsonl');

// ── Import module under test (real FS, not mocked) ───────────────────────────
import {
  readProviderCapabilityRegistry,
  getProviderCapability,
  providerSupportsModelParam,
  getProviderModelParamFlag,
  isValidClassification,
  VALID_CLASSIFICATIONS,
} from '../providerCapabilities';

// ── Suite ────────────────────────────────────────────────────────────────────

describe('B-103 Provider Capability Registry', () => {
  // ── File-level JSON validity ───────────────────────────────────────────────

  describe('provider_capabilities.json — file validity', () => {
    it('1. file exists at runtime/agent_orchestrator/provider_capabilities.json', () => {
      expect(existsSync(CAPABILITIES_FILE)).toBe(true);
    });

    it('2. file is valid JSON', () => {
      const raw = readFileSync(CAPABILITIES_FILE, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('3. parsed registry has generatedAt, checkMethod, providers fields', () => {
      const raw = readFileSync(CAPABILITIES_FILE, 'utf-8');
      const registry = JSON.parse(raw) as Record<string, unknown>;
      expect(typeof registry['generatedAt']).toBe('string');
      expect(typeof registry['checkMethod']).toBe('string');
      expect(typeof registry['providers']).toBe('object');
    });

    it('4. copilot-daemon entry exists', () => {
      const raw = readFileSync(CAPABILITIES_FILE, 'utf-8');
      const registry = JSON.parse(raw) as { providers: Record<string, unknown> };
      expect(registry.providers['copilot-daemon']).toBeDefined();
    });
  });

  // ── Classification correctness ─────────────────────────────────────────────

  describe('provider_capabilities.json — copilot-daemon classification', () => {
    let entry: Record<string, unknown>;

    beforeAll(() => {
      const raw = readFileSync(CAPABILITIES_FILE, 'utf-8');
      const registry = JSON.parse(raw) as { providers: Record<string, Record<string, unknown>> };
      entry = registry.providers['copilot-daemon'];
    });

    it('5. classification is one of three allowed values', () => {
      expect(VALID_CLASSIFICATIONS).toContain(entry['classification']);
    });

    it('6. classification = WORKER_MODEL_PROPAGATION_READY (CLI v1.0.40 has --model flag)', () => {
      expect(entry['classification']).toBe('WORKER_MODEL_PROPAGATION_READY');
    });

    it('7. supportsModelParam = true', () => {
      expect(entry['supportsModelParam']).toBe(true);
    });

    it('8. modelParamFlag = "--model"', () => {
      expect(entry['modelParamFlag']).toBe('--model');
    });

    it('9. commandAvailable = true', () => {
      expect(entry['commandAvailable']).toBe(true);
    });

    it('10. evidence array is non-empty', () => {
      expect(Array.isArray(entry['evidence'])).toBe(true);
      expect((entry['evidence'] as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // ── TypeScript read helper ─────────────────────────────────────────────────

  describe('providerCapabilities.ts — read helpers', () => {
    it('11. readProviderCapabilityRegistry returns a registry object', () => {
      const registry = readProviderCapabilityRegistry(CAPABILITIES_FILE);
      expect(registry).not.toBeNull();
      expect(typeof registry!.generatedAt).toBe('string');
      expect(typeof registry!.providers).toBe('object');
    });

    it('12. readProviderCapabilityRegistry returns null for non-existent path', () => {
      const result = readProviderCapabilityRegistry('/nonexistent/path/capabilities.json');
      expect(result).toBeNull();
    });

    it('13. getProviderCapability returns copilot-daemon record', () => {
      const cap = getProviderCapability('copilot-daemon', CAPABILITIES_FILE);
      expect(cap).not.toBeNull();
      expect(cap!.provider).toBe('copilot-daemon');
      expect(cap!.classification).toBe('WORKER_MODEL_PROPAGATION_READY');
    });

    it('14. getProviderCapability returns null for unknown provider', () => {
      const cap = getProviderCapability('unknown-provider', CAPABILITIES_FILE);
      expect(cap).toBeNull();
    });

    it('15. providerSupportsModelParam returns true for copilot-daemon', () => {
      expect(providerSupportsModelParam('copilot-daemon', CAPABILITIES_FILE)).toBe(true);
    });

    it('16. providerSupportsModelParam returns false for unknown provider (safe default)', () => {
      expect(providerSupportsModelParam('unknown-provider', CAPABILITIES_FILE)).toBe(false);
    });

    it('17. getProviderModelParamFlag returns "--model" for copilot-daemon', () => {
      expect(getProviderModelParamFlag('copilot-daemon', CAPABILITIES_FILE)).toBe('--model');
    });

    it('18. getProviderModelParamFlag returns null for unknown provider', () => {
      expect(getProviderModelParamFlag('unknown-provider', CAPABILITIES_FILE)).toBeNull();
    });
  });

  // ── isValidClassification ─────────────────────────────────────────────────

  describe('isValidClassification', () => {
    it('19. accepts WORKER_MODEL_PROPAGATION_READY', () => {
      expect(isValidClassification('WORKER_MODEL_PROPAGATION_READY')).toBe(true);
    });

    it('20. accepts PROVIDER_MANAGED_MODEL_ONLY', () => {
      expect(isValidClassification('PROVIDER_MANAGED_MODEL_ONLY')).toBe(true);
    });

    it('21. accepts NEEDS_PROVIDER_CAPABILITY_CHECK', () => {
      expect(isValidClassification('NEEDS_PROVIDER_CAPABILITY_CHECK')).toBe(true);
    });

    it('22. rejects unknown classification', () => {
      expect(isValidClassification('UNKNOWN_VALUE')).toBe(false);
    });

    it('23. rejects null / undefined', () => {
      expect(isValidClassification(null)).toBe(false);
      expect(isValidClassification(undefined)).toBe(false);
    });
  });

  // ── Runtime safety checks ─────────────────────────────────────────────────

  describe('Runtime safety — scheduler_state.json', () => {
    let state: Record<string, unknown>;

    beforeAll(() => {
      expect(existsSync(SCHEDULER_STATE_FILE)).toBe(true);
      const raw = readFileSync(SCHEDULER_STATE_FILE, 'utf-8');
      state = JSON.parse(raw) as Record<string, unknown>;
    });

    it('24. schedulerEnabled = false', () => {
      expect(state['schedulerEnabled']).toBe(false);
    });

    it('25. plannerProvider = local-planner', () => {
      expect(state['plannerProvider']).toBe('local-planner');
    });

    it('26. workerProvider = copilot-daemon', () => {
      expect(state['workerProvider']).toBe('copilot-daemon');
    });

    it('27. workerCopilotModel = gpt-5-mini', () => {
      expect(state['workerCopilotModel']).toBe('gpt-5-mini');
    });
  });

  // ── LLM usage safety ──────────────────────────────────────────────────────

  describe('LLM usage safety — no new executions', () => {
    it('28. llm_usage.jsonl does not contain provider_execution_success from B-103', () => {
      if (!existsSync(LLM_USAGE_FILE)) return; // file may not exist in test env
      const content = readFileSync(LLM_USAGE_FILE, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      // B-103 should not have triggered any execution; guard that no new success entries
      // appear with checkedAt timestamp from today
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const todaySuccesses = lines.filter(line => {
        try {
          const rec = JSON.parse(line) as Record<string, unknown>;
          return rec['event'] === 'execution_end' &&
            rec['result'] === 'success' &&
            typeof rec['timestamp'] === 'string' &&
            (rec['timestamp'] as string).startsWith(today);
        } catch {
          return false;
        }
      });
      // B-103 itself does not trigger worker execution — only reads CLI --help
      expect(todaySuccesses.length).toBe(0);
    });
  });
});
