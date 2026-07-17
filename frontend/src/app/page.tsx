'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 animate-spin border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="text-sm font-medium">Redirecting to workspace...</p>
      </div>
    </div>
  );
}
