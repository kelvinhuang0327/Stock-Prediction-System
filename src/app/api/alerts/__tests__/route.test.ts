/** @jest-environment node */

export {};

const mockFindMany = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    priceAlert: {
      findMany: mockFindMany,
      create: mockCreate,
      delete: mockDelete,
    },
  },
}));

describe('/api/alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockResolvedValue({ id: 1, symbol: '2330', type: 'above', target: 1000, isActive: true });
    mockDelete.mockResolvedValue({ id: 1 });
  });

  it('lists only active alerts in newest-first order', async () => {
    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true }, orderBy: { createdAt: 'desc' },
    });
  });

  it('returns an error when alert listing fails', async () => {
    mockFindMany.mockRejectedValue(new Error('database unavailable'));
    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to fetch alerts' });
  });

  it.each([
    [{ type: 'above', value: 1000 }],
    [{ symbol: '2330', value: 1000 }],
    [{ symbol: '2330', type: 'above' }],
  ])('rejects a request missing a required field', async body => {
    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/alerts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Missing required fields' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates an active alert with a numeric target', async () => {
    const { POST } = await import('../route');
    const response = await POST(new Request('http://localhost/api/alerts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: '2330', type: 'above', value: '1000.5' }),
    }) as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ symbol: '2330', target: 1000, isActive: true });
    expect(mockCreate).toHaveBeenCalledWith({
      data: { symbol: '2330', type: 'above', target: 1000.5, isActive: true },
    });
  });

  it('returns an error when alert creation fails', async () => {
    mockCreate.mockRejectedValue(new Error('write failed'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { POST } = await import('../route');
      const response = await POST(new Request('http://localhost/api/alerts', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbol: '2330', type: 'above', value: 1000 }),
      }) as never);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to create alert' });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('requires an id before deleting an alert', async () => {
    const { DELETE } = await import('../route');
    const response = await DELETE(new Request('http://localhost/api/alerts') as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'ID is required' });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes the numeric id and reports storage failures', async () => {
    const { DELETE } = await import('../route');
    const success = await DELETE(new Request('http://localhost/api/alerts?id=42') as never);

    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 42 } });

    mockDelete.mockRejectedValue(new Error('delete failed'));
    const failure = await DELETE(new Request('http://localhost/api/alerts?id=42') as never);
    expect(failure.status).toBe(500);
    expect(await failure.json()).toEqual({ error: 'Failed to delete alert' });
  });

  it('returns an error when the request body is invalid JSON', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const { POST } = await import('../route');
      const response = await POST(new Request('http://localhost/api/alerts', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
      }) as never);

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Failed to create alert' });
    } finally {
      errorSpy.mockRestore();
    }
  });
});
