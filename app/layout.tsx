import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "yourHR — Less paperwork. More possibility.",
  description:
    "A job board where your agent handles the repetitive questions, and you handle what matters.",
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
