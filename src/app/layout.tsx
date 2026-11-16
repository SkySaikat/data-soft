import type { Metadata } from "next";
import "./globals.css";
import "./expansion.css";
export const metadata: Metadata = {
  title: "DataSoft · Lead workspace",
  description: "Discover, organize and research local business opportunities.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
