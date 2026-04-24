import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { StockInfo } from '../StockInfo'

// Mock fetch
global.fetch = jest.fn()

// Mock child components
jest.mock('@/components/watchlist/PriceAlertDialog', () => ({
    PriceAlertDialog: ({ isOpen, stock }: any) =>
        isOpen ? <div data-testid="price-alert-dialog">Alert Dialog for {stock.name}</div> : null
}))

jest.mock('@/components/watchlist/AddStockDialog', () => ({
    AddStockDialog: ({ isOpen }: any) =>
        isOpen ? <div data-testid="add-stock-dialog">Add Stock Dialog</div> : null
}))

describe('StockInfo Component', () => {
    const mockStockData = {
        name: '台積電',
        price: 580.00,
        change: 5.00,
        changePercent: 0.87,
        volume: 25000,
        amount: 145.0,
        open: 575.00,
        high: 582.00,
        low: 574.00,
        prevClose: 575.00,
        pe: 20.5,
        pb: 5.2,
        dividendYield: 2.5,
        eps: 28.3,
        institutional: {
            foreign: 1200,
            trust: -300,
            dealer: 50,
        },
    }

    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })

    it('should render stock name and symbol', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText('台積電')).toBeInTheDocument()
        expect(screen.getByText('2330')).toBeInTheDocument()
    })

    it('should display current price', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText('580.0')).toBeInTheDocument()
    })

    it('should show positive change with correct styling', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText('5.00')).toBeInTheDocument()
        expect(screen.getByText(/0.87%/)).toBeInTheDocument()
    })

    it('should show negative change correctly', () => {
        const negativeData = { ...mockStockData, change: -5.00, changePercent: -0.87 }
        render(<StockInfo symbol="2330" data={negativeData} />)

        expect(screen.getByText('5.00')).toBeInTheDocument() // Absolute value
        expect(screen.getByText(/0.87%/)).toBeInTheDocument()
    })

    it('should display all key stats', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText(/成交量/)).toBeInTheDocument()
        expect(screen.getByText(/成交值/)).toBeInTheDocument()
        expect(screen.getByText(/開盤/)).toBeInTheDocument()
        expect(screen.getByText(/最高/)).toBeInTheDocument()
        expect(screen.getByText(/最低/)).toBeInTheDocument()
        expect(screen.getByText(/昨收/)).toBeInTheDocument()
    })

    it('should display fundamental data', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText(/本益比/)).toBeInTheDocument()
        expect(screen.getByText(/股價淨值比/)).toBeInTheDocument()
        expect(screen.getByText(/殖利率/)).toBeInTheDocument()
        expect(screen.getByText(/EPS/)).toBeInTheDocument()
    })

    it('should display institutional data', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        expect(screen.getByText('外資')).toBeInTheDocument()
        expect(screen.getByText('投信')).toBeInTheDocument()
        expect(screen.getByText('自營商')).toBeInTheDocument()
        expect(screen.getByText('+1200')).toBeInTheDocument()
        expect(screen.getByText('-300')).toBeInTheDocument()
    })

    it('should show loading state when no data provided', () => {
        render(<StockInfo symbol="2330" data={null} />)

        expect(screen.getByText('Loading...')).toBeInTheDocument()
        expect(document.querySelector('.text-5xl')).toHaveTextContent('0.00')
    })

    it('should open price alert dialog when button clicked', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        const alertButton = screen.getByText('設定警示')
        fireEvent.click(alertButton)

        expect(screen.getByTestId('price-alert-dialog')).toBeInTheDocument()
    })

    it('should handle add to watchlist', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        const addButton = screen.getByText('加入自選')
        fireEvent.click(addButton)

        expect(screen.getByText('已追蹤')).toBeInTheDocument()
    })

    it('should disable watchlist button after adding', () => {
        render(<StockInfo symbol="2330" data={mockStockData} />)

        const addButton = screen.getByText('加入自選')
        fireEvent.click(addButton)

        const button = screen.getByText('已追蹤').closest('button')
        expect(button).toBeDisabled()
    })

    it('should fetch realtime data periodically', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    close: 585.00,
                    open: 580.00,
                    high: 586.00,
                    low: 579.00,
                    volume: 26000000,
                    tradeTime: '13:30:00',
                },
            }),
        })

        render(<StockInfo symbol="2330" data={mockStockData} />)

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith('/api/stocks/2330/realtime')
        }, { timeout: 3000 })
    })

    it('should show LIVE badge when realtime data is active', async () => {
        ; (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    close: 585.00,
                    volume: 26000000,
                    tradeTime: '13:30:00',
                },
            }),
        })

        render(<StockInfo symbol="2330" data={mockStockData} />)

        await waitFor(() => {
            expect(screen.getByText('LIVE')).toBeInTheDocument()
        }, { timeout: 3000 })
    })

    it('should cleanup interval on unmount', () => {
        const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

        const { unmount } = render(<StockInfo symbol="2330" data={mockStockData} />)
        unmount()

        expect(clearIntervalSpy).toHaveBeenCalled()
        clearIntervalSpy.mockRestore()
    })
})
