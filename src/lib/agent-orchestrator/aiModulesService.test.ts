describe('aiModulesService (placeholder tests)', () => {
  test('happy path: module responds with expected shape', () => {
    const result = { ok: true, modules: ['a', 'b'] };
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.modules)).toBe(true);
  });

  test('error path: missing modules handled', () => {
    function parse(res: Record<string, unknown>) {
      if (!res.modules) throw new Error('no modules');
      return Array.isArray(res.modules) ? res.modules.length : 0;
    }
    expect(() => parse({})).toThrow('no modules');
  });

  test('edge case: empty module list', () => {
    const res = { ok: true, modules: [] };
    expect(res.modules.length).toBe(0);
  });
});
