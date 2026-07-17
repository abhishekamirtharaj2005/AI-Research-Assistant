import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResearchMind - AI Research Assistant",
  description: "Upload academic papers, generate summaries, and perform advanced RAG semantic queries with multi-agent coordination.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
