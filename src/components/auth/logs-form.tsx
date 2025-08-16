"use client"
import React, { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Circle, Clock, CircleCheck, CircleX } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FiSearch } from "react-icons/fi"
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
    })

    const [filterUsername, setFilterUsername] = useState<string>("")
    const [filterType, setFilterType] = useState<string>("all") 

    if (isLoading) return <LoadingSpinner message="Loglar yükleniyor..." />
    if (error) return <div>Hata: {(error as Error).message}</div>

    const filteredData = data?.success && data.data
        ? data.data.filter((log) => {
              const username = log.type === "status" ? log.username : log.type === "assignment" ? log.assignedTo : log.concludeBy
              const matchesUsername = !filterUsername || (username && username.toLowerCase().includes(filterUsername.toLowerCase()))

              const matchesType = filterType === "all" || log.type === filterType
              return matchesUsername && matchesType
          })
        : []

    return (
        <div className="w-full">
            <div className="glass-effect p-3 mb-3 mx-auto max-w-6xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 items-center">
                    <div className="text-center">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Personel adı"
                                value={filterUsername}
                                onChange={(e) => setFilterUsername(e.target.value)}
                                className="w-full h-9 pl-9"
                            />
                        </div>
                    </div>

                    <div className="text-center">
                        <Select value={filterType} onValueChange={setFilterType}>
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

                    <div className="text-center"></div>
                    <div className="text-center"></div>
                    <div className="text-center"></div>
                    <div className="text-center"></div>
                    <div className="text-center"></div>
                </div>
            </div>

            <div className="glass-effect p-2 mb-4 mx-auto max-w-6xl">
                <div className="table-container">
                    <Table className="min-w-full table-auto table-compact">
                        <TableHeader className="table-header">
                            <TableRow>
                                <TableHead className="table-head max-w-xs">Personel</TableHead>
                                <TableHead className="table-head max-w-xs">İşlem</TableHead>
                                <TableHead className="table-head max-w-xs">Tarih</TableHead>
                                <TableHead className="table-head max-w-sm">Detay</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredData.length > 0 ? (
                                filteredData.map((log, index) => (
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
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="table-cell text-center text-muted-foreground">
                                        Filtreye uygun veri bulunamadı.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    )
}