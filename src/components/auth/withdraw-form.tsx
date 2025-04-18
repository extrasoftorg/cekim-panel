"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { updateWithdrawalStatus } from "@/app/withdraw/actions"

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
}

interface CurrentUser {
  id: string
  role: string
  username: string
}

const fetchCurrentUser = async () => {
  const response = await fetch("/api/current-user", { credentials: "include" })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Kullanıcı bilgisi alınamadı: ${response.status} ${errorText}`)
  }
  const result = await response.json()
  return result.data
}

const fetchWithdrawals = async () => {
  const response = await fetch("/api/withdrawals?status=pending", { credentials: "include" })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Veri çekme hatası: ${response.status} ${errorText}`)
  }
  return await response.json()
}

const fetchUsersByStatus = async (status: "online" | "offline" | "away") => {
  const response = await fetch(`/api/users?status=${status}`, { credentials: "include" })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Kullanıcılar alınamadı: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(result.message || "API başarısız")
  }
  return result.data ?? []
}

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

  const handleTransfer = async (withdrawalId: number, newHandlerId: string) => {
    if (!currentUser) {
      toast("Hata", { description: "Kullanıcı bilgisi alınamadı" })
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
        toast("İşlem başarılı", { description: result.message })
      } else {
        toast("İşlem başarısız", { description: result.message })
      }
    } catch {
      toast("İşlem başarısız", { description: "Bir hata oluştu" })
    }
  }

  const handleAction = async (id: number, action: "approve" | "reject") => {
    const result = await updateWithdrawalStatus({ id, action })
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: ["pendingWithdrawals"] })
      toast("İşlem başarılı", { description: result.message })
    } else {
      toast("İşlem başarısız", {
        description: typeof result.error === "string" ? result.error : "Bir hata oluştu",
      })
    }
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
        toast("İşlem başarılı", { description: result.message })
      } else {
        toast("İşlem başarısız", { description: result.message || "Durum güncellenemedi" })
      }
    } catch (error) {
      console.error('handleStatusChange: Durum güncelleme hatası:', error);
      toast("İşlem başarısız", { description: "Bir hata oluştu, lütfen tekrar deneyin" })
    }
  }

  if (currentUserLoading || withdrawalsLoading || onlineUsersLoading || offlineUsersLoading || awayUsersLoading) {
    return (
      <div>
        Yükleniyor...
        <div className="text-sm text-gray-500 mt-2">
          {currentUserLoading && <div>Kullanıcı bilgileri yükleniyor...</div>}
          {withdrawalsLoading && <div>Çekim talepleri yükleniyor...</div>}
          {onlineUsersLoading && <div>Çevrimiçi kullanıcılar yükleniyor...</div>}
          {offlineUsersLoading && <div>Çevrimdışı kullanıcılar yükleniyor...</div>}
          {awayUsersLoading && <div>Molada olan kullanıcılar yükleniyor...</div>}
        </div>
      </div>
    )
  }

  if (currentUserError) return <div className="text-red-500">Hata: {currentUserError.message}</div>
  if (!currentUser) return <div className="text-red-500">Hata: Kullanıcı bilgisi alınamadı</div>
  if (withdrawalsError) return <div className="text-red-500">Hata: Çekim talepleri alınamadı: {withdrawalsError.message}</div>
  if (onlineUsersError) return <div className="text-red-500">Hata: Çevrimiçi kullanıcılar alınamadı: {onlineUsersError.message}</div>
  if (offlineUsersError) return <div className="text-red-500">Hata: Çevrimdışı kullanıcılar alınamadı: {offlineUsersError.message}</div>
  if (awayUsersError) return <div className="text-red-500">Hata: Molada olan kullanıcılar alınamadı: {awayUsersError.message}</div>

  const sortedWithdrawals = [...withdrawals].sort((a, b) => {
    const isCekimPersoneli = currentUser.role.toLowerCase() === "cekimpersoneli"
    if (isCekimPersoneli) {
      if (a.handlingBy === currentUser.id && b.handlingBy !== currentUser.id) return -1
      if (a.handlingBy !== currentUser.id && b.handlingBy === currentUser.id) return 1
    }
    if (a.handlingBy === null && b.handlingBy !== null) return 1
    if (a.handlingBy !== null && b.handlingBy === null) return -1
    return 0
  })

  const onlineGrouped = groupUsersByRole(onlineUsers)
  const offlineGrouped = groupUsersByRole(offlineUsers)
  const awayGrouped = groupUsersByRole(awayUsers)

  return (
    <div className="grid grid-cols-[1fr_250px]">
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
                  const requestedAtStr = new Date(withdrawal.requestedAt).toLocaleString();
                  const [requestedDate, requestedTime] = requestedAtStr.split(" ");

                  return (
                    <TableRow key={withdrawal.id}>
                      <TableCell className="table-cell">{withdrawal.playerUsername}</TableCell>
                      <TableCell className="table-cell">{withdrawal.playerFullname}</TableCell>
                      <TableCell className="table-cell">
                        <div className="inline-flex gap-2 justify-center">
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
                                        {user.username} ({user.role})
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
                          <Button size="sm" className="compact-btn" variant="gray">
                            Detay
                          </Button>
                          {currentUser.id !== withdrawal.handlingBy && withdrawal.handlingBy && (
                            <Button size="sm" className="compact-btn" variant="lightBlue">
                              {withdrawal.handlerUsername}
                            </Button>
                          )}
                          {(currentUser.role.toLowerCase() === "cekimpersoneli" ||
                            currentUser.role.toLowerCase() === "admin" ||
                            currentUser.role.toLowerCase() === "cekimsorumlusu") &&
                            currentUser.id === withdrawal.handlingBy && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" className="compact-btn" variant="green">
                                    İşlem
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="center">
                                  <DropdownMenuItem onClick={() => handleAction(withdrawal.id, "approve")}>
                                    Onayla
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction(withdrawal.id, "reject")}>
                                    Reddet
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className="table-cell">
                        <Button size="sm" className="compact-btn">
                          Görüntüle
                        </Button>
                      </TableCell>
                      <TableCell className="table-cell table-note">{withdrawal.note}</TableCell>
                      <TableCell className="table-cell whitespace-pre-line">
                        {`${requestedDate}\n${requestedTime}`}
                      </TableCell>
                      <TableCell className="table-cell">{withdrawal.transactionId}</TableCell>
                      <TableCell className="table-cell">{withdrawal.method}</TableCell>
                      <TableCell className="table-cell">{withdrawal.amount} TL</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="glass-effect h-auto ml-2 p-2">
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

          <TabsContent value="online" className="mt-0">
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

          <TabsContent value="away" className="mt-0">
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

          <TabsContent value="offline" className="mt-0">
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
    </div>
  )
}

function PersonelCard({
  name,
  role,
  status,
  userId,
  currentUser,
  onStatusChange,
}: {
  name: string
  role: string
  status: "online" | "away" | "offline"
  userId: string
  currentUser: CurrentUser
  onStatusChange: (userId: string, newStatus: "online" | "away" | "offline") => Promise<void>
}) {
  const canChangeStatus = currentUser.role.toLowerCase() === "admin" || currentUser.role.toLowerCase() === "cekimsorumlusu"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canChangeStatus}>
        <div
          className={`personel-card p-2 border border-[color:var(--border)] rounded-md bg-[color:var(--card)] shadow-sm ${canChangeStatus ? "cursor-pointer hover:bg-[color:var(--hover)]" : ""}`}
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
              <div className="font-medium text-[color:var(--primary)] text-sm">{name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <div
                  className={`status-indicator ${status === "online" ? "status-online" : status === "away" ? "status-away" : "status-offline"}`}
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