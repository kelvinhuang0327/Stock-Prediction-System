import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Header } from "@/components/layout/Header";
import { MainLayout } from "@/components/layout/MainLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Stock洞察平台",
    template: "%s ｜ Stock洞察平台",
  },
  description: "台股研究、候選股篩選、回測驗證與每日洞察平台。本平台所有分析僅供研究參考，不構成投資建議。",
  openGraph: {
    title: "Stock洞察平台",
    description: "台股研究、候選股篩選、回測驗證與每日洞察平台",
    type: "website",
    locale: "zh_TW",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative flex min-h-screen flex-col">
            <MainLayout>{children}</MainLayout>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
