import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能报销助手 V1",
  description: "轻量级采购报销记录与导出工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
