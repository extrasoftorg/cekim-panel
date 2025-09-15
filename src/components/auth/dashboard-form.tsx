"use client"

import type React from "react"

import { useState, useMemo, type JSX, useEffect, useLayoutEffect, useId } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/loading-spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Users, CheckCircle, XCircle, Bot, Percent, Wallet, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { FiCalendar, FiFilter } from "react-icons/fi"

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DateTimeRange {
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
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const url = `/api/dashboard${params.toString() ? `?${params.toString()}` : ''}`
  
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!response.ok) {
    throw new Error(`İstatistikler alınamadı: ${response.status} - ${response.statusText}`)
  }

  return response.json()
}

const formatDate = (date: Date | undefined, isClient: boolean): string => {
  if (!date || !isClient) return "Seçin"
  
  try {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2)
    const formatted = `${day}.${month}.${year}`
    console.log('🔧 formatDate (native):', { date, formatted, isClient })
    return formatted
  } catch (error) {
    console.error('🔧 formatDate error:', error)
    return "Seçin"
  }
}

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
    case "uye_iptali":
      return "Üye Talep İptali";
    case "diger":
      return "Diğer Sebepler";
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
    case "tc_hata":
      return "TC Bilgileri Hatalı";
    case "sekiz_saatte_cekim":
      return "Çekim Saat Sınırı";
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

interface DateTimeRangePickerProps {
  value: { from: Date | undefined; to: Date | undefined }
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void
  isClient: boolean
}

