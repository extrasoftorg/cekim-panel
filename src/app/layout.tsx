'use client'

import { Navbar } from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import "./globals.css";
import { usePathname } from 'next/navigation';
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const isLoginPage = pathname === '/login' || pathname === '/login/verification';

  return (
    <html lang="tr">
      <body>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="class" defaultTheme="light">
            <div className="min-h-screen flex flex-col">
              {!isLoginPage && <Navbar />}
              <main className="flex-1 py-6 px-4">{children}</main>
            </div>
            <Toaster />
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}