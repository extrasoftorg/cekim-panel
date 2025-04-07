import { cookies } from 'next/headers';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  return (
    <div>
      <h1>Ana Sayfa</h1>
      {token ? (
        <p>Oturum açıldı Token: {token}</p>
      ) : (
        <p>Oturum açılmamış</p>
      )}
    </div>
  );
}