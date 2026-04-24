/**
 * ResearchStateMachine — Phase H tests
 */

import {
  isTransitionAllowed,
  attemptTransition,
  getReachableStates,
  deriveEvidenceLevelFromMetrics,
  derivePostRunStatus,
} from '../ResearchStateMachine';

describe('ResearchStateMachine', () => {
  describe('isTransitionAllowed', () => {
    it('allows IDEA → READY', () => {
      expect(isTransitionAllowed('IDEA', 'READY')).toBe(true);
    });

    it('allows IDEA → BLOCKED', () => {
      expect(isTransitionAllowed('IDEA', 'BLOCKED')).toBe(true);
    });

    it('allows READY → RUNNING', () => {
      expect(isTransitionAllowed('READY', 'RUNNING')).toBe(true);
    });

    it('allows RUNNING → VALIDATED', () => {
      expect(isTransitionAllowed('RUNNING', 'VALIDATED')).toBe(true);
    });

    it('allows RUNNING → REJECTED', () => {
      expect(isTransitionAllowed('RUNNING', 'REJECTED')).toBe(true);
    });

    it('allows RUNNING → PARTIAL', () => {
      expect(isTransitionAllowed('RUNNING', 'PARTIAL')).toBe(true);
    });

    it('allows PARTIAL → RUNNING', () => {
      expect(isTransitionAllowed('PARTIAL', 'RUNNING')).toBe(true);
    });

    it('allows PARTIAL → VALIDATED', () => {
      expect(isTransitionAllowed('PARTIAL', 'VALIDATED')).toBe(true);
    });

    it('allows BLOCKED → READY', () => {
      expect(isTransitionAllowed('BLOCKED', 'READY')).toBe(true);
    });

    it('rejects VALIDATED → RUNNING (terminal state)', () => {
      expect(isTransitionAllowed('VALIDATED', 'RUNNING')).toBe(false);
    });

    it('rejects REJECTED → RUNNING (terminal state)', () => {
      expect(isTransitionAllowed('REJECTED', 'RUNNING')).toBe(false);
    });

    it('rejects IDEA → VALIDATED (must go through RUNNING)', () => {
      expect(isTransitionAllowed('IDEA', 'VALIDATED')).toBe(false);
    });

    it('rejects READY → VALIDATED (must go through RUNNING)', () => {
      expect(isTransitionAllowed('READY', 'VALIDATED')).toBe(false);
    });

    it('allows any state → DEFERRED', () => {
      expect(isTransitionAllowed('IDEA', 'DEFERRED')).toBe(true);
      expect(isTransitionAllowed('READY', 'DEFERRED')).toBe(true);
      expect(isTransitionAllowed('BLOCKED', 'DEFERRED')).toBe(true);
      expect(isTransitionAllowed('PARTIAL', 'DEFERRED')).toBe(true);
    });
  });

  describe('attemptTransition', () => {
    it('returns allowed with condition for valid transitions', () => {
      const result = attemptTransition('READY', 'RUNNING');
      expect(result.allowed).toBe(true);
      expect(result.from).toBe('READY');
      expect(result.to).toBe('RUNNING');
      expect(result.reason).toBeTruthy();
    });

    it('returns denied with reason for invalid transitions', () => {
      const result = attemptTransition('IDEA', 'VALIDATED');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });
  });

  describe('getReachableStates', () => {
    it('returns all reachable states from IDEA', () => {
      const states = getReachableStates('IDEA');
      expect(states).toContain('READY');
      expect(states).toContain('BLOCKED');
      expect(states).toContain('DEFERRED');
      expect(states).not.toContain('VALIDATED');
    });

    it('returns all reachable states from RUNNING', () => {
      const states = getReachableStates('RUNNING');
      expect(states).toContain('PARTIAL');
      expect(states).toContain('VALIDATED');
      expect(states).toContain('REJECTED');
      expect(states).toContain('BLOCKED');
    });

    it('returns empty for terminal states', () => {
      expect(getReachableStates('VALIDATED')).toHaveLength(0);
      expect(getReachableStates('REJECTED')).toHaveLength(0);
    });
  });

  describe('deriveEvidenceLevelFromMetrics', () => {
    it('returns VERIFIED for large stable samples', () => {
      expect(deriveEvidenceLevelFromMetrics(30, true, 'STABLE')).toBe('VERIFIED');
    });

    it('returns INFERRED for moderate samples', () => {
      expect(deriveEvidenceLevelFromMetrics(15, true)).toBe('INFERRED');
    });

    it('returns NEEDS_DATA for insufficient samples', () => {
      expect(deriveEvidenceLevelFromMetrics(0, false)).toBe('NEEDS_DATA');
    });

    it('returns NEEDS_DATA when hasSufficientData is false', () => {
      expect(deriveEvidenceLevelFromMetrics(50, false)).toBe('NEEDS_DATA');
    });
  });

  describe('derivePostRunStatus', () => {
    it('returns VALIDATED when success criteria met', () => {
      expect(derivePostRunStatus({
        sampleSize: 30,
        hasSufficientData: true,
        meetsSuccessCriteria: true,
        evidenceContradicts: false,
        dataWentUnavailable: false,
      })).toBe('VALIDATED');
    });

    it('returns REJECTED when evidence contradicts', () => {
      expect(derivePostRunStatus({
        sampleSize: 30,
        hasSufficientData: true,
        meetsSuccessCriteria: false,
        evidenceContradicts: true,
        dataWentUnavailable: false,
      })).toBe('REJECTED');
    });

    it('returns BLOCKED when data unavailable', () => {
      expect(derivePostRunStatus({
        sampleSize: 0,
        hasSufficientData: false,
        meetsSuccessCriteria: false,
        evidenceContradicts: false,
        dataWentUnavailable: true,
      })).toBe('BLOCKED');
    });

    it('returns PARTIAL for insufficient data', () => {
      expect(derivePostRunStatus({
        sampleSize: 5,
        hasSufficientData: false,
        meetsSuccessCriteria: false,
        evidenceContradicts: false,
        dataWentUnavailable: false,
      })).toBe('PARTIAL');
    });

    it('returns PARTIAL when data sufficient but criteria not met', () => {
      expect(derivePostRunStatus({
        sampleSize: 20,
        hasSufficientData: true,
        meetsSuccessCriteria: false,
        evidenceContradicts: false,
        dataWentUnavailable: false,
      })).toBe('PARTIAL');
    });
  });
});
