import { getPolicySkipMessage } from '../llmExecutionPolicy';

describe('llmExecutionPolicy.getPolicySkipMessage', () => {
  it('maps GLOBAL_HARD_OFF to message', () => {
    expect(getPolicySkipMessage('GLOBAL_HARD_OFF' as any)).toContain('GLOBAL_HARD_OFF');
  });

  it('maps PROVIDER_NOT_IN_ALLOWLIST to message', () => {
    expect(getPolicySkipMessage('PROVIDER_NOT_IN_ALLOWLIST' as any)).toContain('PROVIDER_NOT_IN_ALLOWLIST');
  });

  it('returns default for null', () => {
    expect(getPolicySkipMessage(null)).toContain('SCHEDULER_DISABLED');
  });
});
