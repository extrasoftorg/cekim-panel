"use client"

import type React from "react"

import { useState, useMemo, type JSX, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/loading-spinner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Users, CheckCircle, XCircle, Bot, Percent, Wallet, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { FiCalendar, FiRefreshCw } from "react-icons/fi"

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface Stats {
  totalWithdrawals: number
  totalApproved: number
  totalRejected: number
  totalManuelApproved: number
  totalManuelRejected: number
  totalPaidAmount: number
  approvalRate: number
  fastestApprovers: { handlerUsername: string; avgApprovalDuration: number }[]
  fastestRejecters: { handlerUsername: string; avgRejectionDuration: number }[]
  rejectReasonsStats: { [key: string]: { count: number; totalAmount: number } }
  botApproved: number
  botRejected: number
}

interface Statistic {
  icon: JSX.Element
  title: string
  value: number
  format?: (value: number) => string
}

const fetchDashboardStats = async (startDate?: string, endDate?: string): Promise<{ data: Stats }> => {
  const requestBody: Record<string, string> = {}

  if (startDate) requestBody.startDate = startDate
  if (endDate) requestBody.endDate = endDate

  const response = await fetch("/api/dashboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    throw new Error(`İstatistikler alınamadı: ${response.status} - ${response.statusText}`)
  }

  return response.json()
}

const formatDate = (date: Date | undefined): string => (date ? format(date, "dd.MM.yy") : "Seçin")

const createStatistic = (
  icon: JSX.Element,
  title: string,
  value: number,
  format?: (value: number) => string,
): Statistic => ({
  icon,
  title,
  value,
  format,
})

const translateRejectReason = (reason: string): string => {
  switch (reason) {
    case "anapara_cevrim":
      return "Anapara Eksik Çevrim";
    case "acik_bonus_cevrim":
      return "Bonus Açık Bahis Mevcut";
    case "acik_bahis_cevrim":
      return "Açık Bahis Mevcut";
    case "coklu_hesap":
      return "Çoklu Hesap";
    case "ip_coklu":
      return "Aynı IP Çoklu Hesap";
    case "ayni_aile_coklu":
      return "Aynı Aile Çoklu Hesap";
    case "deneme_sinir":
      return "Deneme Bonusu Çekim Sınırı";
    case "call_siniri":
      return "Dış Data Hediyesi Çekim Sınırı";
    case "promosyon_sinir":
      return "Promosyon Kodu Çekim Sınırı";
    case "yatirim_sinir":
      return "Yatırıma Bağlı Çekim Sınırı";
    case "hediye_sinir":
      return "Hediye Bonusu Çekim Sınırı";
    case "bonus_sinir":
      return "Bonus Çekim Sınırı";
    case "safe_bahis":
      return "Safe Bahis";
    case "kurma_bahis":
      return "Kurma/Riskli Bahis";
    case "bire1_bahis":
      return "1e1 Bahis";
    case "casino_kurma_bahis":
      return "Casino Kurma Bahis";
    case "ozel_oyun_kontrol":
      return "Özel Oyun Kontrol";
    case "yatirim_bonus_suistimal":
      return "Yatırım Bonusu Suistimali";
    case "cashback_suistimal":
      return "Cashback Suistimali";
    case "deneme_suistimal":
      return "Deneme Bonusu Suistimali";
    case "hediye_suistimal":
      return "Hediye Bonus Suistimali";
    case "yontem_sorunu":
      return "Yöntem Sorunu";
    case "sekiz_saatte_cekim":
      return "8 Saatte Bir Çekim";
    case "tc_hata":
      return "TC Hata";
    case "yeni_gun":
      return "Yeni Gün";
    case "ikiyuztl_alt":
      return "200 TL Altı";
    case "on_katlari":
      return "10 Katları";
    default:
      return reason;
  }
};

interface DatePickerProps {
  label: string
  value: Date | undefined
  onChange: (date: Date | undefined) => void
}

const DatePicker: React.FC<DatePickerProps> = ({ label, value, onChange }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className={cn("w-[200px] h-9 justify-start text-left font-normal", !value && "text-muted-foreground")}
      >
        <FiCalendar className="mr-2 h-4 w-4" />
        <span className="flex-1">
          {label}: {formatDate(value)}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation()
              onChange(undefined)
            }}
            className="ml-2 cursor-pointer text-muted-foreground hover:text-destructive"
          >
            ✕
          </span>
        )}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={(date) => onChange(date)} initialFocus />
    </PopoverContent>
  </Popover>
)

