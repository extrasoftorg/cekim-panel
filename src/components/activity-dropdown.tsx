'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
      return 'bg-green-500';
    case 'away':
      return 'bg-yellow-500';
    case 'offline':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

const translateRole = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Yönetici';
    case 'cekimSorumlusu':
      return 'Çekim Sorumlusu';
    case 'cekimPersoneli':
      return 'Çekim Personeli';
    case 'spectator':
      return 'İzleyici';
    default:
      return 'Bilinmeyen Rol';
  }
};

export default function ActivityDropdown() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['activityStatus'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Durum alınamadı');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      return {
        id: result.id,
        status: result.status,
        username: result.username,
        role: result.role,
      };
    },
    initialData: { id: '', status: 'offline', username: 'Bilinmiyor', role: 'Bilinmeyen' },
  });


  const mutation = useMutation({
    mutationFn: async (status: 'online' | 'away' | 'offline') => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: data.id, status }),
      });
      if (!response.ok) {
        throw new Error('Durum güncellenemedi');
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['activityStatus'] });
      toast.success("İşlem Başarılı", {
        description: result.message,
      });
    },
    onError: (error: Error) => {
      toast.error("İşlem Başarısız", {
        description: error.message,
      });
    },
  });

  const handleStatusChange = (status: 'online' | 'away' | 'offline') => {
    if (!data.id) {
      toast.error("Hata", {
        description: "Kullanıcı ID'si alınamadı. Lütfen sayfayı yenileyin.",
      });
      return;
    }
    mutation.mutate(status);
  };

  if (isLoading) {
    return <div>Yükleniyor...</div>;
  }

  return (
    <div className="w-full flex items-center justify-end gap-4">
      <div className="flex items-center gap-2">
        <span className="font-medium leading-none">{`${data.username} - ${translateRole(data.role)}`}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 mr-5">
              <span className={`w-3 h-3 rounded-full ${getStatusColor(data.status)}`} />
              <span>{data.status === "online" ? "Çevrimiçi" : data.status === "away" ? "Molada" : "Çevrimdışı"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="start">
            <DropdownMenuItem onClick={() => handleStatusChange("online")}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                Çevrimiçi
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("away")}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                Molada
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("offline")}>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gray-500" />
                Çevrimdışı
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}