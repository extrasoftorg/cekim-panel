"use client"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import { FiSearch, FiCalendar, FiDownload, FiFilter } from "react-icons/fi"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Withdrawal {
  id: number
  transactionId: string
  playerUsername: string
  playerFullname: string
  method: string
  amount: number
  requestedAt: string
  concludedAt: string
  note: string
  withdrawalStatus: "approved" | "rejected"
  handlerUsername?: string | null
  hasTransfers: boolean
}

interface TransferHistory {
  transferredTo: string | null
  transferredBy: string | null
  transferredAt: string
}

const fetchPastWithdrawals = async () => {
  const response = await fetch("/api/withdrawals?status=approved,rejected", { credentials: "include" })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Veri çekme hatası: ${response.status} ${errorText}`)
  }
  return response.json()
}

const fetchTransferHistory = async (withdrawalId: number): Promise<TransferHistory[]> => {
  console.log(`fetchTransferHistory çağrıldı, withdrawalId: ${withdrawalId}`)
  const response = await fetch(`/api/withdrawals/transfer?withdrawalId=${withdrawalId}`, { credentials: "include" })
  console.log("fetchTransferHistory response:", response)
  if (!response.ok) {
    const errorText = await response.text()
    console.error("fetchTransferHistory hata:", response.status, errorText)
    throw new Error(`Transfer geçmişi çekme hatası: ${response.status} ${errorText}`)
  }
  const data = await response.json()
  console.log("fetchTransferHistory veri:", data)

  const transformedData = data.data.map((item: any) => ({
    transferredTo: item.transferredToUsername,
    transferredBy: item.transferredByUsername,
    transferredAt: item.transferredAt,
  }))

  return transformedData
}

export default function PastWithdrawalsPage() {
  const {
    data: pastWithdrawals = [],
    isLoading,
    error,
  } = useQuery<Withdrawal[]>({
    queryKey: ["pastWithdrawals"],
    queryFn: fetchPastWithdrawals,
  })

  const [playerUsernameFilter, setPlayerUsernameFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("yontem")
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [handlerFilter, setHandlerFilter] = useState("yetkili")
  const [noteFilter, setNoteFilter] = useState("note")
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all")
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([])
  const [mounted, setMounted] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage] = useState(20)
  const [isFiltered, setIsFiltered] = useState(false)

  const [isLoadingTransfers, setIsLoadingTransfers] = useState<{ [key: number]: boolean }>({})
  const [transferErrors, setTransferErrors] = useState<{ [key: number]: string | null }>({})
  const [transfersData, setTransfersData] = useState<{ [key: number]: TransferHistory[] }>({})
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
    if (pastWithdrawals.length > 0) {
      setFilteredWithdrawals(pastWithdrawals)
    }
  }, [pastWithdrawals])

  const calculateDuration = (requestedAt: string, concludedAt: string) => {
    if (!concludedAt) return "Bilinmiyor"
    const start = new Date(requestedAt)
    const end = new Date(concludedAt)
    const diffMs = end.getTime() - start.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    return `${diffSec} Saniye`
  }

  const applyFilters = () => {
    const filtered = pastWithdrawals.filter((w) => {
      if (playerUsernameFilter && !w.playerFullname.toLowerCase().includes(playerUsernameFilter.toLowerCase())) {
        return false
      }

      if (methodFilter !== "yontem" && !w.method.toLowerCase().includes(methodFilter.toLowerCase())) {
        return false
      }

      if (dateRange.from || dateRange.to) {
        if (!w.concludedAt) return false
        const concludedDate = new Date(w.concludedAt)
        const filterStart = dateRange.from ? startOfDay(dateRange.from) : new Date(0)
        const filterEnd = dateRange.to ? endOfDay(dateRange.to) : new Date()
        if (concludedDate < filterStart || concludedDate > filterEnd) {
          return false
        }
      }

      if (
        handlerFilter !== "yetkili" &&
        (!w.handlerUsername || !w.handlerUsername.toLowerCase().includes(handlerFilter.toLowerCase()))
      ) {
        return false
      }

      if (noteFilter !== "note" && !w.note.toLowerCase().includes(noteFilter.toLowerCase())) {
        return false
      }

      if (statusFilter !== "all" && w.withdrawalStatus !== statusFilter) {
        return false
      }

      return true
    })

    setFilteredWithdrawals(filtered)
    setCurrentPage(1)
    setIsFiltered(true)
  }

  const handleExcelDownload = () => {
    const data = isFiltered ? filteredWithdrawals : paginatedWithdrawals
    const formattedData = data.map((withdrawal) => ({
      ID: withdrawal.playerUsername,
      Müşteri: withdrawal.playerFullname,
      Yöntem: withdrawal.method,
      Miktar: `${withdrawal.amount} TL`,
      "Talep Tarihi": format(new Date(withdrawal.requestedAt), "dd.MM.yy HH:mm:ss"),
      "Kapanma Tarihi": withdrawal.concludedAt
        ? format(new Date(withdrawal.concludedAt), "dd-MM-yy HH:mm:ss")
        : "Bilinmiyor",
      "Kapanma Süresi": calculateDuration(withdrawal.requestedAt, withdrawal.concludedAt),
      Yetkili: withdrawal.handlerUsername || "Bilinmiyor",
      Not: withdrawal.note,
      Durum: withdrawal.withdrawalStatus === "approved" ? "Onaylandı" : "Reddedildi",
    }))

    const worksheet = XLSX.utils.json_to_sheet(formattedData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Geçmiş Çekim Talepleri")
    XLSX.writeFile(workbook, "gecmis_cekim_talepleri.xlsx")
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    }
  }

  const totalPages = isFiltered ? 1 : Math.ceil(filteredWithdrawals.length / rowsPerPage)
  const paginatedWithdrawals = isFiltered
    ? filteredWithdrawals
    : filteredWithdrawals.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const getPageNumbers = () => {
    const maxPagesToShow = 20
    const pages = []

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    const startPage = Math.max(2, currentPage - 2)
    const endPage = Math.min(totalPages - 1, currentPage + 2)

    pages.push(1)

    if (startPage > 2) {
      pages.push("...")
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (endPage < totalPages - 1) {
      pages.push("...")
    }

    if (totalPages > 1) {
      pages.push(totalPages)
    }

    return pages
  }

  const handleViewTransfers = async (withdrawalId: number) => {
    console.log(`handleViewTransfers çağrıldı, withdrawalId: ${withdrawalId}`)
    if (transfersData[withdrawalId]) {
      console.log(`Veri zaten var, withdrawalId: ${withdrawalId}, veri:`, transfersData[withdrawalId])
      return
    }

    setIsLoadingTransfers((prev) => ({ ...prev, [withdrawalId]: true }))
    setTransferErrors((prev) => ({ ...prev, [withdrawalId]: null }))
    try {
      const transfers = await fetchTransferHistory(withdrawalId)
      console.log(`fetchTransferHistory başarılı, withdrawalId: ${withdrawalId}, transfers:`, transfers)
      setTransfersData((prev) => ({ ...prev, [withdrawalId]: transfers }))
    } catch (error) {
      const errorMessage = (error as Error).message || "Transfer geçmişi alınamadı"
      console.error(`fetchTransferHistory hata, withdrawalId: ${withdrawalId}, hata:`, errorMessage)
      setTransferErrors((prev) => ({ ...prev, [withdrawalId]: errorMessage }))
    } finally {
      setIsLoadingTransfers((prev) => ({ ...prev, [withdrawalId]: false }))
    }
  }

  if (!mounted) return null

  if (isLoading) {
    return (
      <div>
        Yükleniyor...
        <div className="text-sm text-muted-foreground mt-2 text-center">Geçmiş çekim talepleri yükleniyor...</div>
      </div>
    )
  }

  if (error) {
    console.error("useQuery hata:", error)
    return <div className="text-destructive text-center">Hata: {(error as Error).message}</div>
  }

  console.log("paginatedWithdrawals:", paginatedWithdrawals)

  return (
    <div className="grid grid-cols-auto">
      <div className="glass-effect p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 items-center">
          <div className="text-center">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Üye Adı"
                value={playerUsernameFilter}
                onChange={(e) => setPlayerUsernameFilter(e.target.value)}
                className="w-full h-9 pl-10"
              />
            </div>
          </div>
          <div className="text-center">
            <Select onValueChange={setMethodFilter} defaultValue="yontem">
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Yöntem seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yontem">Yöntem</SelectItem>
                <SelectItem value="TurboHavale">TurboHavale</SelectItem>
                <SelectItem value="KolayPayPapara withdraw">KolayPayPapara withdraw</SelectItem>
                <SelectItem value="HavaleM">HavaleM</SelectItem>
                <SelectItem value="Aninda_Parola">Aninda_Parola</SelectItem>
                <SelectItem value="BigPayPaybol">BigPayPaybol</SelectItem>
                <SelectItem value="CepPay withdraw">CepPay withdraw</SelectItem>
                <SelectItem value="KralPaybanktransferNew">KralPaybanktransferNew</SelectItem>
                <SelectItem value="FlexPapara">FlexPapara</SelectItem>
                <SelectItem value="HizliKripto">HizliKripto</SelectItem>
                <SelectItem value="TrendHavale">TrendHavale</SelectItem>
                <SelectItem value="CPapara">CPapara</SelectItem>
                <SelectItem value="NakitAktarHavale">NakitAktarHavale</SelectItem>
                <SelectItem value="Aninda_Kripto">Aninda_Kripto</SelectItem>
                <SelectItem value="AnindaQR">AnindaQR</SelectItem>
                <SelectItem value="Aninda_Mefete">Aninda_Mefete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-9 justify-start text-left font-normal",
                    !dateRange.from && !dateRange.to && "text-muted-foreground",
                  )}
                >
                  <FiCalendar className="" />
                  <span className="flex-1">
                    {dateRange.from ? (
                      dateRange.to ? (
                        `${format(dateRange.from, "dd.MM.yy")} - ${format(dateRange.to, "dd.MM.yy")}`
                      ) : (
                        `${format(dateRange.from, "dd.MM.yy")} -`
                      )
                    ) : (
                      <span>Tarih Aralığı Seçin</span>
                    )}
                  </span>
                  {(dateRange.from || dateRange.to) && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setDateRange({ from: undefined, to: undefined })
                        setIsFiltered(false)
                      }}
                      className="ml-0 cursor-pointer text-muted-foreground hover:text-destructive"
                    >
                      ✕
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-center">
            <Select onValueChange={setHandlerFilter} defaultValue="yetkili">
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Yetkili" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yetkili">Yetkili</SelectItem>
                <SelectItem value="Çekim Botu">Çekim Botu</SelectItem>
                <SelectItem value="ORHUN">ORHUN</SelectItem>
                <SelectItem value="TALAT">TALAT</SelectItem>
                <SelectItem value="SARP">SARP</SelectItem>
                <SelectItem value="SABRİ">SABRİ</SelectItem>
                <SelectItem value="METİN">METİN</SelectItem>
                <SelectItem value="CÜNEYT">CÜNEYT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center">
            <Select onValueChange={setNoteFilter} defaultValue="note">
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Not seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="note">Not</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center">
            <Select
              onValueChange={(value: "all" | "approved" | "rejected") => setStatusFilter(value)}
              defaultValue="all"
            >
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="approved">Onaylandı</SelectItem>
                <SelectItem value="rejected">Reddedildi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center">
            <div className="flex gap-2">
              <Button
                onClick={handleExcelDownload}
                className="w-1/2 h-9 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center"
              >
                <FiDownload />
                Excel
              </Button>
              <Button
                onClick={applyFilters}
                className="w-1/2 h-9 bg-primary hover:bg-primary/90 flex items-center justify-center"
              >
                <FiFilter />
                Filtrele
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="glass-effect overflow-x-auto">
        <Table className="min-w-full table-auto table-compact">
          <TableHeader className="table-header">
            <TableRow>
              <TableHead className="table-head">ID</TableHead>
              <TableHead className="table-head">Müşteri</TableHead>
              <TableHead className="table-head">Yöntem</TableHead>
              <TableHead className="table-head">Miktar</TableHead>
              <TableHead className="table-head">Talep Tarihi</TableHead>
              <TableHead className="table-head">Kapanma Tarihi</TableHead>
              <TableHead className="table-head">Kapanma Süresi</TableHead>
              <TableHead className="table-head">Yetkili</TableHead>
              <TableHead className="table-head">Not</TableHead>
              <TableHead className="table-head">Durum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedWithdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-3 text-sm text-muted-foreground">
                  Geçmiş çekim talebi mevcut değildir.
                </TableCell>
              </TableRow>
            ) : (
              paginatedWithdrawals.map((withdrawal) => {
                console.log(`withdrawal id: ${withdrawal.id}, hasTransfers: ${withdrawal.hasTransfers}`)
                const requestedAt = new Date(withdrawal.requestedAt)
                const concludedAt = withdrawal.concludedAt ? new Date(withdrawal.concludedAt) : null
                const requestedAtStr = format(requestedAt, "dd.MM.yy HH:mm:ss")
                const concludedAtStr = concludedAt ? format(concludedAt, "dd.MM.yy HH:mm:ss") : "Bilinmiyor"
                const [requestedDate, requestedTime] = requestedAtStr.split(" ")
                const [concludedDate, concludedTime] =
                  concludedAtStr === "Bilinmiyor" ? ["Bilinmiyor", ""] : concludedAtStr.split(" ")

                return (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="table-cell">{withdrawal.transactionId}</TableCell>
                    <TableCell className="table-cell">{withdrawal.playerFullname}</TableCell>
                    <TableCell className="table-cell">{withdrawal.method}</TableCell>
                    <TableCell className="table-cell">{withdrawal.amount} TL</TableCell>
                    <TableCell className="table-cell whitespace-pre-line">
                      {`${requestedDate}\n${requestedTime}`}
                    </TableCell>
                    <TableCell className="table-cell whitespace-pre-line">
                      {concludedAtStr === "Bilinmiyor" ? "Bilinmiyor" : `${concludedDate}\n${concludedTime}`}
                    </TableCell>
                    <TableCell className="table-cell">
                      {calculateDuration(withdrawal.requestedAt, withdrawal.concludedAt)}
                    </TableCell>
                    <TableCell className="table-cell">
                      {withdrawal.hasTransfers ? (
                        <DropdownMenu
                          open={openDropdownId === withdrawal.id}
                          onOpenChange={(open) => {
                            if (!open) {
                              setOpenDropdownId(null)
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              className="compact-btn"
                              onClick={() => {
                                console.log(`Görüntüle butonuna tıklandı, withdrawalId: ${withdrawal.id}`)
                                setOpenDropdownId(withdrawal.id)
                                handleViewTransfers(withdrawal.id)
                              }}
                            >
                              Görüntüle
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-[450px] overflow-x-hidden">
                            <div className="p-4">
                              <h4 className="font-medium mb-2">Transfer Geçmişi</h4>
                              {isLoadingTransfers[withdrawal.id] ? (
                                <div className="text-center text-sm text-muted-foreground">Yükleniyor...</div>
                              ) : transferErrors[withdrawal.id] ? (
                                <div className="text-center text-sm text-destructive">
                                  {transferErrors[withdrawal.id]}
                                </div>
                              ) : transfersData[withdrawal.id]?.length ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="table-head">Personel</TableHead>
                                      <TableHead className="table-head">Transfer Eden</TableHead>
                                      <TableHead className="table-head">Atanma Tarihi</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {[...transfersData[withdrawal.id]]
                                      .sort(
                                        (a, b) =>
                                          new Date(b.transferredAt).getTime() - new Date(a.transferredAt).getTime(),
                                      )
                                      .map((transfer, index) => (
                                        <TableRow key={index}>
                                          <TableCell className="table-cell w-1/3 truncate">
                                            {transfer.transferredTo || "Bilinmiyor"}
                                          </TableCell>
                                          <TableCell className="table-cell w-1/3 truncate">
                                            {transfer.transferredBy || "Bilinmiyor"}
                                          </TableCell>
                                          <TableCell className="table-cell w-1/3 truncate">
                                            {format(new Date(transfer.transferredAt), "dd.MM.yy HH:mm:ss")}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <div className="text-center text-sm text-muted-foreground">
                                  Transfer geçmişi bulunamadı.
                                </div>
                              )}
                            </div>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        withdrawal.handlerUsername
                      )}
                    </TableCell>
                    <TableCell className="table-cell table-note">{withdrawal.note}</TableCell>
                    <TableCell className="table-cell">
                      <span
                        className={`px-2 py-1 rounded ${withdrawal.withdrawalStatus === "approved" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}
                      >
                        {withdrawal.withdrawalStatus === "approved" ? "Onaylandı" : "Reddedildi"}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        {!isFiltered && (
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center rounded-md border border-[color:var(--border)] overflow-hidden">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                variant="ghost"
                className="h-10 px-4 py-2 text-sm font-medium border-r border-[color:var(--border)] rounded-none hover:bg-[color:var(--secondary)] hover:text-[color:var(--secondary-foreground)]"
              >
                Önceki
              </Button>
              {getPageNumbers().map((page, index) => (
                <Button
                  key={index}
                  onClick={() => typeof page === "number" && handlePageChange(page)}
                  disabled={page === "..."}
                  variant="ghost"
                  className={cn(
                    "h-10 min-w-[40px] px-3 py-2 text-sm font-medium border-r border-[color:var(--border)] rounded-none",
                    page === "..." ? "cursor-default" : "",
                    typeof page === "number" && page === currentPage
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                      : "hover:bg-[color:var(--secondary)] hover:text-[color:var(--secondary-foreground)]",
                  )}
                >
                  {page}
                </Button>
              ))}
              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                variant="ghost"
                className="h-10 px-4 py-2 text-sm font-medium rounded-none hover:bg-[color:var(--secondary)] hover:text-[color:var(--secondary-foreground)]"
              >
                Sonraki
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
