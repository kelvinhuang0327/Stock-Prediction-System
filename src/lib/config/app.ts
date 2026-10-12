/**
 * app.ts — Global application name constants
 *
 * All pages, notifications, and reports should import from here.
 * Do NOT hardcode the product name in individual files.
 */

/** Primary brand name displayed in UI, metadata, and notifications */
export const APP_NAME = 'Stock洞察平台';

/** Short name (same as APP_NAME for this product) */
export const APP_SHORT_NAME = 'Stock洞察平台';

/**
 * App description — research-oriented, conservative positioning.
 * Not a guarantee of returns.
 */
export const APP_DESCRIPTION =
  '台股研究、候選股篩選、回測驗證與每日洞察平台。本平台所有分析僅供研究參考，不構成投資建議。';

/** Disclaimer appended to all notification payloads */
export const APP_DISCLAIMER =
  `本提醒為 ${APP_NAME} 自動產生之研究摘要，僅供參考，不構成投資建議。`;

/** Title separator used in page titles: "Page | APP_NAME" */
export const APP_TITLE_SEPARATOR = ' ｜ ';

/** Helper to generate page-level titles */
export function pageTitle(section: string): string {
  return `${section}${APP_TITLE_SEPARATOR}${APP_NAME}`;
}
