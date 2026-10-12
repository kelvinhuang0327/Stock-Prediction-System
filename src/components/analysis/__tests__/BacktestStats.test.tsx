import { render, screen } from '@testing-library/react'
import { BacktestStats } from '../BacktestStats'

describe('BacktestStats Component', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    it('should render loading state initially', () => {
        render(<BacktestStats />)
        const loadingElement = document.querySelector('.animate-pulse')
        expect(loadingElement).toBeInTheDocument()
    })

    it('should display stats after loading', async () => {
        render(<BacktestStats />)

        // Fast-forward timers to skip loading
        jest.advanceTimersByTime(1000)

        // Wait for the component to update
        await screen.findByText(/系統準確度驗證/)

        // Check if main stats are displayed
        expect(screen.getByText(/總合準確率/)).toBeInTheDocument()
        expect(screen.getByText(/30.48%/)).toBeInTheDocument()
        expect(screen.getByText(/驗證次數/)).toBeInTheDocument()
        expect(screen.getByText('105')).toBeInTheDocument()
    })

    it('should display buy and sell accuracy', async () => {
        render(<BacktestStats />)

        jest.advanceTimersByTime(1000)

        await screen.findByText(/買入訊號準確/)

        expect(screen.getByText(/買入訊號準確/)).toBeInTheDocument()
        expect(screen.getByText('100%')).toBeInTheDocument()
        expect(screen.getByText(/賣出訊號準確/)).toBeInTheDocument()
        expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('should display last run date', async () => {
        render(<BacktestStats />)

        jest.advanceTimersByTime(1000)

        await screen.findByText(/最後更新/)

        const today = new Date().toISOString().split('T')[0]
        expect(screen.getByText(new RegExp(today))).toBeInTheDocument()
    })

    it('should have proper glass-card styling', async () => {
        render(<BacktestStats />)

        jest.advanceTimersByTime(1000)

        const container = await screen.findByText(/系統準確度驗證/)
        const card = container.closest('.glass-card')

        expect(card).toBeInTheDocument()
        expect(card).toHaveClass('glass-card')
        expect(card).toHaveClass('hover-lift')
    })

    it('should cleanup timer on unmount', () => {
        const { unmount } = render(<BacktestStats />)

        // Spy on clearTimeout
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

        unmount()

        expect(clearTimeoutSpy).toHaveBeenCalled()
        clearTimeoutSpy.mockRestore()
    })
})
