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