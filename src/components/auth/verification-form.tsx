'use client';

import type React from "react"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Inter } from "next/font/google"
import { verifyOtp } from "../../app/login/verification/actions"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
})


export default function VerificationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      router.push('/login');
    }
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const response = await verifyOtp(id, otp);
    if (response.success) {
      router.push('/');
    } else {
      setMessage(response.message);
    }
  };

  if (!id) {
    return null;
  }

  const isSuccess = message?.includes("başarılı") || message?.includes("doğrulandı")


  return (
    <div className={`flex min-h-screen items-center justify-center bg-background p-4 ${inter.className}`}>
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="text-center py-3 px-4 border-b border-border">
          <CardTitle className="text-xl font-bold">E-mail Doğrulama</CardTitle>
          <CardDescription className="max-w-[90%] mx-auto">Lütfen 6 haneli doğrulama kodunu girin</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 pb-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                type="text"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "")
                  if (value.length <= 6) {
                    setOtp(value)
                  }
                }}
                placeholder="6 haneli kodu girin"
                maxLength={6}
                className="h-12 text-center text-base font-mono tracking-widest"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={otp.length !== 6}>
              Doğrula
            </Button>
          </form>
        </CardContent>
        {message && (
          <CardFooter>
            <div
              className={`w-full rounded-md p-3 text-center text-sm ${isSuccess
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-l-4 border-green-500"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-l-4 border-red-500"
                }`}
            >
              {message}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
