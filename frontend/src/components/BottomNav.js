import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CalendarDays, ChevronUp, Home, MoreHorizontal, Plus, Users } from 'lucide-react';

export const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const items = [
    { path: '/dashboard', label: 'العقارات', icon: Home, testid: 'nav-available' },
    { path: '/leads', label: 'العملاء', icon: Users, testid: 'nav-leads' },
    { path: '/calendar', label: 'المواعيد', icon: CalendarDays, testid: 'nav-calendar' },
    { path: '/add-property', label: 'إضافة', icon: Plus, testid: 'nav-add' },
  ];
  const moreItems = [
    { path: '/sold', label: 'العقارات المباعة', testid: 'nav-sold' },
    { path: '/rented', label: 'العقارات المؤجرة', testid: 'nav-rented' },
    { path: '/analytics', label: 'ملخص الأداء', testid: 'nav-analytics' },
    { path: '/subscriptions', label: 'الاشتراكات', testid: 'nav-subscriptions' },
    ...(user?.role === 'admin' ? [{ path: '/admin', label: 'إدارة النظام', testid: 'nav-admin' }] : []),
  ];

  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname.startsWith('/property/') || location.pathname.startsWith('/edit-property/');
    return location.pathname.startsWith(path);
  };
  const moreActive = moreItems.some((item) => isActive(item.path));
  const select = (path) => { navigate(path); setMoreOpen(false); };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden" dir="rtl" data-testid="bottom-nav">
      {moreOpen && <div className="absolute bottom-full left-3 right-3 mb-3 rounded-2xl border border-[#D2CFC9] bg-white p-2 shadow-xl" role="menu">{moreItems.map((item) => <button key={item.path} data-testid={item.testid} role="menuitem" onClick={() => select(item.path)} className={`flex min-h-12 w-full items-center rounded-xl px-4 text-right text-sm font-extrabold ${isActive(item.path) ? 'bg-green-50 text-[#1A5632]' : 'text-[#2B4736] hover:bg-[#F9F6F0]'}`}>{item.label}</button>)}</div>}
      <div className="mx-auto flex max-w-3xl items-stretch justify-around">
        {items.map(({ path, label, icon: Icon, testid }) => {
          const active = isActive(path);
          return <button key={path} data-testid={testid} aria-current={active ? 'page' : undefined} onClick={() => select(path)} className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${active ? 'bg-green-50 text-[#1A5632]' : 'text-[#6B7A70]'}`}><Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} /><span className={`text-[11px] font-extrabold ${active ? 'text-[#1A5632]' : 'text-[#2B4736]'}`}>{label}</span></button>;
        })}
        <button data-testid="nav-more" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)} className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 ${moreActive || moreOpen ? 'bg-green-50 text-[#1A5632]' : 'text-[#6B7A70]'}`}><span className="relative">{moreOpen ? <ChevronUp className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}</span><span className="text-[11px] font-extrabold">المزيد</span></button>
      </div>
    </nav>
  );
};
