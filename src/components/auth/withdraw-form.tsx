"use client"
import React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from 'lucide-react';
import { format } from "date-fns"
import { Input } from "@/components/ui/input";
import LoadingSpinner from '@/components/loading-spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { updateWithdrawalStatus } from "@/app/withdraw/actions"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "../../../supabaseClient"

// Tür Tanımları
interface Withdrawal {
  id: number
  playerUsername: string
  playerFullname: string
  note: string
  transactionId: number
  method: string
  amount: number
  requestedAt: string
  message: string
  withdrawalStatus: string
  handlingBy?: string | null
  handlerUsername?: string | null
}

interface User {
  id: string
  username: string
  role: string
  activityStatus: "online" | "offline" | "away"
  pendingWithdrawalsCount?: number
}

interface CurrentUser {
  id: string
  role: string
  username: string
}

// Form Values Türü (dinamik alanlar için)
interface FormValues {
  kuponId?: string
  additionalInfo?: string
  coklu?: string
  kapaCoklu?: string
  silCoklu?: string
}

// Kategoriler
const rejectionCategories: { [key: string]: { [subKey: string]: string[] } | string[] } = {
  "Eksik Çevrim": [
    "anapara_cevrim",
    "acik_bonus_cevrim",
    "acik_bahis_cevrim"
  ],
  "Çoklu Hesap": [
    "coklu_hesap",
    "ip_coklu",
    "ayni_aile_coklu"
  ],
  "Minimum Maksimum Çekim Sınırı": [
    "deneme_sinir",
    "call_siniri",
    "promosyon_sinir",
    "yatirim_sinir",
    "hediye_sinir",
    "bonus_sinir"
  ],
  "Suistimal Sorunları": {
    "Spor": [
      "safe_bahis",
      "kurma_bahis"
    ],
    "Casino": [
      "bire1_bahis",
      "casino_kurma_bahis",
      "ozel_oyun_kontrol"
    ],
    "Bonus": [
      "yatirim_bonus_suistimal",
      "cashback_suistimal",
      "deneme_suistimal",
      "hediye_suistimal"
    ]
  },
  "Yöntem Sorunu": [
    "yontem_sorunu"
  ],
  "TC Bilgileri Hatalı": [
    "tc_hata"
  ],
  "Çekim Saat Sınırı": [
    "sekiz_saatte_cekim"
  ],
  "Üye Talep İptali": [
    "uye_iptali"
  ],
  "Yeni Gün Talep": [
    "yeni_gun"
  ],
}

// Ret sebeplerini çeviri fonksiyonu
function translateRejectReason(reason: string): string {
  switch (reason) {
    case "uye_iptali":
      return "Üye Talep İptali";
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
      return "Çekim Saat Sınırı (8 Saatte Bir Çekim)";
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

// Component'ler
const AnaparaCevrimFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const AcikBonusCevrimFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="kuponId" className="text-left">
        Kupon ID
      </Label>
      <Input
        type="number"
        id="kuponId"
        name="kuponId"
        value={formValues.kuponId || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            kuponId: e.target.value,
          }))
        }
        placeholder="Kupon ID Girin"
        className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const AcikBahisCevrimFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="kuponId" className="text-left">
        Kupon ID
      </Label>
      <Input
        type="number"
        id="kuponId"
        name="kuponId"
        value={formValues.kuponId || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            kuponId: e.target.value,
          }))
        }
        placeholder="Kupon ID Girin"
        className="w-full [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const CokluHesapFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="coklu" className="text-left">
        Çoklu Hesapları
      </Label>
      <Input
        id="coklu"
        name="coklu"
        value={formValues.coklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            coklu: e.target.value,
          }))
        }
        placeholder="Çoklu Hesapları"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="kapaCoklu" className="text-left">
        Kapatılan Hesaplar
      </Label>
      <Input
        id="kapaCoklu"
        name="kapaCoklu"
        value={formValues.kapaCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            kapaCoklu: e.target.value,
          }))
        }
        placeholder="Kapatılan Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="silCoklu" className="text-left">
        Bakiyesi Silinen Hesaplar
      </Label>
      <Input
        id="silCoklu"
        name="silCoklu"
        value={formValues.silCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            silCoklu: e.target.value,
          }))
        }
        placeholder="Bakiyesi Silinen Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) => {
          const value = e.target.value;
          const valuesArray = value.trim().split(" ").filter(Boolean);
          const joinedValue = valuesArray.join(", ");
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: joinedValue,
          }));
        }}
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const IpCokluFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="coklu" className="text-left">
        Çoklu Hesapları
      </Label>
      <Input
        id="coklu"
        name="coklu"
        value={formValues.coklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            coklu: e.target.value,
          }))
        }
        placeholder="Çoklu Hesapları"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="kapaCoklu" className="text-left">
        Kapatılan Hesaplar
      </Label>
      <Input
        id="kapaCoklu"
        name="kapaCoklu"
        value={formValues.kapaCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            kapaCoklu: e.target.value,
          }))
        }
        placeholder="Kapatılan Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="silCoklu" className="text-left">
        Bakiyesi Silinen Hesaplar
      </Label>
      <Input
        id="silCoklu"
        name="silCoklu"
        value={formValues.silCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            silCoklu: e.target.value,
          }))
        }
        placeholder="Bakiyesi Silinen Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) => {
          const value = e.target.value;
          const valuesArray = value.trim().split(" ").filter(Boolean);
          const joinedValue = valuesArray.join(", ");
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: joinedValue,
          }));
        }}
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const AyniAileCokluFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="coklu" className="text-left">
        Çoklu Hesapları
      </Label>
      <Input
        id="coklu"
        name="coklu"
        value={formValues.coklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            coklu: e.target.value,
          }))
        }
        placeholder="Çoklu Hesapları"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="kapaCoklu" className="text-left">
        Kapatılan Hesaplar
      </Label>
      <Input
        id="kapaCoklu"
        name="kapaCoklu"
        value={formValues.kapaCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            kapaCoklu: e.target.value,
          }))
        }
        placeholder="Kapatılan Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="silCoklu" className="text-left">
        Bakiyesi Silinen Hesaplar
      </Label>
      <Input
        id="silCoklu"
        name="silCoklu"
        value={formValues.silCoklu || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            silCoklu: e.target.value,
          }))
        }
        placeholder="Bakiyesi Silinen Hesaplar"
        className="w-full"
      />
    </div>
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) => {
          const value = e.target.value;
          const valuesArray = value.trim().split(" ").filter(Boolean);
          const joinedValue = valuesArray.join(", ");
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: joinedValue,
          }));
        }}
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const DenemeSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const CallSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const PromosyonSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const YatirimSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const HediyeSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const BonusSinirFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const SafeBahisFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const KurmaBahisFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const Bire1BahisFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const CasinoKurmaBahisFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const OzelOyunKontrolFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const YatirimBonusSuistimalFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const CashbackSuistimalFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const DenemeSuistimalFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const HediyeSuistimalFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const YontemSorunuFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const UyeIptaliFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);


const TcHataFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const SekizSaatteCekimFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);

const YeniGunFields: React.FC<{ formValues: FormValues; setFormValues: React.Dispatch<React.SetStateAction<FormValues>> }> = ({ formValues, setFormValues }) => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="additionalInfo" className="text-left">
        Ek Bilgi
      </Label>
      <Textarea
        id="additionalInfo"
        name="additionalInfo"
        value={formValues.additionalInfo || ""}
        onChange={(e) =>
          setFormValues((prev) => ({
            ...prev,
            additionalInfo: e.target.value,
          }))
        }
        placeholder="Ek Bilgi"
        className="w-full resize-none"
      />
    </div>
  </div>
);
// Component Mapping
const rejectionFieldComponents = {
  uye_iptali: UyeIptaliFields,
  tc_hata: TcHataFields,
  sekiz_saatte_cekim: SekizSaatteCekimFields,
  yeni_gun: YeniGunFields,
  anapara_cevrim: AnaparaCevrimFields,
  acik_bonus_cevrim: AcikBonusCevrimFields,
  acik_bahis_cevrim: AcikBahisCevrimFields,
  coklu_hesap: CokluHesapFields,
  ip_coklu: IpCokluFields,
  ayni_aile_coklu: AyniAileCokluFields,
  deneme_sinir: DenemeSinirFields,
  call_siniri: CallSinirFields,
  promosyon_sinir: PromosyonSinirFields,
  yatirim_sinir: YatirimSinirFields,
  hediye_sinir: HediyeSinirFields,
  bonus_sinir: BonusSinirFields,
  safe_bahis: SafeBahisFields,
  kurma_bahis: KurmaBahisFields,
  bire1_bahis: Bire1BahisFields,
  casino_kurma_bahis: CasinoKurmaBahisFields,
  ozel_oyun_kontrol: OzelOyunKontrolFields,
  yatirim_bonus_suistimal: YatirimBonusSuistimalFields,
  cashback_suistimal: CashbackSuistimalFields,
  deneme_suistimal: DenemeSuistimalFields,
  hediye_suistimal: HediyeSuistimalFields,
  yontem_sorunu: YontemSorunuFields,
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "online":
      return "bg-green-500"
    case "away":
      return "bg-yellow-500"
    case "offline":
      return "bg-gray-500"
    default:
      return "bg-gray-500"
  }
}

const translateRole = (role: string): string => {
  switch (role.toLowerCase()) {
    case "admin":
      return "Yönetici"
    case "cekimsorumlusu":
      return "Çekim Sorumlusu"
    case "cekimpersoneli":
      return "Çekim Personeli"
    case "spectator":
      return "İzleyici"
    default:
      return "Bilinmeyen Rol"
  }
}

