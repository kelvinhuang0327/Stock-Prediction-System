import { GET } from '../route'
import { NextRequest } from 'next/server'

// Mock fetch
global.fetch = jest.fn()

describe('TWSE API Route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should successfully proxy TWSE API request', async () => {
        const mockData = [
            { Code: '2330', Name: '台積電', ClosingPrice: 580 },
        ]

            ; (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockData,
            })

        const request = new NextRequest('http://localhost:3000/api/twse/exchangeReport')
        const params = Promise.resolve({ path: ['exchangeReport'] })

        const response = await GET(request, { params })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data).toEqual(mockData)
        expect(global.fetch).toHaveBeenCalledWith(
            'https://openapi.twse.com.tw/v1/exchangeReport',
            expect.any(Object)
        )
    })

    it('should handle nested paths correctly', async () => {
        const mockData = { result: 'success' }

            ; (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: async () => mockData,
            })

        const request = new NextRequest('http://localhost:3000/api/twse/stock/day/2330')
        const params = Promise.resolve({ path: ['stock', 'day', '2330'] })

        const response = await GET(request, { params })

        expect(global.fetch).toHaveBeenCalledWith(
            'https://openapi.twse.com.tw/v1/stock/day/2330',
            expect.any(Object)
        )
    })

    it('should return error when TWSE API returns non-ok status', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 404,
        })

        const request = new NextRequest('http://localhost:3000/api/twse/invalid')
        const params = Promise.resolve({ path: ['invalid'] })

        const response = await GET(request, { params })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data).toHaveProperty('error')
        expect(data.error).toContain('TWSE API error')
    })

    it('should handle network errors', async () => {
        ; (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

        const request = new NextRequest('http://localhost:3000/api/twse/exchangeReport')
        const params = Promise.resolve({ path: ['exchangeReport'] })

        const response = await GET(request, { params })
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data).toHaveProperty('error')
        expect(data.error).toBe('Failed to fetch from TWSE API')
    })

    it('should include caching headers', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ data: 'test' }),
        })

        const request = new NextRequest('http://localhost:3000/api/twse/exchangeReport')
        const params = Promise.resolve({ path: ['exchangeReport'] })

        const response = await GET(request, { params })

        const cacheControl = response.headers.get('Cache-Control')
        expect(cacheControl).toContain('public')
        expect(cacheControl).toContain('s-maxage=300')
    })

    it('should send correct headers to TWSE API', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({}),
        })

        const request = new NextRequest('http://localhost:3000/api/twse/test')
        const params = Promise.resolve({ path: ['test'] })

        await GET(request, { params })

        expect(global.fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Accept': 'application/json',
                }),
            })
        )
    })
})
