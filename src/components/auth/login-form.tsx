'use client'

import type React from "react"
import { useState } from "react"
import { useRouter } from 'next/navigation';
import { Inter } from "next/font/google"
import { login } from "../../app/login/actions"
import { EyeIcon, EyeOffIcon, LockIcon, UserIcon } from "lucide-react"
import styles from "../../app/login/styles.module.css"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
})

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await login(username, password)
      setMessage(response.message)

      if (response.success && response.user) {
        console.log("Doğrulanan kullanıcı:", response.user)
        router.push(`/login/verification?id=${response.user.id}`)

      }
    } catch (error) {
      setMessage("Giriş yapılırken bir hata oluştu.")
    } finally {
      setIsLoading(false)
    }
  }

  const isSuccess = message.includes("başarılı") || message.includes("doğrulandı")
  const messageClass = isSuccess ? styles.successMessage : styles.errorMessage

  return (
    <div className={`${styles.container} ${inter.className}`}>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Giriş Yap</h2>
          <p className={styles.cardDescription}>Hesabınıza erişmek için giriş yapın</p>
        </div>
        <div className={styles.cardContent}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="username" className={styles.label}>
                Kullanıcı Adı
              </label>
              <div className={styles.inputWrapper}>
                <div className={styles.inputIcon}>
                  <UserIcon size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Kullanıcı adınızı girin"
                  className={styles.input}
                  required
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password" className={styles.label}>
                Şifre
              </label>
              <div className={styles.inputWrapper}>
                <div className={styles.inputIcon}>
                  <LockIcon size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Şifrenizi girin"
                  className={styles.input}
                  required
                />
                <div className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </div>
              </div>
            </div>
            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
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
  )
}

