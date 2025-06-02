"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, startOfDay, endOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import { FiCalendar, FiFilter, FiXCircle, FiPlus } from "react-icons/fi"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Check, ChevronsUpDown } from "lucide-react"
import LoadingSpinner from '@/components/loading-spinner';
import { toast } from "sonner"

function translateRejectReason(reason: string): string {
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
}

const rejectReasons = [
  "anapara_cevrim",
  "acik_bonus_cevrim",
  "acik_bahis_cevrim",
  "coklu_hesap",
  "ip_coklu",
  "ayni_aile_coklu",
  "deneme_sinir",
  "call_siniri",
  "promosyon_sinir",
  "yatirim_sinir",
  "hediye_sinir",
  "bonus_sinir",
  "safe_bahis",
  "kurma_bahis",
  "bire1_bahis",
  "casino_kurma_bahis",
  "ozel_oyun_kontrol",
  "yatirim_bonus_suistimal",
  "cashback_suistimal",
  "deneme_suistimal",
  "hediye_suistimal",
  "yontem_sorunu",
  "sekiz_saatte_cekim",
  "tc_hata",
  "yeni_gun",
  "ikiyuztl_alt",
  "on_katlari",
]

interface Report {
  id: string; 
  codename: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl?: string;
}

interface Filter {
  status: string
  requestedBy: string
}

interface User {
  id: string;
  role: string;
  username: string;
}

type ReportsResponse = Report[];

const fetchReports = async (): Promise<ReportsResponse> => {
  const response = await fetch('/api/reports', { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Reports alınamadı: ${response.status}`)
  }
  return response.json()
}

const fetchReportsDownload = async (reportId: string): Promise<Report> => {
  const response = await fetch(`/api/reports/${reportId}`);
  if (!response.ok) {
    throw new Error(`Rapor detayları alınamadı: ${response.status}`);
  }
  return response.json();
}

const fetchCurrentUser = async (): Promise<User | null> => {
  const response = await fetch("/api/current-user", { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Kullanıcı alınamadı: ${response.status}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message);
  }
  return result.data;
};

const createReport = async (status: string | null, requestedBy: string) => {
  const body: { requestedBy: string; status?: string } = { requestedBy };
  if (status && status !== "all") {
    body.status = status;
  }

  console.log("Frontend rapor oluşturma isteği:", { body });

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      body: JSON.stringify(body),
      credentials: "include",
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Rapor oluşturulamadı: ${response.status}` };
      }
      console.error("Frontend rapor oluşturma hatası:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      throw new Error(errorData.message || `Rapor oluşturulamadı: ${response.status}`);
    }

    const result = await response.json();
    console.log("Frontend rapor oluşturma başarılı:", result);
    return result;
  } catch (error) {
    console.error("createReport hata:", error);
    throw error;
  }
};

export default function ReportsForm() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery<Report[]>({
  queryKey: ["reports"],
  queryFn: fetchReports,
  refetchInterval: 5000,
  refetchOnWindowFocus: false,
});

  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [rejectReasonFilter, setRejectReasonFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "rejected">("all")
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Kullanıcı yükleme hatası:", err);
        toast.error("Kullanıcı bilgileri alınamadı.");
      }
    };
    loadUser();
  }, []);

  const handleCreateReport = async () => {
    if (!user) {
      toast.error("Kullanıcı oturumu bulunamadı.");
      return;
    }

    setIsCreatingReport(true);
    try {
      await createReport(statusFilter, user.id);
      toast.success("Rapor başarıyla oluşturuldu!");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      console.error("Rapor oluşturma hatası:", err);
      toast.error(err instanceof Error ? err.message : "Rapor oluşturulamadı.");
    } finally {
      setIsCreatingReport(false);
    }
  };

  if (isLoading) return <LoadingSpinner />
  if (error) return <div>Hata: {(error as Error).message}</div>

  return (
    <div className="w-full">
      <div className="glass-effect p-4 mb-4 mx-auto max-w-5xl">
        <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-2 justify-items-stretch items-center">
          <div className="text-center w-full">
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
          <div className="text-center w-full">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={cn(
                    "w-full justify-start",
                    !rejectReasonFilter && "text-muted-foreground"
                  )}
                >
                  <FiXCircle className="h-4 w-4" />
                  <span className="truncate font-normal text-left">
                    {rejectReasonFilter ? translateRejectReason(rejectReasonFilter) : "RET Sebebi Seçin"}
                  </span>
                  <ChevronsUpDown className="ml-auto opacity-50 " />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0">
                <Command>
                  <CommandInput placeholder="Ret sebebi ara..." className="h-9" />
                  <CommandList>
                    <CommandEmpty>Ret sebebi bulunamadı.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Tümü"
                        onSelect={() => {
                          setRejectReasonFilter(null)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            rejectReasonFilter === null ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>Tüm Ret Sebepleri</span>
                      </CommandItem>
                      {rejectReasons.map((reason) => (
                        <CommandItem
                          key={reason}
                          value={reason}
                          onSelect={(currentValue) => {
                            setRejectReasonFilter(currentValue === rejectReasonFilter ? null : currentValue)
                            setOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              rejectReasonFilter === reason ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span>{translateRejectReason(reason)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="text-center w-full">
            <Select
              onValueChange={(value: "all" | "approved" | "rejected") => setStatusFilter(value)}
              defaultValue="all"
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="approved">Onay</SelectItem>
                <SelectItem value="rejected">Ret</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-center w-full">
            <div className="flex gap-2 w-full justify-between">
              <Button
                className="w-1/2 h-9 bg-primary hover:bg-primary/90 flex items-center justify-center"
                disabled={isCreatingReport} 
                onClick={handleCreateReport}
              >
                {isCreatingReport ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <FiPlus />
                    Rapor Oluştur
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-effect p-2 mb-4 mx-auto max-w-5xl">
        <div className="table-container">
          <Table className="table-auto table-compact">
            <TableHeader className="table-header">
              <TableRow>
                <TableHead className="table-head">Kod Adı</TableHead>
                <TableHead className="table-head">Tarih</TableHead>
                <TableHead className="table-head">Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="table-cell text-center py-3 text-sm">
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={3} className="table-cell text-center py-3 text-sm text-red-500">
                    Hata: {(error as Error).message}
                  </TableCell>
                </TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="table-cell text-center py-3 text-sm">
                    Rapor bulunamadı.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="table-cell">
                      {report.status === "completed" ? (
                        <span
                          className="text-blue-400 cursor-pointer hover:text-blue-500 font-semibold"
                          onClick={async () => {
                            try {
                              const reportDetail = await fetchReportsDownload(report.id);
                              const downloadUrl = reportDetail.downloadUrl;
                              if (downloadUrl) {
                                const downloadWindow = window.open(downloadUrl, "_blank");
                                if (downloadWindow) {
                                  downloadWindow.focus();
                                }
                              }
                            } catch (error) {
                              console.error("Hata:", error);
                              alert("Rapor detayları alınamadı. Lütfen tekrar deneyin.");
                            }
                          }}
                        >
                          {report.codename}
                        </span>
                      ) : (
                        report.codename
                      )}
                    </TableCell>
                    <TableCell className="table-cell">
                      {format(new Date(report.createdAt), 'dd.MM.yy HH:mm')}
                    </TableCell>
                    <TableCell className="table-cell">
                      {report.status === 'completed' ? 'Tamamlandı' : 'Bekliyor'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}