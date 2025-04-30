// frontend/src/components/DevLogin.js
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DevLogin() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    try {
        const formData = new FormData();
        formData.append('email', email);
    
        const res = await fetch('/api/auth/dev-login', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (res.ok) {
          window.dispatchEvent(new Event('navbarRefetch')); // Update Navbar
          router.push('/dashboard');
        } else {
          const data = await res.json();
          alert(data.detail);
        }
      } catch (error) {
        console.error('Error logging in:', error);
        alert('Failed to log in');
      }
    };
    
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mt-8">
      <h2 className="text-xl font-semibold mb-4">Development Login</h2>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter test user email"
        className="border border-gray-300 rounded-md w-full p-2 mb-4"
      />
      <button
        onClick={handleLogin}
        className="bg-primary text-white py-2 px-4 rounded-md hover:bg-secondary transition"
      >
        Log In
      </button>
    </div>
  );
}