const groupUsersByRole = (users: User[]) => {
  const grouped: { [key: string]: User[] } = {}

  users.forEach((user) => {
    const role = user.role.toLowerCase()
    if (!grouped[role]) {
      grouped[role] = []
    }
    grouped[role].push(user)
  })

  const roleOrder = ["admin", "cekimsorumlusu", "cekimpersoneli", "spectator"]
  const sortedRoles = Object.keys(grouped).sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b))

  return sortedRoles.map((role) => ({
    role,
    users: grouped[role],
  }))
}

const fetchCurrentUser = async () => {
  const response = await fetch("/api/current-user", { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Kullanıcı bilgisi alınamadı: ${response.status}`)
  }
  const result = await response.json()
  return result.data
}

const fetchWithdrawals = async () => {
  const response = await fetch("/api/withdrawals?status=pending", { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Çekim talepleri alınamadı: ${response.status}`)
  }
  return await response.json()
}

const fetchUsersByStatus = async (status: "online" | "offline" | "away") => {
  const response = await fetch(`/api/users?status=${status}`, { credentials: "include" })
  if (!response.ok) {
    throw new Error(`Kullanıcılar alınamadı: ${response.status}`)
  }
  const result = await response.json()
  if (!result.success) {
    throw new Error(result.message || "API başarısız")
  }
  return result.data ?? []
}

// Bildirim sesini çalma fonksiyonu
const playNotificationSound = () => {
  console.log("playNotificationSound fonksiyonu çağrıldı."); // Debug: Fonksiyonun çağrıldığını kontrol et
  const audio = new Audio('/sfx/table-live-update.wav');
  audio.play()
    .then(() => {
      console.log("Ses başarıyla çalındı.");
    })
    .catch((error) => {
      console.error('Ses çalma hatası:', error);
      toast.error("Hata", { description: "Bildirim sesi çalınamadı: " + error.message });
    });
};

