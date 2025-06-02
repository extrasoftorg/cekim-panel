"use client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@/components/ui/button";
import { Plus, Eye, EyeOff, Edit, Trash2, Check, X } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { register, updateUser, deleteUser } from "@/app/users/actions";

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

const registerFormSchema = z.object({
    username: z.string().min(3, "Kullanıcı adı en az 3 karakter olmalı"),
    email: z.string().email("Geçerli bir e-posta adresi girin"),
    role: z.enum(["admin", "cekimSorumlusu", "cekimPersoneli", "spectator"], {
        message: "Lütfen bir rol seçin",
    }),
    password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

type RegisterFormData = z.infer<typeof registerFormSchema>;

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

const fetchAllUsers = async () => {
    const [onlineUsers, offlineUsers, awayUsers] = await Promise.all([
        fetchUsersByStatus("online"),
        fetchUsersByStatus("offline"),
        fetchUsersByStatus("away"),
    ]);
    return [...onlineUsers, ...offlineUsers, ...awayUsers];
}

const fetchCurrentUser = async () => {
    const response = await fetch("/api/current-user", { credentials: "include" })
    if (!response.ok) {
        throw new Error(`Kullanıcı bilgisi alınamadı: ${response.status}`)
    }
    const result = await response.json()
    return result.data
}

function PersonelCard({
    name,
    role,
    status,
    userId,
    currentUser,
    onClick,
    canEdit,
}: {
    name: string
    role: string
    status: "online" | "away" | "offline"
    userId: string
    currentUser: CurrentUser
    onClick: () => void
    canEdit: boolean
}) {
    return (
        <div
            className={`personel-card p-2 border border-[color:var(--border)] rounded-md bg-[color:var(--card)] shadow-sm ${canEdit ? "cursor-pointer hover:bg-[color:var(--hover)] group" : ""} relative`}
            onClick={canEdit ? onClick : undefined}
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
                <div className="flex-1">
                    <div className="font-medium text-[color:var(--primary)] text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <div
                            className={`status-indicator ${status === "online" ? "status-online" : status === "away" ? "status-away" : "status-offline"}`}
                        ></div>
                        {translateRole(role)}
                    </div>
                </div>
                {canEdit && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            <path d="M9 18l6-6-6-6"></path>
                        </svg>
                    </div>
                )}
            </div>
        </div>
    )
}

// Ana sayfa bileşeni
export default function UsersPage() {
    const queryClient = useQueryClient();
    const { data: currentUser, isLoading: currentUserLoading, error: currentUserError } = useQuery<CurrentUser>({
        queryKey: ["currentUser"],
        queryFn: fetchCurrentUser,
    })

    const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
        queryKey: ["users"],
        queryFn: fetchAllUsers,
        refetchInterval: 10000,
        enabled: true,
    })

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [originalUser, setOriginalUser] = useState<User | null>(null); // Orijinal kullanıcıyı saklamak için
    const [isEditingUsername, setIsEditingUsername] = useState(false);
    const [isEditingRole, setIsEditingRole] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const {
        register: formRegister,
        handleSubmit,
        formState: { errors },
        reset,
        setValue,
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerFormSchema),
        defaultValues: {
            username: "",
            email: "",
            role: "cekimPersoneli",
            password: "",
        },
    });

    const onSubmit = async (data: RegisterFormData) => {
        const formData = new FormData();
        formData.append("username", data.username);
        formData.append("email", data.email);
        formData.append("role", data.role);
        formData.append("password", data.password);

        const result = await register(formData);

        if (result.success) {
            toast.success("Başarılı", { description: result.message });
            setIsDialogOpen(false);
            reset();
            queryClient.invalidateQueries({ queryKey: ["users"] });
        } else {
            toast.error("Hata", { description: result.message || "Kullanıcı kaydedilemedi" });
        }
    };

    if (currentUserLoading || usersLoading) {
        return (
            <div>
                Yükleniyor...
                <div className="text-sm text-gray-500 mt-2">
                    {currentUserLoading && <div>Kullanıcı bilgileri yükleniyor...</div>}
                    {usersLoading && <div>Personeller yükleniyor...</div>}
                </div>
            </div>
        )
    }

    if (currentUserError) {
        return <div className="text-red-500">Hata: {currentUserError.message}</div>
    }
    if (!currentUser) {
        return <div className="text-red-500">Hata: Kullanıcı bilgisi alınamadı</div>
    }
    if (usersError) {
        return <div className="text-red-500">Hata: Personeller alınamadı: {usersError.message}</div>
    }

    const groupedUsers = groupUsersByRole(users);
    const isAdmin = currentUser.role.toLowerCase() === "admin";
    const canEditUsers = currentUser.role.toLowerCase() === "admin" || currentUser.role.toLowerCase() === "cekimsorumlusu";
    const availableRoles = isAdmin
        ? ["admin", "cekimSorumlusu", "cekimPersoneli", "spectator"]
        : ["cekimSorumlusu", "cekimPersoneli", "spectator"];

    const openUserModal = (user: User) => {
        if (!canEditUsers) return;
        setSelectedUser(user);
        setOriginalUser(user); 
        setIsEditingUsername(false);
        setIsEditingRole(false);
        setIsDeleteModalOpen(false);
    };

    const canEditSpecificUser = (targetUser: User) => {
        const currentUserRole = currentUser.role.toLowerCase();
        const targetUserRole = targetUser.role.toLowerCase();

        if (!canEditUsers) return false;

        if (currentUserRole === "cekimsorumlusu" && (targetUserRole === "admin" || targetUserRole === "cekimsorumlusu")) {
            return false;
        }

        return true;
    };

    const handleUsernameEdit = () => {
        setIsEditingUsername(true);
    };

    const handleRoleEdit = () => {
        setIsEditingRole(true);
    };

    const handleSave = async () => {
        if (!selectedUser) return;

        const formData = new FormData();
        formData.append("id", selectedUser.id);
        formData.append("username", selectedUser.username);
        formData.append("role", selectedUser.role);

        const result = await updateUser(formData);

        if (result.success) {
            toast.success("Başarılı", { description: result.message });
            setIsEditingUsername(false);
            setIsEditingRole(false);
            setOriginalUser(selectedUser);
            queryClient.invalidateQueries({ queryKey: ["users"] });
        } else {
            toast.error("Hata", { description: result.message || "Kullanıcı güncellenemedi" });
        }
    };

    const handleCancel = () => {
        if (originalUser) {
            setSelectedUser(originalUser);
        }
        setIsEditingUsername(false);
        setIsEditingRole(false);
    };

    const handleDeleteConfirm = async () => {
        if (!selectedUser) return;

        const formData = new FormData();
        formData.append("id", selectedUser.id);

        const result = await deleteUser(formData);

        if (result.success) {
            toast.success("Başarılı", { description: result.message });
            setIsDeleteModalOpen(false);
            setSelectedUser(null);
            setOriginalUser(null);
            queryClient.invalidateQueries({ queryKey: ["users"] });
        } else {
            toast.error("Hata", { description: result.message || "Kullanıcı silinemedi" });
        }
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-3">
                <h1 className="text-2xl font-bold text-primary mb-3">Personeller</h1>
                {(currentUser.role.toLowerCase() === "admin" || currentUser.role.toLowerCase() === "cekimsorumlusu") && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Plus className="w-4 h-4 mr-0" />
                                Yeni Personel Ekle
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="mb-4">Yeni Personel Ekle</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                <div>
                                    <Label htmlFor="username" className="mb-1.5">Kullanıcı Adı</Label>
                                    <Input
                                        id="username"
                                        {...formRegister("username")}
                                        placeholder="Kullanıcı adı girin"
                                    />
                                    {errors.username && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {errors.username.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="email" className="mb-1.5">E-posta</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        {...formRegister("email")}
                                        placeholder="E-posta adresi girin"
                                    />
                                    {errors.email && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {errors.email.message}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="role" className="mb-1.5">Rol</Label>
                                    <Select
                                        onValueChange={(value) =>
                                            setValue(
                                                "role",
                                                value as
                                                | "admin"
                                                | "cekimSorumlusu"
                                                | "cekimPersoneli"
                                                | "spectator"
                                            )
                                        }
                                        defaultValue="cekimPersoneli"
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Rol seçin" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableRoles.map((role) => (
                                                <SelectItem key={role} value={role}>
                                                    {translateRole(role)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.role && (
                                        <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="password" className="mb-1.5">Şifre</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            {...formRegister("password")}
                                            placeholder="Şifre girin"
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-primary"
                                            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="text-red-500 text-sm mt-1">
                                            {errors.password.message}
                                        </p>
                                    )}
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsDialogOpen(false)}
                                    >
                                        İptal
                                    </Button>
                                    <Button type="submit">Kaydet</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="glass-effect h-auto p-0">
                <div className="space-y-6">
                    {groupedUsers.length > 0 ? (
                        groupedUsers.map((group) => (
                            <div key={group.role}>
                                <h2 className="text-lg font-semibold text-[color:var(--primary)] mb-3">
                                    {translateRole(group.role)}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-6">
                                    {group.users.map((user: User) => (
                                        <PersonelCard
                                            key={user.id}
                                            name={user.username}
                                            role={user.role}
                                            status={user.activityStatus.toLowerCase() as "online" | "offline" | "away"}
                                            userId={user.id}
                                            currentUser={currentUser}
                                            onClick={() => openUserModal(user)}
                                            canEdit={canEditSpecificUser(user)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground py-4">Personel bulunmamaktadır.</p>
                    )}
                </div>
            </div>

            {selectedUser && (
                <Dialog open={!!selectedUser} onOpenChange={() => {
                    setSelectedUser(null);
                    setOriginalUser(null);
                }}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="mb-4">Kullanıcı Bilgileri</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="mb-1.5">Kullanıcı Adı</Label>
                                    {isEditingUsername ? (
                                        <Input
                                            value={selectedUser.username}
                                            onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
                                        />
                                    ) : (
                                        <p>{selectedUser.username}</p>
                                    )}
                                </div>
                                {isEditingUsername ? (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleSave}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={handleCancel}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" variant="outline" onClick={handleUsernameEdit}>
                                        Düzenle
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label className="mb-1.5">Rol</Label>
                                    {isEditingRole ? (
                                        <Select
                                            onValueChange={(value) => setSelectedUser({ ...selectedUser, role: value })}
                                            defaultValue={selectedUser.role}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Rol seçin" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableRoles.map((role) => (
                                                    <SelectItem key={role} value={role}>
                                                        {translateRole(role)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p>{translateRole(selectedUser.role)}</p>
                                    )}
                                </div>
                                {isEditingRole ? (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={handleSave}>
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={handleCancel}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button size="sm" variant="outline" onClick={handleRoleEdit}>
                                        Düzenle
                                    </Button>
                                )}
                            </div>
                            <Button className="mt-6" variant="destructive" onClick={() => setIsDeleteModalOpen(true)}>
                                Personeli Sil
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {isDeleteModalOpen && (
                <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Personeli Sil</DialogTitle>
                        </DialogHeader>
                        <p>{selectedUser?.username} adlı personeli silmek istediğinize emin misiniz?</p>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                                İptal
                            </Button>
                            <Button variant="destructive" onClick={handleDeleteConfirm}>
                                Sil
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    )
}