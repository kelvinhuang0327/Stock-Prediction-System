import { POST } from '../route'
import { syncService } from '@/lib/services/syncService'

// Mock syncService
jest.mock('@/lib/services/syncService', () => ({
    syncService: {
        syncAll: jest.fn(),
    },
}))

describe('Sync API Route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should successfully trigger sync', async () => {
        const mockResult = {
            stocksSynced: 100,
            quotesSynced: 500,
            newsSynced: 20,
        }

            ; (syncService.syncAll as jest.Mock).mockResolvedValue(mockResult)

        const response = await POST()
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toBe('Sync completed')
        expect(data.details).toEqual(mockResult)
        expect(syncService.syncAll).toHaveBeenCalledTimes(1)
    })

    it('should handle sync errors', async () => {
        ; (syncService.syncAll as jest.Mock).mockRejectedValue(new Error('Database connection failed'))

        const response = await POST()
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.success).toBe(false)
        expect(data.error).toBe('Sync failed')
    })

    it('should return JSON response', async () => {
        ; (syncService.syncAll as jest.Mock).mockResolvedValue({})

        const response = await POST()

        expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('should call syncAll only once per request', async () => {
        ; (syncService.syncAll as jest.Mock).mockResolvedValue({})

        await POST()

        expect(syncService.syncAll).toHaveBeenCalledTimes(1)
    })
})
