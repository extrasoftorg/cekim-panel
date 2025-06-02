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
            <Toaster
              icons={{
                success: (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-white mr-2"
                      fill="none"
                      stroke="none"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="12" fill="#1eba4d" />
                      <path stroke="white" strokeWidth="3" d="M7 12.5l3 3 6-6" />
                    </svg>
                  </div>
                ),
                error: (
                  <div className="flex items-center">
                    <svg
                      className="w-5 h-5 text-white mr-2"
                      fill="none"
                      stroke="none"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="12" cy="12" r="12" fill="red" />
                      <path stroke="white" strokeWidth="3" d="M7 7l10 10M7 17L17 7" />
                    </svg>
                  </div>
                ),
              }}
            />
          </ThemeProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}