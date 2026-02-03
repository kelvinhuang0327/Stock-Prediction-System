export async function fetchStockData(symbol: string) {
    // Placeholder: replace with actual TWSE API call
    const response = await fetch(`https://api.example.com/stocks/${encodeURIComponent(symbol)}`);
    if (!response.ok) {
        throw new Error('Failed to fetch stock data');
    }
    const data = await response.json();
    return data;
}
