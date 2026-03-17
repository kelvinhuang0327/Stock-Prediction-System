import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: symbol } = await params;

    try {
        // Get recent trading days (try last 5 days to find latest data)
        const dates = [];
        const today = new Date();
        for (let i = 0; i < 10; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0].replace(/-/g, ''));
        }

        // Try each date until we find data
        for (const dateStr of dates) {
            try {
                const url = `https://www.twse.com.tw/rwd/zh/fund/T86?date=${dateStr}&selectType=ALL&response=json`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                });

                const json = await response.json();

                if (json.stat === 'OK' && json.data && json.data.length > 0) {
                    // Find the stock in the data
                    const stockData = json.data.find((row: any[]) => row[0] === symbol);

                    if (stockData) {
                        // Parse institutional data
                        // Fields based on API response:
                        // [0] 證券代號
                        // [1] 證券名稱
                        // [4] 外陸資買賣超股數(不含外資自營商)
                        // [10] 投信買賣超股數
                        // [11] 自營商買賣超股數
                        // [18] 三大法人買賣超股數

                        const parseNumber = (val: string) => {
                            if (!val || val === '-') return 0;
                            return parseInt(val.replace(/,/g, ''));
                        };

                        const institutionalData = {
                            code: stockData[0],
                            name: stockData[1],
                            date: dateStr,
                            foreignInvestors: parseNumber(stockData[4]), // 外資買賣超 (股)
                            investmentTrusts: parseNumber(stockData[10]), // 投信買賣超 (股)
                            dealers: parseNumber(stockData[11]), // 自營商買賣超 (股)
                            total: parseNumber(stockData[18]), // 三大法人合計 (股)
                        };

                        return NextResponse.json({
                            success: true,
                            data: institutionalData
                        });
                    }
                }
            } catch (err) {
                // Try next date
                continue;
            }
        }

        // No data found
        return NextResponse.json({
            success: false,
            error: 'No institutional data found for this stock'
        }, { status: 404 });

    } catch (error) {
        console.error('Error fetching institutional data:', error);
        return NextResponse.json({
            success: false,
            error: 'Failed to fetch institutional data'
        }, { status: 500 });
    }
}
