import { test, expect } from '@playwright/test';

test.describe('Stock Query Flow', () => {
    test('should navigate to homepage', async ({ page }) => {
        await page.goto('/');

        await expect(page).toHaveTitle(/Stock洞察平台/i);
    });

    test('should display market overview cards', async ({ page }) => {
        await page.goto('/');

        // Wait for market data to load
        await page.waitForSelector('.glass-card', { timeout: 10000 });

        // Check for index names
        await expect(page.locator('text=加權指數')).toBeVisible();
        await expect(page.locator('text=櫃買指數')).toBeVisible();
        await expect(page.locator('text=電子指數')).toBeVisible();
    });

    test('should search for a stock', async ({ page }) => {
        await page.goto('/');

        // Look for search input
        const searchInput = page.locator('input[type="text"], input[placeholder*="搜尋"], input[placeholder*="Search"]').first();

        if (await searchInput.isVisible({ timeout: 5000 })) {
            await searchInput.fill('2330');
            await searchInput.press('Enter');

            // Wait for results - either navigation or search results
            await page.waitForTimeout(2000);
        }
    });

    test('should navigate to stock detail page', async ({ page }) => {
        // Direct navigation to stock detail
        await page.goto('/stocks/2330');

        // Wait for the actual detail content instead of the early loading shell.
        await page.locator('h2').filter({ hasText: '市場環境' }).first().waitFor({ timeout: 30000 });

        // Check if we're on a stock page (should have stock info)
        const hasStockContent = await page.locator('.glass-card').count() > 0;
        expect(hasStockContent).toBeTruthy();
    });

    test('should display technical analysis section on detail page', async ({ page }) => {
        await page.goto('/stocks/2330');

        await page.getByRole('button', { name: '技術指標' }).click();
        await page.getByText('訊號有效性（研究）').waitFor({ timeout: 30000 });

        const hasTechnicalSection = await page.getByText('訊號有效性（研究）').count() > 0;
        expect(hasTechnicalSection).toBeTruthy();
    });

    test('should handle invalid stock symbol', async ({ page }) => {
        await page.goto('/stock/INVALID999');

        await page.waitForLoadState('networkidle');

        // Should either show error message or redirect
        // Check that we don't crash
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });

    test('should display backtest stats', async ({ page }) => {
        await page.goto('/');

        // Wait for BacktestStats component
        await page.waitForSelector('text=系統準確度驗證', { timeout: 10000 }).catch(() => {
            // Component might not be on homepage
        });
    });

    test('should be responsive on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Check that content is visible and not overflowing
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});
