'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  BookOpen, 
  MessageSquare, 
  Columns, 
  FileText, 
  Settings as SettingsIcon, 
  LogOut, 
  User, 
  Layers 
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Researcher');
  const [userEmail, setUserEmail] = useState('researcher@mind.com');

  useEffect(() => {
    // Read user from localStorage if logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUserName(u.full_name || 'Researcher');
        setUserEmail(u.email || '');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: Layers },
    { name: 'Workspace', path: '/workspace', icon: BookOpen },
    { name: 'Compare', path: '/compare', icon: Columns },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-screen shrink-0">
      {/* Brand Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-slate-900">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white leading-none">ResearchMind</h1>
          <span className="text-xs text-indigo-400 font-medium">AI Assistant</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-white font-medium border-l-4 border-indigo-500' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
              }`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User profile footer */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/50">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-semibold shadow-inner">
            {userName[0].toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h4 className="text-sm font-semibold text-slate-200 truncate">{userName}</h4>
            <p className="text-xs text-slate-500 truncate">{userEmail}</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-sm font-medium border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950 hover:bg-rose-950/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
