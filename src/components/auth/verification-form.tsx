'use client';

import type React from "react"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Inter } from "next/font/google"
import { verifyOtp } from "../../app/login/verification/actions"
import styles from "../../app/login/verification/styles.module.css"

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
  const messageClass = isSuccess ? styles.successMessage : styles.errorMessage


  return (
    <div className={`${styles.container} ${inter.className}`}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>E-mail Doğrulama</h2>
          <p className={styles.cardDescription}>Lütfen 6 haneli doğrulama kodunu girin</p>
        </div>

        <div className={styles.cardContent}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputWrapper}>
              <input
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
                className={styles.otpInputSingle}
                required
              />
            </div>

            <button type="submit" className={styles.verifyButton} disabled={otp.length !== 6}>
              Doğrula
            </button>
          </form>
        </div>

        {message && (
          <div className={styles.cardFooter}>
            <div className={`${styles.message} ${messageClass}`}>{message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
