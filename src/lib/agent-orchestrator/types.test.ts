import { isTerminalTaskStatus } from './types';

describe('types.isTerminalTaskStatus', () => {
  test('returns true for terminal statuses (happy path)', () => {
    expect(isTerminalTaskStatus('COMPLETED')).toBe(true);
  });

  test('returns false for non-terminal statuses (error path)', () => {
    expect(isTerminalTaskStatus('RUNNING')).toBe(false);
  });

  test('handles unknown string gracefully (edge case)', () => {
    // Type-level safety means unknown values shouldn't occur, but function should return false
    // @ts-ignore: deliberate
    expect(isTerminalTaskStatus('SOMETHING_ELSE')).toBe(false);
  });
});