const DateTimeRangePicker: React.FC<DateTimeRangePickerProps> = ({ value, onChange, isClient }) => {
  const formatDateTimeRange = (from: Date | undefined, to: Date | undefined, isClient: boolean): string => {
    if (!from || !to || !isClient) return "Tarih aralığı seçiniz"
    
    try {
      const formatDate = (date: Date) => {
        const day = date.getDate().toString().padStart(2, '0')
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const year = date.getFullYear().toString().slice(-2)
        return `${day}.${month}.${year}`
      }
      
      const formatTime = (date: Date) => {
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        return `${hours}:${minutes}`
      }
      
      const fromStr = `${formatDate(from)} ${formatTime(from)}`
      const toStr = `${formatDate(to)} ${formatTime(to)}`
      
      return `${fromStr} - ${toStr}`
    } catch (error) {
      return "Tarih aralığı seçiniz"
    }
  }

  const presetRanges = [
    {
      label: "Bugün",
      getValue: () => {
        const today = new Date()
        const startOfDay = new Date(today)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999)
        return { from: startOfDay, to: endOfDay }
      }
    },
    {
      label: "Son 7 gün",
      getValue: () => {
        const today = new Date()
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999)
        const startOfDay = new Date(today)
        startOfDay.setDate(today.getDate() - 6)
        startOfDay.setHours(0, 0, 0, 0)
        return { from: startOfDay, to: endOfDay }
      }
    },
    {
      label: "Son 30 gün",
      getValue: () => {
        const today = new Date()
        const endOfDay = new Date(today)
        endOfDay.setHours(23, 59, 59, 999)
        const startOfDay = new Date(today)
        startOfDay.setDate(today.getDate() - 29)
        startOfDay.setHours(0, 0, 0, 0)
        return { from: startOfDay, to: endOfDay }
      }
    }
  ]

  return (
    <div className="text-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full h-9 justify-start text-left font-normal",
              (!value.from || !value.to) && "text-muted-foreground",
            )}
          >
            <FiCalendar className="mr-2 h-4 w-4" />
            <span className="flex-1">
              {formatDateTimeRange(value.from, value.to, isClient)}
            </span>
            {(value.from || value.to) && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onChange({ from: undefined, to: undefined })
                }}
                className="ml-2 cursor-pointer text-muted-foreground hover:text-destructive text-xl leading-none flex items-center justify-center"
              >
                ×
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="space-y-4">
              {/* Preset Butonları */}
              <div className="space-y-1">
                {presetRanges.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => onChange(preset.getValue())}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              <div className="border-t pt-4">
                {/* Tarih Seçimleri - Yan Yana */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Başlangıç Tarihi</label>
                    <Calendar
                      mode="single"
                      selected={value.from}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date)
                          if (value.from) {
                            newDate.setHours(value.from.getHours(), value.from.getMinutes(), 0, 0)
                          } else {
                            newDate.setHours(0, 0, 0, 0)
                          }
                          onChange({ ...value, from: newDate })
                        } else {
                          onChange({ ...value, from: undefined })
                        }
                      }}
                      initialFocus
                    />
                    <div className="mt-2">
                      <label className="text-sm font-medium mb-1 block">Başlangıç Saati</label>
                      <input
                        type="time"
                        value={value.from ? `${value.from.getHours().toString().padStart(2, '0')}:${value.from.getMinutes().toString().padStart(2, '0')}` : '00:00'}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number)
                          if (!isNaN(hours) && !isNaN(minutes)) {
                            if (value.from) {
                              const newDate = new Date(value.from)
                              newDate.setHours(hours, minutes, 0, 0)
                              onChange({ ...value, from: newDate })
                            } else {
                              const today = new Date()
                              today.setHours(hours, minutes, 0, 0)
                              onChange({ ...value, from: today })
                            }
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-input bg-background rounded"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Bitiş Tarihi</label>
                    <Calendar
                      mode="single"
                      selected={value.to}
                      onSelect={(date) => {
                        if (date) {
                          const newDate = new Date(date)
                          if (value.to) {
                            newDate.setHours(value.to.getHours(), value.to.getMinutes(), 59, 999)
                          } else {
                            newDate.setHours(23, 59, 59, 999)
                          }
                          onChange({ ...value, to: newDate })
                        } else {
                          onChange({ ...value, to: undefined })
                        }
                      }}
                      disabled={(date) => value.from ? date < value.from : false}
                    />
                    <div className="mt-2">
                      <label className="text-sm font-medium mb-1 block">Bitiş Saati</label>
                      <input
                        type="time"
                        value={value.to ? `${value.to.getHours().toString().padStart(2, '0')}:${value.to.getMinutes().toString().padStart(2, '0')}` : '23:59'}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number)
                          if (!isNaN(hours) && !isNaN(minutes)) {
                            if (value.to) {
                              const newDate = new Date(value.to)
                              newDate.setHours(hours, minutes, 59, 999)
                              onChange({ ...value, to: newDate })
                            } else {
                              const today = new Date()
                              today.setHours(hours, minutes, 59, 999)
                              onChange({ ...value, to: today })
                            }
                          }
                        }}
                        className="w-full px-2 py-1 text-sm border border-input bg-background rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function DashboardForm() {
  const id = useId()
  const [isClient, setIsClient] = useState(false)
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
    if (queryParams.startDate && queryParams.endDate) {
      setDateRange({
        from: new Date(queryParams.startDate),
        to: new Date(queryParams.endDate),
      })
    }
  }, [queryParams.startDate, queryParams.endDate])

  useEffect(() => {
    if (isClient && !queryParams.startDate && !queryParams.endDate) {
      const today = new Date()
      const startOfDay = new Date(today)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)
      
      setQueryParams({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString(),
      })
      setIsFiltered(true)
    }
  }, [isClient, queryParams.startDate, queryParams.endDate])

  useLayoutEffect(() => {
    setIsClient(true)
  }, [])


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


  const botTotalOperations = Number(botApproved) + Number(botRejected)
  const botApprovalRate = botTotalOperations > 0 ? (Number(botApproved) / botTotalOperations) * 100 : 0

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
        (v) => `${(v || 0).toFixed(1)}%`,
      ),
      createStatistic(
        <Percent className="w-4 h-4 text-blue-500" />,
        "Genel Onay Yüzdesi",
        approvalRate,
        (v) => `${(v || 0).toFixed(1)}%`,
      ),
      createStatistic(
        <Wallet className="w-4 h-4 text-yellow-500" />,
        "Ödenmiş Çekim Miktarı",
        totalPaidAmount,
        (v) => {
          if (!isClient) return `₺${v.toLocaleString()}`
          try {
              const formatted = v.toLocaleString('tr-TR')
            return `₺${formatted}`
          } catch (error) {
            console.error('NumberFormat error:', error)
            return `₺${v.toString()}`
          }
        },
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
      isClient,
    ],
  )

  const applyFilters = () => {
    if (dateRange.from && dateRange.to) {
      const startDate = dateRange.from.toISOString()
      const endDate = dateRange.to.toISOString()

      setQueryParams({
        startDate,
        endDate,
      })
      setIsFiltered(true)
    }
  }

  if (!isClient) {
    return <LoadingSpinner message="Dashboard yükleniyor..." />
  }

  return (
    <div className="mx-auto max-w-6xl" suppressHydrationWarning={true}>
      <div className="glass-effect p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-[color:var(--primary)]">İstatistikler</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-75">
            <DateTimeRangePicker
              value={dateRange}
              onChange={setDateRange}
              isClient={isClient}
            />
          </div>
          <div className="flex-shrink-0">
            <Button 
              onClick={applyFilters} 
              variant="outline" 
              className="h-9 px-4 flex items-center justify-center"
              disabled={!dateRange.from || !dateRange.to}
            >
              <FiFilter className="h-4 w-4 mr-1" />
              Filtrele
            </Button>
          </div>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {isLoading ? (
            // Skeleton loading - 5 kart için
            Array.from({ length: 10 }).map((_, index) => (
              <Card
                key={index}
                className="personel-card p-2 border border-[color:var(--border)] rounded-md bg-[color:var(--card)] shadow-sm"
              >
                <CardContent className="flex items-center gap-2 p-2">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-16 mb-1" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <div className="col-span-full text-center py-8">
              <div className="text-destructive">Hata: {(error as Error).message}</div>
            </div>
          ) : (
            statistics.map((stat, index) => (
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
            ))
          )}
        </div>

        <div className="mt-6">
          <div className="processing-time-table">
            <div className="processing-time-header">
              <Clock className="processing-time-icon" />
              <h2 className="processing-time-title">Ortalama İşlem Sonuçlama Süresi</h2>
            </div>

            <div className="processing-time-content">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="processing-time-row">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <div className="processing-time-stats">
                      <div className="processing-time-stat">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                      <div className="processing-time-stat">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-4 w-12" />
                      </div>
                    </div>
                  </div>
                ))
              ) : fastestApprovers.length === 0 ? (
                <div className="processing-time-empty">Personel verisi mevcut değil.</div>
              ) : (
                fastestApprovers
                  .filter(approver => approver && approver.handlerUsername && typeof approver.avgApprovalDuration === 'number')
                  .map((approver, index) => {
                    const rejecter = fastestRejecters.find((r) => r && r.handlerUsername === approver.handlerUsername) || {
                      avgRejectionDuration: 0,
                    }
                    return (
                      <div key={index} className="processing-time-row">
                        <div className="processing-time-index">{index + 1}</div>
                        <div className="processing-time-name">{approver.handlerUsername}</div>
                        <div className="processing-time-stats">
                          <div className="processing-time-stat">
                            <div className="processing-time-label">Ort. Onay Süresi</div>
                            <div className="processing-time-value">{(approver.avgApprovalDuration || 0).toFixed(2)} dk</div>
                          </div>
                          <div className="processing-time-stat">
                            <div className="processing-time-label">Ort. Ret Süresi</div>
                            <div className="processing-time-value">{(rejecter.avgRejectionDuration || 0).toFixed(2)} dk</div>
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
              {isLoading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="processing-time-row">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <div className="processing-time-stats">
                      <div className="processing-time-stat">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                      <div className="processing-time-stat">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  </div>
                ))
              ) : Object.keys(rejectReasonsStats).length === 0 ? (
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
                            ₺{isClient ? stats.totalAmount.toLocaleString('tr-TR') : stats.totalAmount.toString()}
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