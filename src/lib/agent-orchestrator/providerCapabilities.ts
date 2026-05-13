import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ProviderCapabilityClassification =
  | 'WORKER_MODEL_PROPAGATION_READY'
  | 'PROVIDER_MANAGED_MODEL_ONLY'
  | 'NEEDS_PROVIDER_CAPABILITY_CHECK';

export interface ProviderCapabilityRecord {
  provider: string;
  checkedAt: string;
  cliVersion?: string;
  command: string;
  commandAvailable: boolean;
  supportsModelParam: boolean | null;
  modelParamFlag: string | null;
  supportsReasoningEffort?: boolean;
  reasoningEffortFlag?: string | null;
  supportsModelDiscovery: boolean;
  actualModelDiscoverable: boolean;
  defaultDesiredModel?: string;
  actualModelFallback: string;
  classification: ProviderCapabilityClassification;
  evidence: string[];
  notes?: string;
  b101Impact?: string;
  actionRequired?: string;
}

export interface ProviderCapabilityRegistry {
  generatedAt: string;
  checkMethod: string;
  providers: Record<string, ProviderCapabilityRecord>;
}

const REGISTRY_PATH = join(process.cwd(), 'runtime', 'agent_orchestrator', 'provider_capabilities.json');

const VALID_CLASSIFICATIONS: ProviderCapabilityClassification[] = [
  'WORKER_MODEL_PROPAGATION_READY',
  'PROVIDER_MANAGED_MODEL_ONLY',
  'NEEDS_PROVIDER_CAPABILITY_CHECK',
];

/**
 * Read the provider capability registry from disk.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readProviderCapabilityRegistry(
  registryPath: string = REGISTRY_PATH,
): ProviderCapabilityRegistry | null {
  if (!existsSync(registryPath)) return null;
  try {
    const raw = readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(raw) as ProviderCapabilityRegistry;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Get capability record for a specific provider.
 * Returns null if registry or provider entry is missing.
 */
export function getProviderCapability(
  providerName: string,
  registryPath?: string,
): ProviderCapabilityRecord | null {
  const registry = readProviderCapabilityRegistry(registryPath);
  if (!registry) return null;
  return registry.providers[providerName] ?? null;
}

/**
 * Check whether a provider supports an explicit model parameter.
 * Returns false (conservative fallback) when registry is unavailable.
 */
export function providerSupportsModelParam(
  providerName: string,
  registryPath?: string,
): boolean {
  const cap = getProviderCapability(providerName, registryPath);
  return cap?.supportsModelParam === true;
}

/**
 * Get the model param flag for a provider (e.g. "--model").
 * Returns null when registry is unavailable or flag is not applicable.
 */
export function getProviderModelParamFlag(
  providerName: string,
  registryPath?: string,
): string | null {
  const cap = getProviderCapability(providerName, registryPath);
  return cap?.modelParamFlag ?? null;
}

/**
 * Returns true if the classification is a recognised valid value.
 */
export function isValidClassification(value: unknown): value is ProviderCapabilityClassification {
  return VALID_CLASSIFICATIONS.includes(value as ProviderCapabilityClassification);
}

export { REGISTRY_PATH, VALID_CLASSIFICATIONS };
