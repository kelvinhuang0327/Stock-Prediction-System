export interface NewsItem {
    id: number;
    title: string;
    summary: string;
    publishedAt: Date;
    source: string;
    url: string;
}

export class NewsService {
    private baseUrl = 'https://api.cnyes.com/media/api/v1/newslist/category/tw_stock';

    /**
     * Fetch latest real-time news for a specific stock or general market
     */
    async fetchLatestNews(stockId?: string, limit: number = 10): Promise<NewsItem[]> {
        try {
            // If stockId is provided, try to filter by it. 
            // Cnyes API often uses stockId parameter for filtering.
            const url = stockId
                ? `${this.baseUrl}?stockId=${stockId}&limit=${limit}`
                : `${this.baseUrl}?limit=${limit}`;

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`News API failed: ${response.status}`);
                return [];
            }

            const json = await response.json();
            if (json.statusCode !== 200 || !json.items || !json.items.data) {
                return [];
            }

            return json.items.data.map((item: any) => ({
                id: item.newsId,
                title: item.title,
                summary: item.summary || item.content?.substring(0, 200) || '',
                publishedAt: new Date(item.publishAt * 1000),
                source: 'Anue 鉅亨網',
                url: `https://news.cnyes.com/news/id/${item.newsId}`
            }));
        } catch (error) {
            console.error('Failed to fetch real-time news:', error);
            return [];
        }
    }
}

export const newsService = new NewsService();
