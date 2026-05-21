import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WishScore - Steam Wishlist Cost-Performance Ranker",
  description: "Find your best deal from your Steam wishlist. Rank games by price, discount, and review scores.",
  keywords: ["Steam", "wishlist", "game deals", "cost performance", "ranking"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gradient-to-b from-[#0f1923] via-[#1b2838] to-[#171a21]">
        {children}
      </body>
    </html>
  );
}
