"use client"
import React, { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format, startOfDay, endOfDay } from "date-fns"
import { Circle, Clock, CircleCheck, CircleX } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FiSearch, FiCalendar, FiFilter } from "react-icons/fi"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import LoadingSpinner from "@/components/loading-spinner"

interface Log {
    transactionId: Int16Array;
    type: string;
    userId?: string;
    username?: string;
    activityStatus?: string;
    withdrawalId?: string;
    assignedTo?: string;
    concludeBy?: string;
    timestamp: string;
    details: string;
    result?: string;
    [key: string]: any; 
}

interface LogResponse {
    success: boolean;
    data: Log[];
    error?: string;
}

const fetchLogs = async (): Promise<LogResponse> => {
    const response = await fetch("/api/logs", { credentials: "include" })
    if (!response.ok) {
        throw new Error(`Loglar alınamadı: ${response.status}`)
    }
    return response.json()
}

export default function LogsForm() {
    const { data, isLoading, error } = useQuery<LogResponse>({
        queryKey: ["logs"],
        queryFn: fetchLogs,
        refetchInterval: 30000, // 30 saniye
    })

    const [usernameFilter, setUsernameFilter] = useState("")
    const [typeFilter, setTypeFilter] = useState("all")
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: undefined,
        to: undefined,
    })
    const [filteredLogs, setFilteredLogs] = useState<Log[]>([])
    const [mounted, setMounted] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [rowsPerPage] = useState(20)
    const [isFiltered, setIsFiltered] = useState(false)

    useEffect(() => {
        setMounted(true)
        if (data?.success && data.data.length > 0) {
            setFilteredLogs(data.data)
        }
    }, [data])

    const applyFilters = () => {
        if (!data?.success || !data.data) return

        const filtered = data.data.filter((log) => {

            const username = log.type === "status" ? log.username : log.type === "assignment" ? log.assignedTo : log.concludeBy
            if (usernameFilter && (!username || !username.toLowerCase().includes(usernameFilter.toLowerCase()))) {
                return false
            }

            if (typeFilter !== "all" && log.type !== typeFilter) {
                return false
            }

            if (dateRange.from || dateRange.to) {
                const logDate = new Date(log.timestamp)
                const filterStart = dateRange.from ? startOfDay(dateRange.from) : new Date(0)
                const filterEnd = dateRange.to ? endOfDay(dateRange.to) : new Date()
                if (logDate < filterStart || logDate > filterEnd) {
                    return false
                }
            }

            return true
        })

        setFilteredLogs(filtered)
        setCurrentPage(1)
        setIsFiltered(true)
    }

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

    const totalPages = isFiltered ? 1 : Math.ceil(filteredLogs.length / rowsPerPage)
    const paginatedLogs = isFiltered
        ? filteredLogs
        : filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

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

    if (!mounted) return null

    if (isLoading) {
        return <LoadingSpinner message="Loglar yükleniyor..." />
    }

    if (error) {
        return <div>Hata: {(error as Error).message}</div>
    }

    return (
        <div className="w-full">
            <div className="glass-effect p-4 mb-4 mx-auto max-w-6xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-center">
                    <div className="text-center">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Personel adı"
                                value={usernameFilter}
                                onChange={(e) => setUsernameFilter(e.target.value)}
                                className="w-full h-9 pl-10"
                            />
                        </div>
                    </div>

                    <div className="text-center">
                        <Select onValueChange={setTypeFilter} defaultValue="all">
                            <SelectTrigger className="w-full h-10">
                                <SelectValue placeholder="Tümü" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tümü</SelectItem>
                                <SelectItem value="status">Durum</SelectItem>
                                <SelectItem value="assignment">Talep Atanması</SelectItem>
                                <SelectItem value="conclude">Sonuçlama</SelectItem>
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
                        <Button
                            onClick={applyFilters}
                            className="w-full h-9 bg-primary hover:bg-primary/90 flex items-center justify-center"
                        >
                            <FiFilter />
                            Filtrele
                        </Button>
                    </div>
                </div>
            </div>

            <div className="glass-effect overflow-x-auto mx-auto max-w-6xl">
                <Table className="min-w-full table-auto table-compact">
                    <TableHeader className="table-header">
                        <TableRow>
                            <TableHead className="table-head">Personel</TableHead>
                            <TableHead className="table-head">İşlem</TableHead>
                            <TableHead className="table-head">Tarih</TableHead>
                            <TableHead className="table-head">Detay</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-3 text-sm text-muted-foreground">
                                    Log kaydı bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedLogs.map((log, index) => (
                                <TableRow key={index}>
                                    <TableCell className="table-cell">
                                        <div className="flex items-center justify-center gap-2">
                                            {log.type === "status" && (
                                                <Circle
                                                    className={`h-4 w-4 ${
                                                        log.activityStatus === "online"
                                                            ? "text-green-500"
                                                            : log.activityStatus === "away"
                                                            ? "text-amber-500"
                                                            : log.activityStatus === "offline"
                                                            ? "text-gray-500"
                                                            : "text-gray-400"
                                                    }`}
                                                />
                                            )}
                                            {log.type === "assignment" && (
                                                <Clock className="h-4 w-4 text-[#ba8e47]" />
                                            )}
                                            {log.type === "conclude" && log.result === "rejected" && (
                                                <CircleX className="h-4 w-4 text-red-500" />
                                            )}
                                            {log.type === "conclude" && log.result === "approved" && (
                                                <CircleCheck className="h-4 w-4 text-blue-500" />
                                            )}
                                            {log.type === "status" ? log.username : log.type === "assignment" ? log.assignedTo : log.concludeBy}
                                        </div>
                                    </TableCell>
                                    <TableCell className="table-cell">
                                        <span
                                            className={
                                                log.type === "assignment"
                                                    ? "text-[#ba8e47] font-semibold"
                                                    : log.type === "conclude" && log.result === "rejected"
                                                    ? "text-red-500 font-semibold"
                                                    : log.type === "conclude" && log.result === "approved"
                                                    ? "text-blue-500 font-semibold"
                                                    : log.type === "status" && log.activityStatus === "online"
                                                    ? "text-green-500 font-semibold"
                                                    : log.type === "status" && log.activityStatus === "away"
                                                    ? "text-amber-500 font-semibold"
                                                    : log.type === "status" && log.activityStatus === "offline"
                                                    ? "text-gray-500 font-semibold"
                                                    : "text-gray-400 font-semibold"
                                            }
                                        >
                                            {log.type === "assignment" && "Yeni çekim talebi aldı"}
                                            {log.type === "conclude" && log.result === "rejected" && "Çekim talebini reddetti"}
                                            {log.type === "conclude" && log.result === "approved" && "Çekim talebini onayladı"}
                                            {log.type === "status" && log.activityStatus === "online" && "Çevrimiçi oldu"}
                                            {log.type === "status" && log.activityStatus === "away" && "Mola aldı"}
                                            {log.type === "status" && log.activityStatus === "offline" && "Çevrimdışı oldu"}
                                            {!log.type ||
                                            (!log.result && log.type === "conclude") ||
                                            (!log.activityStatus && log.type === "status") ? (
                                                "Bilinmeyen işlem"
                                            ) : null}
                                        </span>
                                    </TableCell>
                                    <TableCell className="table-cell text-gray-400">
                                        {format(new Date(log.timestamp), "dd-MM-yyyy HH:mm:ss")}
                                    </TableCell>
                                    <TableCell className="table-cell">{log.details}</TableCell>
                                </TableRow>
                            ))
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