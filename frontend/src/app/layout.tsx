import type { Metadata } from "next";

import { AuthProvider } from "@/components/auth/AuthProvider";
import ProtectedLayout from "@/components/auth/ProtectedLayout";

import "../components/calendar/calendar.css";
import "./globals.css";
import "./epic-windows11.css";

export const metadata: Metadata = {
  title: "EPIC Payments",
  description:
    "Gestão de ficheiros bancários e cobranças do EPIC Fitness",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "EPIC Payments",
    statusBarStyle: "default",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body>
        <AuthProvider>
          <ProtectedLayout>
            {children}
          </ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