export function DashboardForm() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  })

  const [isFiltered, setIsFiltered] = useState<boolean>(false)

  const [queryParams, setQueryParams] = useState<{
    startDate: string | undefined
    endDate: string | undefined
  }>({
    startDate: undefined,
    endDate: undefined,
  })

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      const startOfDay = new Date(dateRange.from)
      startOfDay.setHours(0, 0, 0, 0)

      const endOfDay = new Date(dateRange.to)
      endOfDay.setHours(23, 59, 59, 999)

      setQueryParams({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      })
      setIsFiltered(true)
    } else if (!dateRange.from && !dateRange.to) {
      setQueryParams({
        startDate: undefined,
        endDate: undefined,
      })
      setIsFiltered(false)
    }
  }, [dateRange.from, dateRange.to])

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", queryParams.startDate, queryParams.endDate],
    queryFn: () => fetchDashboardStats(queryParams.startDate, queryParams.endDate),
  })

  const stats: Stats = data?.data ?? {
    totalWithdrawals: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalManuelApproved: 0,
    totalManuelRejected: 0,
    totalPaidAmount: 0,
    approvalRate: 0,
    fastestApprovers: [],
    fastestRejecters: [],
    rejectReasonsStats: {},
    botApproved: 0,
    botRejected: 0,
  }

  const {
    totalWithdrawals,
    totalApproved,
    totalRejected,
    totalManuelApproved,
    totalManuelRejected,
    totalPaidAmount,
    approvalRate,
    fastestApprovers,
    fastestRejecters,
    rejectReasonsStats,
    botApproved,
    botRejected,
  } = stats

  const botTotalOperations = botApproved + botRejected
  const botApprovalRate = botTotalOperations > 0 ? (botApproved / botTotalOperations) * 100 : 0

  const statistics: Statistic[] = useMemo(
    () => [
      createStatistic(<Users className="w-4 h-4 text-emerald-500" />, "Gelen Çekim Sayısı", totalWithdrawals),
      createStatistic(<CheckCircle className="w-4 h-4 text-blue-500" />, "Onaylanan Çekim Sayısı", totalApproved),
      createStatistic(<XCircle className="w-4 h-4 text-red-500" />, "Reddedilen Çekim Sayısı", totalRejected),
      createStatistic(<CheckCircle className="w-4 h-4 text-teal-500" />, "Manuel Onay Sayısı", totalManuelApproved),
      createStatistic(<XCircle className="w-4 h-4 text-red-500" />, "Manuel Ret Sayısı", totalManuelRejected),
      createStatistic(<Bot className="w-4 h-4 text-purple-500" />, "Bot Onay Sayısı", botApproved),
      createStatistic(<Bot className="w-4 h-4 text-orange-500" />, "Bot Ret Sayısı", botRejected),
      createStatistic(
        <Percent className="w-4 h-4 text-green-500" />,
        "Bot Onay Yüzdesi",
        botApprovalRate,
        (v) => `${v.toFixed(1)}%`,
      ),
      createStatistic(
        <Percent className="w-4 h-4 text-blue-500" />,
        "Genel Onay Yüzdesi",
        approvalRate,
        (v) => `${v.toFixed(1)}%`,
      ),
      createStatistic(
        <Wallet className="w-4 h-4 text-yellow-500" />,
        "Ödenmiş Çekim Miktarı",
        totalPaidAmount,
        (v) => `₺${new Intl.NumberFormat("tr-TR").format(v)}`,
      ),
    ],
    [
      totalWithdrawals,
      totalApproved,
      totalRejected,
      totalManuelApproved,
      totalManuelRejected,
      totalPaidAmount,
      approvalRate,
      botApproved,
      botRejected,
      botApprovalRate,
    ],
  )

  const clearFilters = () => {
    setDateRange({ from: undefined, to: undefined })
  }

      if (isLoading) return <LoadingSpinner message="Dashboard verileri yükleniyor..." />
  if (error) return <div>Hata: {(error as Error).message}</div>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[color:var(--primary)]">İstatistikler</h1>
        <div className="flex items-center gap-4 mr-40">
          <DatePicker
            label="Başlangıç"
            value={dateRange.from}
            onChange={(date) => setDateRange((prev) => ({ ...prev, from: date }))}
          />
          <DatePicker
            label="Bitiş"
            value={dateRange.to}
            onChange={(date) => setDateRange((prev) => ({ ...prev, to: date }))}
          />
          {isFiltered && (
            <Button onClick={clearFilters} variant="outline" className="h-9 flex items-center justify-center">
              <FiRefreshCw className="h-4 w-4 mr-1" />
              Temizle
            </Button>
          )}
        </div>
      </div>
      <div className="px-4 mx-auto max-w-6xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {statistics.map((stat, index) => (
            <Card
              key={index}
              className="personel-card p-2 border border-[color:var(--border)] rounded-md bg-[color:var(--card)] shadow-sm"
            >
              <CardContent className="flex items-center gap-2 p-2">
                <div className="h-9 w-9 rounded-full bg-[color:var(--secondary)] flex items-center justify-center">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">{stat.title}</p>
                  <p className="text-sm font-semibold text-[color:var(--primary)]">
                    {stat.format ? stat.format(stat.value) : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <div className="processing-time-table">
            <div className="processing-time-header">
              <Clock className="processing-time-icon" />
              <h2 className="processing-time-title">Ortalama İşlem Sonuçlama Süresi</h2>
            </div>

            <div className="processing-time-content">
              {fastestApprovers.length === 0 ? (
                <div className="processing-time-empty">Personel verisi mevcut değil.</div>
              ) : (
                fastestApprovers.map((approver, index) => {
                  const rejecter = fastestRejecters.find((r) => r.handlerUsername === approver.handlerUsername) || {
                    avgRejectionDuration: 0,
                  }
                  return (
                    <div key={index} className="processing-time-row">
                      <div className="processing-time-index">{index + 1}</div>
                      <div className="processing-time-name">{approver.handlerUsername}</div>
                      <div className="processing-time-stats">
                        <div className="processing-time-stat">
                          <div className="processing-time-label">Ort. Onay Süresi</div>
                          <div className="processing-time-value">{approver.avgApprovalDuration.toFixed(2)} dk</div>
                        </div>
                        <div className="processing-time-stat">
                          <div className="processing-time-label">Ort. Ret Süresi</div>
                          <div className="processing-time-value">{rejecter.avgRejectionDuration.toFixed(2)} dk</div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="processing-time-table mt-6">
            <div className="processing-time-header">
              <XCircle className="processing-time-icon text-red-500" />
              <h2 className="processing-time-title">RET Sebepleri</h2>
            </div>

            <div className="processing-time-content">
              {Object.keys(rejectReasonsStats).length === 0 ? (
                <div className="processing-time-empty">Veri mevcut değil.</div>
              ) : (
                Object.entries(rejectReasonsStats)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([reason, stats], index) => (
                    <div key={index} className="processing-time-row">
                      <div className="processing-time-index">{index + 1}</div>
                      <div className="processing-time-name">{translateRejectReason(reason)}</div>
                      <div className="processing-time-stats">
                        <div className="processing-time-stat">
                          <div className="processing-time-label">İşlem Sayısı</div>
                          <div className="processing-time-value">{stats.count}</div>
                        </div>
                        <div className="processing-time-stat">
                          <div className="processing-time-label">Toplam Tutar</div>
                          <div className="processing-time-value">
                            ₺{new Intl.NumberFormat("tr-TR").format(stats.totalAmount)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}