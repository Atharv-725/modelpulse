import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ModelPulse — ML Drift Monitoring",
  description: "Detect data and concept drift in production ML models",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}