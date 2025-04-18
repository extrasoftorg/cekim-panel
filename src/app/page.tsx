import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border">
          <h2 className="text-lg font-semibold mb-2">İstatistikler</h2>
          <p>Dashboard içeriği burada yer alacak...</p>
        </div>
        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border">
          <h2 className="text-lg font-semibold mb-2">Özet</h2>
          <p>Dashboard içeriği burada yer alacak...</p>
        </div>
        <div className="bg-card text-card-foreground p-6 rounded-lg border border-border">
          <h2 className="text-lg font-semibold mb-2">Grafikler</h2>
          <p>Dashboard içeriği burada yer alacak...</p>
        </div>
      </div>
    </div>
  );
}