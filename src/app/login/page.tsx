'use client';

import { useState } from 'react';
import { login } from './actions';

export default function LoginPage() {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        const [message, setMessage] = useState('');

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            const response = await login(username, password);
            setMessage(response.message)
            if (response.success) {
                console.log('Doğrulanan kullanıcı:', response.user);

                // otp emaile gönderme kısmı olacak

              }
        }

   
    return (
        <div>
        <h1>Giriş Yap</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Kullanıcı Adı"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            required
          />
          <button type="submit">Giriş Yap</button>
        </form>
        {message && <p>{message}</p>}
      </div>
    )
  }