export default function WithdrawPage() {
  const queryClient = useQueryClient()

  const { data: currentUser, isLoading: currentUserLoading, error: currentUserError } = useQuery<CurrentUser>({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
  })

  const { data: withdrawals = [], isLoading: withdrawalsLoading, error: withdrawalsError } = useQuery<Withdrawal[]>({
    queryKey: ["pendingWithdrawals"],
    queryFn: fetchWithdrawals,
    refetchInterval: 5000,
  })

  const { data: onlineUsers = [], isLoading: onlineUsersLoading, error: onlineUsersError } = useQuery<User[]>({
    queryKey: ["users", "online"],
    queryFn: () => fetchUsersByStatus("online"),
    refetchInterval: 10000,
    enabled: true,
  })

  const { data: offlineUsers = [], isLoading: offlineUsersLoading, error: offlineUsersError } = useQuery<User[]>({
    queryKey: ["users", "offline"],
    queryFn: () => fetchUsersByStatus("offline"),
    refetchInterval: 10000,
    enabled: true,
  })

  const { data: awayUsers = [], isLoading: awayUsersLoading, error: awayUsersError } = useQuery<User[]>({
    queryKey: ["users", "away"],
    queryFn: () => fetchUsersByStatus("away"),
    refetchInterval: 10000,
    enabled: true,
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<number | null>(null)
  const [selectedAction, setSelectedAction] = useState<"approve" | "reject" | "manuelApprove" | "manuelReject" | null>(null)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("")
  const [selectedRejectReason, setSelectedRejectReason] = useState<string>("")
  const [formValues, setFormValues] = useState<FormValues>({})
  const [setBalanceChecked, setSetBalanceChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailWithdrawal, setSelectedDetailWithdrawal] = useState<Withdrawal | null>(null);

  // Realtime dinleyiciyi useEffect ile kur
  useEffect(() => {
    if (!currentUser) {
      console.log("currentUser yüklenmedi, dinleyici başlatılmadı.");
      return;
    }

    console.log("Dinleyici başlatılıyor, currentUser.id:", currentUser.id);

    const channel = supabase.channel('withdrawals-channel');

    // Sadece INSERT olaylarını dinle
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'withdrawals',
        filter: `handling_by=eq.${currentUser.id}`,
      },
      (payload) => {
        console.log('INSERT Dinleyici tetiklendi:', payload);
        const newWithdrawal = payload.new as Withdrawal;

        console.log("Yeni çekim talebi alındı, ses çalınıyor ve bildirim gönderiliyor.");
        playNotificationSound();
        queryClient.invalidateQueries({ queryKey: ["pendingWithdrawals"] });
      }
    );

    channel.subscribe((status) => {
      console.log("Supabase kanal durumu:", status);
    });

    return () => {
      console.log("Dinleyici temizleniyor.");
      supabase.removeChannel(channel);
    };
  }, [currentUser, queryClient]);

  const handleTransfer = async (withdrawalId: number, newHandlerId: string) => {
    if (!currentUser) {
      toast.error("Hata", { description: "Kullanıcı bilgisi alınamadı" })
      return
    }

    try {
      const response = await fetch("/api/withdrawals/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ withdrawalId, newHandlerId }),
      })

      const result = await response.json()
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["pendingWithdrawals"] })
        toast.success("İşlem başarılı", { description: result.message })
      } else {
        toast.error("İşlem başarısız", { description: result.message })
      }
    } catch {
      toast.error("İşlem başarısız", { description: "Bir hata oluştu" })
    }
  }

  const handleActionSelect = (withdrawalId: number, action: "approve" | "reject" | "manuelApprove" | "manuelReject") => {
    const withdrawal = withdrawals.find((w) => w.id === withdrawalId)
    setSelectedWithdrawalId(withdrawalId)
    setSelectedAction(action)
    setSelectedWithdrawal(withdrawal || null)
    setSelectedCategory("")
    setSelectedSubCategory("")
    setSelectedRejectReason("")
    setFormValues({})
    setSetBalanceChecked(false)
    setIsModalOpen(true)
  }

  const checkReqFields = () => {
    if (!selectedCategory) {
      toast.error("Hata", { description: "Ana RET Sebebi seçiniz." })
      return false
    }

    if (selectedCategory === "Suistimal Sorunları" && typeof rejectionCategories[selectedCategory] === 'object' && !selectedSubCategory) {
      toast.error("Hata", { description: "Alt Kategori seçiniz." })
      return false
    }

    if (!selectedRejectReason) {
      toast.error("Hata", { description: "RET Sebebi seçiniz." })
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    if ((selectedAction === "reject" || selectedAction === "manuelReject") && !checkReqFields()) {
      setIsSubmitting(false);
      return;
    }
    const formData = new FormData(e.currentTarget);
    const additionalInfo = formData.get("additionalInfo") as string | null;
    const deleteRemainingBalance = formData.get("deleteRemainingBalance") === "on";
    const setBalance = formData.get("setBalance") === "on";
    const customBalanceRaw = formData.get("customBalance");
    const customBalance =
      customBalanceRaw === null || customBalanceRaw === ""
        ? undefined
        : Number(customBalanceRaw);
    console.log(customBalance);
    await handleAction(selectedWithdrawalId!, selectedAction!, additionalInfo, deleteRemainingBalance, setBalance, customBalance);
    setIsSubmitting(false);
  }

  

  const handleAction = async (
    id: number,
    action: "approve" | "reject" | "manuelApprove" | "manuelReject",
    note: string | null,
    deleteRemainingBalance: boolean,
    setBalance: boolean,
    customBalance: number | undefined
  ) => {
    if (!id || !action) return

    const formData = new FormData()
    formData.append("id", id.toString())
    formData.append("action", action)
    if (setBalance) formData.append("setBalance", "true");
    if (customBalance !== undefined) formData.append("customBalance", customBalance.toString());
    if (note) formData.append("note", note)
    if (deleteRemainingBalance) formData.append("deleteRemainingBalance", "true")
    if (selectedRejectReason) formData.append("rejectReason", selectedRejectReason)
    if (Object.keys(formValues).length > 0) {
      formData.append("additionalInfo", JSON.stringify(formValues))
    }

    const result = await updateWithdrawalStatus(formData)
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["pendingWithdrawals"] })
      toast.success("İşlem başarılı", { description: result.message })
    } else {
      toast.error("İşlem başarısız", {
        description: typeof result.error === "string" ? result.error : "Bir hata oluştu",
      })
    }
    setIsModalOpen(false)
    setSelectedWithdrawalId(null)
    setSelectedAction(null)
    setSelectedCategory("")
    setSelectedSubCategory("")
    setSelectedRejectReason("")
    setSelectedWithdrawal(null)
    setFormValues({})
  }

  const handleStatusChange = async (userId: string, newStatus: "online" | "away" | "offline") => {
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, status: newStatus }),
      })

      const result = await response.json()
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["users", "online"] })
        queryClient.invalidateQueries({ queryKey: ["users", "offline"] })
        queryClient.invalidateQueries({ queryKey: ["users", "away"] })
        toast.success("İşlem başarılı", { description: result.message })
      } else {
        toast.error("İşlem başarısız", { description: result.message || "Durum güncellenemedi" })
      }
    } catch (error) {
      console.error("handleStatusChange: Durum güncelleme hatası:", error)
      toast.error("İşlem başarısız", { description: "Bir hata oluştu, lütfen tekrar deneyin" })
    }
  }

  if (currentUserLoading || withdrawalsLoading || onlineUsersLoading || offlineUsersLoading || awayUsersLoading) {
    return <LoadingSpinner />
  }

  if (currentUserError) {
    return <div className="text-red-500">Hata: {currentUserError.message}</div>
  }
  if (!currentUser) {
    return <div className="text-red-500">Hata: Kullanıcı bilgisi alınamadı</div>
  }
  if (withdrawalsError) {
    return <div className="text-red-500">Hata: Çekim talepleri alınamadı: {withdrawalsError.message}</div>
  }
  if (onlineUsersError) {
    return <div className="text-red-500">Hata: Çevrimiçi kullanıcılar alınamadı: {onlineUsersError.message}</div>
  }
  if (offlineUsersError) {
    return <div className="text-red-500">Hata: Çevrimdışı kullanıcılar alınamadı: {offlineUsersError.message}</div>
  }
  if (awayUsersError) {
    return <div className="text-red-500">Hata: Molada olan kullanıcılar alınamadı: {awayUsersError.message}</div>
  }

  const sortedWithdrawals = [...withdrawals].sort((a, b) => {
    const isCekimPersoneli = currentUser.role.toLowerCase() === "cekimpersoneli"
    if (isCekimPersoneli) {
      if (a.handlingBy === currentUser.id && b.handlingBy !== currentUser.id) return -1
      if (a.handlingBy !== currentUser.id && b.handlingBy === currentUser.id) return 1
    }
    
    if (a.handlingBy === b.handlingBy) {
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    }
    
    if (a.handlingBy === null && b.handlingBy !== null) return 1
    if (a.handlingBy !== null && b.handlingBy === null) return -1
    
    return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
  })

  const filteredOnlineUsers = onlineUsers.filter((user: User) => user.role !== "spectator")
  const filteredOfflineUsers = offlineUsers.filter((user: User) => user.role !== "spectator")
  const filteredAwayUsers = awayUsers.filter((user: User) => user.role !== "spectator")

  const onlineUsersWithPendingCount = filteredOnlineUsers.map((user: User) => ({
    ...user,
    pendingWithdrawalsCount: withdrawals.filter(
      (withdrawal: Withdrawal) =>
        withdrawal.handlingBy === user.id && withdrawal.withdrawalStatus === "pending",
    ).length,
  }))

  const onlineGrouped = groupUsersByRole(onlineUsersWithPendingCount)
  const offlineGrouped = groupUsersByRole(filteredOfflineUsers)
  const awayGrouped = groupUsersByRole(filteredAwayUsers)

  return (
    <div className="grid grid-cols-[1fr_230px]">
      {/* Çekim talepleri tablosu */}
      <div className="glass-effect overflow-x-auto">
        <div className="table-container w-[110%]">
          <Table className="min-w-full table-auto table-compact">
            <TableHeader className="table-header">
              <TableRow>
                <TableHead className="table-head">Müşteri ID</TableHead>
                <TableHead className="table-head">Müşteri Ad</TableHead>
                <TableHead className="table-head">İşlem</TableHead>
                <TableHead className="table-head">Çevrim</TableHead>
                <TableHead className="table-head">Not</TableHead>
                <TableHead className="table-head">Talep Tarihi</TableHead>
                <TableHead className="table-head">Çekim ID</TableHead>
                <TableHead className="table-head">Yöntem</TableHead>
                <TableHead className="table-head">Miktar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedWithdrawals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-3 text-sm">
                    Aktif çekim talebi mevcut değildir.
                  </TableCell>
                </TableRow>
              ) : (
                sortedWithdrawals.map((withdrawal: Withdrawal) => {
                  const requestedAt = new Date(withdrawal.requestedAt)
                  const requestedAtStr = format(requestedAt, 'dd-MM-yy HH:mm:ss');
                  const [requestedDate, requestedTime] = requestedAtStr.split(' ')

                  return (
                    <TableRow key={withdrawal.id}>
                      <TableCell className="table-cell">{withdrawal.playerUsername}</TableCell>
                      <TableCell className="table-cell">
                        <span
                          className="text-blue-400 cursor-pointer hover:text-blue-500"
                          onClick={() => {
                            navigator.clipboard.writeText(withdrawal.playerFullname).then(() => {
                              toast.success("Başarılı", { description: "Panoya müşteri adı kopyalandı!" });
                            }).catch(() => {
                              toast.error("Hata", { description: "Kopyalama başarısız oldu." });
                            });
                          }}
                        >
                          {withdrawal.playerFullname}
                        </span>
                      </TableCell>
                      <TableCell className="table-cell">
                        <div className="inline-flex gap-1.5 justify-center">
                          {!withdrawal.handlingBy &&
                            (currentUser.role.toLowerCase() === "cekimpersoneli" ||
                              currentUser.role.toLowerCase() === "admin" ||
                              currentUser.role.toLowerCase() === "cekimsorumlusu") && (
                              <Button
                                size="sm"
                                className="compact-btn"
                                onClick={() => handleTransfer(withdrawal.id, currentUser.id)}
                              >
                                Talebi Al
                              </Button>
                            )}
                          {(currentUser.role.toLowerCase() === "admin" ||
                            currentUser.role.toLowerCase() === "cekimsorumlusu" ||
                            (currentUser.role.toLowerCase() === "cekimpersoneli" &&
                              withdrawal.handlingBy === currentUser.id)) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" className="compact-btn" variant="lightBlue">
                                    Transfer
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="left" align="center">
                                  {(currentUser.role.toLowerCase() === "admin" ||
                                    currentUser.role.toLowerCase() === "cekimsorumlusu") && (
                                      <DropdownMenuItem onClick={() => handleTransfer(withdrawal.id, currentUser.id)}>
                                        {currentUser.username} (Kendim)
                                      </DropdownMenuItem>
                                    )}
                                  {onlineUsers
                                    .filter(
                                      (user: User) =>
                                        (user.role.toLowerCase() === "cekimpersoneli" ||
                                          user.role.toLowerCase() === "admin" ||
                                          user.role.toLowerCase() === "cekimsorumlusu") &&
                                        user.id !== currentUser.id &&
                                        user.id !== withdrawal.handlingBy,
                                    )
                                    .map((user: User) => (
                                      <DropdownMenuItem
                                        key={user.id}
                                        onClick={() => handleTransfer(withdrawal.id, user.id)}
                                      >
                                        {user.username} ({translateRole(user.role)})
                                      </DropdownMenuItem>
                                    ))}
                                  {onlineUsers.filter(
                                    (user: User) =>
                                      (user.role.toLowerCase() === "cekimpersoneli" ||
                                        user.role.toLowerCase() === "admin" ||
                                        user.role.toLowerCase() === "cekimsorumlusu") &&
                                      user.id !== currentUser.id &&
                                      user.id !== withdrawal.handlingBy,
                                  ).length === 0 ? (
                                    <DropdownMenuItem disabled>Çevrimiçi personel yok</DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuSeparator />
                                  )}
                                  <DropdownMenuItem onClick={() => handleTransfer(withdrawal.id, "unassign")}>
                                    Talebi Boşa Düşür
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          <Button 
                            size="sm" 
                            className="compact-btn" 
                            variant="gray"
                            onClick={() => {
                              setSelectedDetailWithdrawal(withdrawal);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            Detay
                          </Button>
                          {currentUser.id !== withdrawal.handlingBy && withdrawal.handlingBy && (
                            <Button 
                              size="sm" 
                              className="compact-btn" 
                              variant={withdrawal.amount >= 10000 ? "red" : "softPurple"}
                            >
                              {withdrawal.handlerUsername}
                            </Button>
                          )}
                          {(currentUser.role.toLowerCase() === "cekimpersoneli" ||
                            currentUser.role.toLowerCase() === "admin" ||
                            currentUser.role.toLowerCase() === "cekimsorumlusu") &&
                            currentUser.id === withdrawal.handlingBy && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    className="compact-btn" 
                                    variant={withdrawal.amount >= 10000 ? "bred" : "green"}
                                  >
                                    İşlem
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="center">
                                  <DropdownMenuItem onClick={() => handleActionSelect(withdrawal.id, "approve")}>
                                    ONAY
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleActionSelect(withdrawal.id, "manuelApprove")}>
                                    MANUEL - ONAY
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleActionSelect(withdrawal.id, "reject")}>
                                    RET
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleActionSelect(withdrawal.id, "manuelReject")}>
                                    MANUEL - RET
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="table-cell">
                        <span
                          className="text-yellow-500 cursor-pointer hover:text-yellow-600 text-sm font-medium"
                          onClick={() => { }}
                        >
                          Görüntüle
                        </span>
                      </TableCell>
                      <TableCell className="table-cell table-note">{withdrawal.note}</TableCell>
                      <TableCell className="table-cell whitespace-pre-line">
                        {`${requestedDate}\n${requestedTime}`}
                      </TableCell>
                      <TableCell className="table-cell">{withdrawal.transactionId}</TableCell>
                      <TableCell className="table-cell">
                        <div className="flex justify-center items-center gap-1">
                          {(withdrawal.method === "HizliKripto" || withdrawal.method === "Aninda_Kripto") && (
                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                          )}
                          {withdrawal.method}
                        </div>
                      </TableCell>
                      <TableCell className="table-cell">
                        <div className="flex justify-center items-center gap-1">
                          {withdrawal.amount >= 10000 && (
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={withdrawal.amount >= 10000 ? "text-red-500" : ""}>
                            ₺{new Intl.NumberFormat('tr-TR').format(withdrawal.amount)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Kullanıcılar paneli */}
      <div className="glass-effect2 h-auto ml-2 p-2">
        <Tabs defaultValue="online" className="w-auto">
          <TabsList className="grid grid-cols-3 w-auto mb-2">
            <TabsTrigger value="online">
              <div className="flex items-center space-x-1">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                <span className="text-[10px]">Çevrimiçi</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="away">
              <div className="flex items-center space-x-1">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500"></div>
                <span className="text-[10px]">Molada</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="offline">
              <div className="flex items-center space-x-1">
                <div className="h-1.5 w-1.5 rounded-full bg-gray-500"></div>
                <span className="text-[10px]">Çevrimdışı</span>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="online" className="mt-0 overflow-y-auto flex-2 px-2">
            <div className="space-y-2">
              {onlineGrouped.length > 0 ? (
                onlineGrouped.map((group) => (
                  <div key={group.role}>
                    <h3 className="text-xs font-semibold text-[color:var(--primary)] mb-1">
                      {translateRole(group.role)}
                    </h3>
                    <div className="space-y-2">
                      {group.users.map((user: User) => (
                        <PersonelCard
                          key={user.id}
                          name={user.username}
                          role={user.role}
                          status={user.activityStatus.toLowerCase() as "online" | "offline" | "away"}
                          userId={user.id}
                          pendingWithdrawalsCount={user.pendingWithdrawalsCount}
                          currentUser={currentUser}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Çevrimiçi personel bulunmamaktadır.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="away" className="mt-0 overflow-y-auto flex-2 px-2">
            <div className="space-y-2">
              {awayGrouped.length > 0 ? (
                awayGrouped.map((group) => (
                  <div key={group.role}>
                    <h3 className="text-xs font-semibold text-[color:var(--primary)] mb-1">
                      {translateRole(group.role)}
                    </h3>
                    <div className="space-y-2">
                      {group.users.map((user: User) => (
                        <PersonelCard
                          key={user.id}
                          name={user.username}
                          role={user.role}
                          status={user.activityStatus.toLowerCase() as "online" | "offline" | "away"}
                          userId={user.id}
                          currentUser={currentUser}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Molada olan personel bulunmamaktadır.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="offline" className="mt-0 overflow-y-auto flex-2 px-2">
            <div className="space-y-2">
              {offlineGrouped.length > 0 ? (
                offlineGrouped.map((group) => (
                  <div key={group.role}>
                    <h3 className="text-xs font-semibold text-[color:var(--primary)] mb-1">
                      {translateRole(group.role)}
                    </h3>
                    <div className="space-y-2">
                      {group.users.map((user: User) => (
                        <PersonelCard
                          key={user.id}
                          name={user.username}
                          role={user.role}
                          status={user.activityStatus.toLowerCase() as "online" | "offline" | "away"}
                          userId={user.id}
                          currentUser={currentUser}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">Çevrimdışı personel bulunmamaktadır.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal: Onay/Ret için ek adım */}
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      >
        <DialogContent className="sm:max-w-[425px] bg-background rounded-lg shadow-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAction === "approve" ? "Talebi Onayla" :
                selectedAction === "reject" ? "Talebi Reddet" :
                  selectedAction === "manuelApprove" ? "Talebi Manuel Onayla" : "Talebi Manuel Reddet"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {(selectedAction === "reject" || selectedAction === "manuelReject") ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-left">Ana RET Sebebi <span className="text-red-500">*</span></Label>
                    <Select
                      value={selectedCategory}
                      onValueChange={(value) => {
                        setSelectedCategory(value)
                        setSelectedSubCategory("")
                        setSelectedRejectReason("")
                        setFormValues({})
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seçiniz" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(rejectionCategories).map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCategory && (
                    rejectionCategories[selectedCategory] instanceof Array ? (
                      <div className="space-y-2">
                        <Label htmlFor="reason" className="text-left">RET Sebebi <span className="text-red-500">*</span></Label>
                        <Select
                          value={selectedRejectReason}
                          onValueChange={(value) => {
                            setSelectedRejectReason(value)
                            setFormValues({})
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seçiniz" />
                          </SelectTrigger>
                          <SelectContent>
                            {(rejectionCategories[selectedCategory] as string[]).map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {translateRejectReason(reason)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="subCategory" className="text-left">Alt Kategori <span className="text-red-500">*</span></Label>
                          <Select
                            value={selectedSubCategory}
                            onValueChange={(value) => {
                              setSelectedSubCategory(value)
                              setSelectedRejectReason("")
                              setFormValues({})
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.keys(rejectionCategories[selectedCategory] as { [key: string]: string[] }).map((subCategory) => (
                                <SelectItem key={subCategory} value={subCategory}>
                                  {subCategory}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedSubCategory && (
                          <div className="space-y-2">
                            <Label htmlFor="reason" className="text-left">RET Sebebi <span className="text-red-500">*</span></Label>
                            <Select
                              value={selectedRejectReason}
                              onValueChange={(value) => {
                                setSelectedRejectReason(value)
                                setFormValues({})
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seçiniz" />
                              </SelectTrigger>
                              <SelectContent>
                                {((rejectionCategories[selectedCategory] as { [key: string]: string[] })[selectedSubCategory] as string[]).map((reason) => (
                                  <SelectItem key={reason} value={reason}>
                                    {translateRejectReason(reason)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )
                  )}
                  {selectedRejectReason && rejectionFieldComponents[selectedRejectReason as keyof typeof rejectionFieldComponents] && (
                    React.createElement(rejectionFieldComponents[selectedRejectReason as keyof typeof rejectionFieldComponents], {
                      formValues,
                      setFormValues,
                    })
                  )}
                </>
              ) : null}
              {(selectedAction === "approve" || selectedAction === "manuelApprove") && (
                <div className="space-y-2">
                  <Label htmlFor="additionalInfo" className="text-left">
                    Ek Bilgi
                  </Label>
                  <Textarea
                    id="additionalInfo"
                    name="additionalInfo"
                    value={formValues.additionalInfo || ""}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        additionalInfo: e.target.value,
                      }))
                    }
                    placeholder="Ek Bilgi"
                    className="w-full resize-none"
                  />
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Label htmlFor="deleteRemainingBalance" className="text-left">Kalan Bakiyeyi Sil</Label>
                <div>
                  <Checkbox id="deleteRemainingBalance" name="deleteRemainingBalance" />
                </div>
              </div>
              <div className="space-y-0">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="setBalance" className="text-left">Bakiyeyi Ayarla</Label>
                  <div>
                    <Checkbox
                      id="setBalance"
                      name="setBalance"
                      checked={setBalanceChecked}
                      onCheckedChange={(checked) => setSetBalanceChecked(checked as boolean)}
                    />
                  </div>
                </div>
                <div className="mt-1">
                  <Input
                    type="number"
                    id="customBalance"
                    name="customBalance"
                    placeholder="Bakiye Miktarı Girin"
                    className="w-[200px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    disabled={!setBalanceChecked}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="compact-btn"
                onClick={() => {
                  setIsModalOpen(false)
                  setSelectedWithdrawalId(null)
                  setSelectedAction(null)
                  setSelectedCategory("")
                  setSelectedSubCategory("")
                  setSelectedRejectReason("")
                  setSelectedWithdrawal(null)
                  setFormValues({})
                  setIsSubmitting(false)
                }}
                disabled={isSubmitting}
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="compact-btn"
                disabled={
                  isSubmitting ||
                  ((selectedAction === "reject" || selectedAction === "manuelReject") &&
                    (!selectedCategory ||
                      (selectedCategory === "Suistimal Sorunları" &&
                        typeof rejectionCategories[selectedCategory] === 'object' &&
                        !selectedSubCategory) ||
                      !selectedRejectReason))
                }
              >
                {selectedAction === "approve" || selectedAction === "manuelApprove" ? "Onayla" : "Reddet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDetailModalOpen}
        onOpenChange={setIsDetailModalOpen}
      >
        <DialogContent className="sm:max-w-[500px] bg-background rounded-lg shadow-md">
          <DialogHeader>
            <DialogTitle>Çekim Detayları</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedDetailWithdrawal && (
              <p className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap">
                {selectedDetailWithdrawal.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="compact-btn"
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedDetailWithdrawal(null);
              }}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PersonelCard({
  name,
  role,
  status,
  userId,
  pendingWithdrawalsCount = 0,
  currentUser,
  onStatusChange,
}: {
  name: string
  role: string
  status: "online" | "away" | "offline"
  userId: string
  pendingWithdrawalsCount?: number
  currentUser: CurrentUser
  onStatusChange: (userId: string, newStatus: "online" | "away" | "offline") => Promise<void>
}) {
  const canChangeStatus = currentUser.role.toLowerCase() === "admin" || currentUser.role.toLowerCase() === "cekimsorumlusu"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canChangeStatus}>
        <div
          className={`personel-card p-2 border border-[color:var(--border)] rounded-md bg-[color:var(--card)] shadow-sm ${canChangeStatus ? "cursor-pointer hover:bg-[color:var(--hover)]" : ""
            }`}
        >
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[color:var(--secondary)] flex items-center justify-center text-[color:var(--primary)]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <div>
              <div className="font-medium text-[color:var(--primary)] text-sm">
                {name}
                {status === "online" && ` (${pendingWithdrawalsCount})`}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <div
                  className={`status-indicator ${status === "online" ? "status-online" : status === "away" ? "status-away" : "status-offline"
                    }`}
                ></div>
                {translateRole(role)}
              </div>
            </div>
          </div>
        </div>
      </DropdownMenuTrigger>
      {canChangeStatus && (
        <DropdownMenuContent side="left" align="center">
          <DropdownMenuItem onClick={() => onStatusChange(userId, "online")}>
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${getStatusColor("online")}`} />
              Çevrimiçi
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange(userId, "away")}>
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${getStatusColor("away")}`} />
              Molada
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onStatusChange(userId, "offline")}>
            <span className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${getStatusColor("offline")}`} />
              Çevrimdışı
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}