import { render, screen } from '@testing-library/react'
import { InteractiveLineChart } from '../InteractiveLineChart'

// Mock Recharts to avoid canvas issues in tests
jest.mock('recharts', () => {
    const OriginalModule = jest.requireActual('recharts')
    return {
        ...OriginalModule,
        ResponsiveContainer: ({ children }: any) => (
            <div className="recharts-responsive-container">{children}</div>
        ),
    }
})

describe('InteractiveLineChart Component', () => {
    const mockData = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 105 },
        { date: '2024-01-03', value: 103 },
        { date: '2024-01-04', value: 110 },
    ]

    it('should render with data', () => {
        render(<InteractiveLineChart data={mockData} dataKey="value" />)

        const container = document.querySelector('.recharts-responsive-container')
        expect(container).toBeInTheDocument()
    })

    it('should render title when provided', () => {
        render(
            <InteractiveLineChart
                data={mockData}
                dataKey="value"
                title="股價走勢圖"
            />
        )

        expect(screen.getByText('股價走勢圖')).toBeInTheDocument()
    })

    it('should not render title when not provided', () => {
        render(<InteractiveLineChart data={mockData} dataKey="value" />)

        const title = screen.queryByText(/股價/)
        expect(title).not.toBeInTheDocument()
    })

    it('should render AreaChart when showGradient is true', () => {
        const { container } = render(
            <InteractiveLineChart
                data={mockData}
                dataKey="value"
                showGradient={true}
            />
        )

        expect(container.querySelector('.glass-card')).toBeInTheDocument()
    })

    it('should render LineChart when showGradient is false', () => {
        const { container } = render(
            <InteractiveLineChart
                data={mockData}
                dataKey="value"
                showGradient={false}
            />
        )

        // Component should still render
        expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('should accept custom color', () => {
        render(
            <InteractiveLineChart
                data={mockData}
                dataKey="value"
                color="#ff0000"
            />
        )

        // Component renders without error
        expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('should accept custom height', () => {
        const { container } = render(
            <InteractiveLineChart
                data={mockData}
                dataKey="value"
                height={500}
            />
        )

        expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('should handle empty data array', () => {
        render(<InteractiveLineChart data={[]} dataKey="value" />)

        // Should render without crashing
        expect(document.querySelector('.recharts-responsive-container')).toBeInTheDocument()
    })

    it('should render in GlassCard', () => {
        const { container } = render(<InteractiveLineChart data={mockData} dataKey="value" />)

        // Check for glass-card wrapper
        const glassCard = container.querySelector('.glass-card')
        expect(glassCard).toBeInTheDocument()
    })
})
