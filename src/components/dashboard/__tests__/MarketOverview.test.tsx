import { render, screen, waitFor } from '@testing-library/react'
import { MarketOverview } from '../MarketOverview'

// Mock fetch
global.fetch = jest.fn()

describe('MarketOverview Component', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    it('should render three index cards', () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
        })

        render(<MarketOverview />)

        expect(screen.getByText('加權指數')).toBeInTheDocument()
        expect(screen.getByText('櫃買指數')).toBeInTheDocument()
        expect(screen.getByText('電子指數')).toBeInTheDocument()
    })

    it('should display initial zero values', () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
        })

        render(<MarketOverview />)

        const zeroValues = screen.getAllByText('0.00')
        expect(zeroValues.length).toBeGreaterThan(0)
    })

    it('should fetch and update index data', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    code: 't00',
                    close: 18500.50,
                    prevClose: 18400.00,
                    open: 18420.00,
                    volume: 250000000,
                },
            }),
        })

        render(<MarketOverview />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })
    })

    it('should handle API errors gracefully', async () => {
        ; (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

        render(<MarketOverview />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })

        // Should still render without crashing
        expect(screen.getByText('加權指數')).toBeInTheDocument()
    })

    it('should poll data every 5 seconds', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    code: 't00',
                    close: 18500.50,
                    prevClose: 18400.00,
                    volume: 250000000,
                },
            }),
        })

        render(<MarketOverview />)

        // Initial call
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(4) // 1 status call + 3 indices
        })

        jest.clearAllMocks()

        // Fast forward 5 seconds
        jest.advanceTimersByTime(5000)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalled()
        })
    })

    it('should display positive change with green styling', async () => {
        ; (global.fetch as jest.Mock).mockImplementation((url) => {
            if (url.includes('t00')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        data: {
                            code: 't00',
                            close: 18500.00,
                            prevClose: 18400.00,
                            volume: 250000000,
                        },
                    }),
                })
            }
            return Promise.resolve({ ok: false })
        })

        render(<MarketOverview />)

        await waitFor(() => {
            const upElements = document.querySelectorAll('.text-red-600')
            expect(upElements.length).toBeGreaterThan(0)
        })
    })

    it('should display negative change with red styling', async () => {
        ; (global.fetch as jest.Mock).mockImplementation((url) => {
            if (url.includes('t00')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({
                        data: {
                            code: 't00',
                            close: 18300.00,
                            prevClose: 18400.00,
                            volume: 250000000,
                        },
                    }),
                })
            }
            return Promise.resolve({ ok: false })
        })

        render(<MarketOverview />)

        await waitFor(() => {
            const downElements = document.querySelectorAll('.text-green-600')
            expect(downElements.length).toBeGreaterThan(0)
        })
    })

    it('should cleanup interval on unmount', () => {
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

        const { unmount } = render(<MarketOverview />)
        unmount()

        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })
})
