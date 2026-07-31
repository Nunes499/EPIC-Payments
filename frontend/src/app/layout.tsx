import type { Metadata } from "next";

import "../components/calendar/calendar.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPIC Payments",
  description: "Gestão de ficheiros bancários e cobranças do EPIC Fitness",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}