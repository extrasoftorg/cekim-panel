"use client"
import { useQuery } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import LoadingSpinner from "@/components/loading-spinner"
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
  createdAt: string
}

interface TransferHistory {
  transferredTo: string | null
  transferredBy: string | null
  transferredAt: string
}

const fetchPastWithdrawals = async (
  page: number = 0, 
  take: number = 50,
  filters: {
    playerFullname?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
    handler?: string;
    note?: string;
    status?: string;
  } = {}
) => {
  const params = new URLSearchParams({
    status: filters.status || 'approved,rejected',
    page: page.toString(),
    take: take.toString()
  })
  

  if (filters.playerFullname) params.append('playerFullname', filters.playerFullname);
  if (filters.method && filters.method !== 'yontem') params.append('method', filters.method);
  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.handler && filters.handler !== 'yetkili') params.append('handler', filters.handler);
  if (filters.note && filters.note !== 'note') params.append('note', filters.note);
  
  const response = await fetch(`/api/withdrawals?${params.toString()}`, { credentials: "include" })
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
  const [currentPage, setCurrentPage] = useState(0)
  const [rowsPerPage] = useState(50)
  
  const [playerUsernameInput, setPlayerUsernameInput] = useState("")
  const [methodInput, setMethodInput] = useState("yontem")
  const [dateRangeInput, setDateRangeInput] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [handlerInput, setHandlerInput] = useState("yetkili")
  const [noteInput, setNoteInput] = useState("note")
  const [statusInput, setStatusInput] = useState<"all" | "approved" | "rejected">("all")
  
  const [activeFilters, setActiveFilters] = useState({
    playerFullname: "",
    method: "yontem",
    dateFrom: undefined as string | undefined,
    dateTo: undefined as string | undefined,
    handler: "yetkili",
    note: "note",
    status: undefined as string | undefined
  })
  
  const {
    data: apiResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      "pastWithdrawals", 
      currentPage, 
      rowsPerPage, 
      activeFilters
    ],
    queryFn: () => fetchPastWithdrawals(currentPage, rowsPerPage, activeFilters),
    refetchOnWindowFocus: false,
  })

  const pastWithdrawals = apiResponse?.data || []
  const pagination = apiResponse?.pagination
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<Withdrawal[]>([])
  const [mounted, setMounted] = useState(false)

  const [isLoadingTransfers, setIsLoadingTransfers] = useState<{ [key: number]: boolean }>({})
  const [transferErrors, setTransferErrors] = useState<{ [key: number]: string | null }>({})
  const [transfersData, setTransfersData] = useState<{ [key: number]: TransferHistory[] }>({})
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null)
  const [isExcelLoading, setIsExcelLoading] = useState(false)

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
    let dateFrom: string | undefined = undefined
    let dateTo: string | undefined = undefined
    
    if (dateRangeInput.from) {
      const startOfDay = new Date(dateRangeInput.from)
      startOfDay.setHours(0, 0, 0, 0) 
      dateFrom = startOfDay.toISOString()
    }
    
    if (dateRangeInput.to) {
      const endOfDay = new Date(dateRangeInput.to)
      endOfDay.setHours(23, 59, 59, 999) 
      dateTo = endOfDay.toISOString()
    }
    
    setActiveFilters({
      playerFullname: playerUsernameInput,
      method: methodInput,
      dateFrom,
      dateTo,
      handler: handlerInput,
      note: noteInput,
      status: statusInput === 'all' ? undefined : statusInput
    })
    setCurrentPage(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      applyFilters()
    }
  }

  const handleExcelDownload = async () => {
    if (isExcelLoading) return; 
    
    setIsExcelLoading(true)
    try {
      const params = new URLSearchParams({
        status: activeFilters.status || 'approved,rejected',
        export: 'true'
      })
      
      if (activeFilters.playerFullname) params.append('playerFullname', activeFilters.playerFullname);
      if (activeFilters.method && activeFilters.method !== 'yontem') params.append('method', activeFilters.method);
      if (activeFilters.dateFrom) params.append('dateFrom', activeFilters.dateFrom);
      if (activeFilters.dateTo) params.append('dateTo', activeFilters.dateTo);
      if (activeFilters.handler && activeFilters.handler !== 'yetkili') params.append('handler', activeFilters.handler);
      if (activeFilters.note && activeFilters.note !== 'note') params.append('note', activeFilters.note);
      
      const response = await fetch(`/api/withdrawals?${params.toString()}`, { credentials: "include" })
      if (!response.ok) {
        throw new Error(`Export hatası: ${response.status}`)
      }
      
      const exportData = await response.json()
      const data = exportData.data || []
      
      const formattedData = data.map((withdrawal: Withdrawal) => ({
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
    } catch (error) {
      console.error('Excel export hatası:', error)
      alert('Excel export sırasında hata oluştu')
    } finally {
      setIsExcelLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    if (page >= 0 && page < (pagination?.totalPages || 1)) {
      setCurrentPage(page)
    }
  }

  const totalPages = pagination?.totalPages || 1
  const paginatedWithdrawals = pastWithdrawals 

  const getPageNumbers = () => {
    const maxPagesToShow = 20
    const pages = []

    if (totalPages <= maxPagesToShow) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i)
      }
      return pages
    }

    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages - 2, currentPage + 2)

    pages.push(0)

    if (startPage > 1) {
      pages.push("...")
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }

    if (endPage < totalPages - 2) {
      pages.push("...")
    }

    if (totalPages > 1) {
      pages.push(totalPages - 1)
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
                value={playerUsernameInput}
                onChange={(e) => setPlayerUsernameInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-9 pl-10"
              />
            </div>
          </div>
          <div className="text-center">
            <Select onValueChange={setMethodInput} value={methodInput}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Yöntem seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yontem">Yöntem</SelectItem>
                <SelectItem value="HizliKripto">HizliKripto</SelectItem>
                <SelectItem value="HavaleM">HavaleM</SelectItem>
                <SelectItem value="TrendHavale">TrendHavale</SelectItem>
                <SelectItem value="NakitAktarHavale">NakitAktarHavale</SelectItem>
                <SelectItem value="KralPaybanktransferNew">KralPaybanktransferNew</SelectItem>
                <SelectItem value="CPapara1">CPapara1</SelectItem>
                <SelectItem value="TurboHavale">TurboHavale</SelectItem>
                <SelectItem value="FlexPapara">FlexPapara</SelectItem>
                <SelectItem value="CPapara">CPapara</SelectItem>
                <SelectItem value="KolayPayPapara">KolayPayPapara</SelectItem>
                <SelectItem value="BigPayPaybol">BigPayPaybol</SelectItem>
                <SelectItem value="Aninda _Mefete">Aninda _Mefete</SelectItem>
                <SelectItem value="VipParola">VipParola</SelectItem>
                <SelectItem value="MPayV3Payco">MPayV3Payco</SelectItem>
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
                    !dateRangeInput.from && !dateRangeInput.to && "text-muted-foreground",
                  )}
                >
                  <FiCalendar className="" />
                  <span className="flex-1">
                    {dateRangeInput.from ? (
                      dateRangeInput.to ? (
                        `${format(dateRangeInput.from, "dd.MM.yy")} - ${format(dateRangeInput.to, "dd.MM.yy")}`
                      ) : (
                        `${format(dateRangeInput.from, "dd.MM.yy")} -`
                      )
                    ) : (
                      <span>Tarih Aralığı Seçin</span>
                    )}
                  </span>
                  {(dateRangeInput.from || dateRangeInput.to) && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setDateRangeInput({ from: undefined, to: undefined })
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
                  selected={{ from: dateRangeInput.from, to: dateRangeInput.to }}
                  onSelect={(range) => setDateRangeInput({ from: range?.from, to: range?.to })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-center">
            <Select onValueChange={setHandlerInput} value={handlerInput}>
              <SelectTrigger className="w-full h-10">
                <SelectValue placeholder="Yetkili" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yetkili">Yetkili</SelectItem>
                <SelectItem value="Çekim Botu">Çekim Botu</SelectItem>
                <SelectItem value="Burcu">Burcu</SelectItem>
                <SelectItem value="Berkin">Berkin</SelectItem>
                <SelectItem value="Yüce">Yüce</SelectItem>
                <SelectItem value="Batuhan">Batuhan</SelectItem>
                <SelectItem value="Çiğdem">Çiğdem</SelectItem>
                <SelectItem value="Serkan">Serkan</SelectItem>
                <SelectItem value="Mert">Mert</SelectItem>
                <SelectItem value="Soner">Soner</SelectItem>
                <SelectItem value="Cansu">Cansu</SelectItem>
                <SelectItem value="Oya">Oya</SelectItem>
                <SelectItem value="Atlas">Atlas</SelectItem>
                <SelectItem value="Eray">Eray</SelectItem>
                <SelectItem value="Yusuf">Yusuf</SelectItem>
                <SelectItem value="Çağrı">Çağrı</SelectItem>
                <SelectItem value="Leyla">Leyla</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center">
            <Select onValueChange={setNoteInput} value={noteInput}>
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
              onValueChange={(value: "all" | "approved" | "rejected") => setStatusInput(value)}
              value={statusInput}
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
                disabled={isExcelLoading}
                className="w-1/2 h-9 bg-green-500 hover:bg-green-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExcelLoading ? (
                  <>
                    <span className="ml-2">İndiriliyor..</span>
                  </>
                ) : (
                  <>
                    <FiDownload />
                    <span className="ml-1">Excel</span>
                  </>
                )}
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8">
                  <LoadingSpinner message="Veriler yükleniyor..." size="sm" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-3 text-sm text-destructive">
                  Hata: {(error as Error).message}
                </TableCell>
              </TableRow>
            ) : paginatedWithdrawals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-3 text-sm text-muted-foreground">
                  Geçmiş çekim talebi mevcut değildir.
                </TableCell>
              </TableRow>
            ) : (
              paginatedWithdrawals.map((withdrawal: Withdrawal) => {
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
                                <LoadingSpinner message="Transfer geçmişi yükleniyor..." size="sm" />
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
        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center rounded-md border border-[color:var(--border)] overflow-hidden">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
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
                disabled={currentPage >= totalPages - 1}
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
