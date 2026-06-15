import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Complaint AI Dashboard",
  description: "AI-powered telecom complaint analysis dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
