import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Phone, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUS_LABELS = {
  new: 'جديد', contacted: 'تم التواصل', visit_scheduled: 'معاينة مجدولة',
  negotiating: 'قيد التفاوض', won: 'صفقة ناجحة', lost: 'لم تتم الصفقة',
};

const startOfWeek = (date) => {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return monday;
};
const addDays = (date, amount) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};
const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateLabel = (date, options) => date.toLocaleDateString('ar-IQ', options);
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('ar-IQ', { hour: 'numeric', minute: '2-digit' });

export const CalendarPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [weekDate, setWeekDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const weekStart = useMemo(() => startOfWeek(weekDate), [weekDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  useEffect(() => {
    let active = true;
    const fetchWeek = async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          follow_up_from: weekStart.toISOString(),
          follow_up_to: weekEnd.toISOString(),
          skip: '0',
          limit: '100',
        });
        const { data } = await axios.get(`${API}/leads?${params.toString()}`, { withCredentials: true });
        if (!active) return;
        setAppointments(data.items || []);
        setTotal(data.total || 0);
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.detail || 'تعذر تحميل مواعيد المتابعة. حاول مجدداً.');
          setAppointments([]);
          setTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchWeek();
    return () => { active = false; };
  }, [weekStart, weekEnd, refreshKey]);

  const appointmentsByDay = useMemo(() => {
    const grouped = new Map(days.map((day) => [dayKey(day), []]));
    appointments.forEach((lead) => {
      const date = new Date(lead.follow_up_at);
      const key = dayKey(date);
      if (grouped.has(key)) grouped.get(key).push(lead);
    });
    return grouped;
  }, [appointments, days]);

  const changeWeek = (amount) => setWeekDate((current) => addDays(current, amount * 7));
  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        follow_up_from: weekStart.toISOString(), follow_up_to: weekEnd.toISOString(),
        skip: String(appointments.length), limit: '100',
      });
      const { data } = await axios.get(`${API}/leads?${params.toString()}`, { withCredentials: true });
      setAppointments((current) => [...current, ...(data.items || [])]);
      setTotal(data.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'تعذر تحميل بقية المواعيد.');
    } finally {
      setLoadingMore(false);
    }
  };

  const weekLabel = `${dateLabel(weekStart, { day: 'numeric', month: 'long' })} – ${dateLabel(addDays(weekEnd, -1), { day: 'numeric', month: 'long', year: 'numeric' })}`;

  return (
    <div className="min-h-screen bg-[#F9F6F0] px-4 py-5 pb-28 sm:p-8 md:pb-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#D2CFC9] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-green-50 p-3 text-[#1A5632]"><CalendarDays className="h-9 w-9" /></div>
            <div><h1 className="text-3xl font-black text-[#0A1F13] sm:text-4xl">المواعيد والمتابعات</h1><p className="mt-1 font-bold text-[#6B7A70]">جدول أسبوعي واضح لمواعيد العملاء</p></div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button onClick={() => navigate('/leads')} className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 font-extrabold text-[#2B4736]"><Users className="h-5 w-5" /> العملاء</button>
            <button onClick={() => setRefreshKey((value) => value + 1)} aria-label="تحديث المواعيد" className="rounded-xl border-2 border-[#D2CFC9] p-3 text-[#2B4736]"><RefreshCw className="h-5 w-5" /></button>
            <button onClick={() => navigate('/dashboard')} aria-label="العودة للعقارات" className="rounded-xl bg-[#1A5632] p-3 text-white"><ArrowRight className="h-5 w-5" /></button>
          </div>
        </header>

        <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#D2CFC9] bg-white p-4 sm:p-5">
          <div><h2 className="text-xl font-black text-[#0A1F13]">أجندة الأسبوع</h2><p className="text-sm font-semibold text-[#6B7A70]">{weekLabel}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekDate(new Date())} className="min-h-10 rounded-lg border border-[#D2CFC9] px-4 text-sm font-extrabold text-[#2B4736]">هذا الأسبوع</button>
            <button onClick={() => changeWeek(1)} aria-label="الأسبوع القادم" className="rounded-lg border border-[#D2CFC9] p-2"><ChevronRight className="h-5 w-5" /></button>
            <button onClick={() => changeWeek(-1)} aria-label="الأسبوع السابق" className="rounded-lg border border-[#D2CFC9] p-2"><ChevronLeft className="h-5 w-5" /></button>
          </div>
        </section>

        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}
        {user?.role === 'admin' && <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">المواعيد المعروضة تشمل جميع الوكلاء.</p>}

        {loading ? <div role="status" className="rounded-3xl border-2 border-[#D2CFC9] bg-white p-12 text-center font-bold text-[#2B4736]">جارٍ تحميل المواعيد...</div> : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
            {days.map((day) => {
              const entries = appointmentsByDay.get(dayKey(day)) || [];
              const today = dayKey(day) === dayKey(new Date());
              return (
                <section key={dayKey(day)} className={`min-h-52 rounded-2xl border-2 bg-white p-3 ${today ? 'border-[#1A5632] shadow-md' : 'border-[#D2CFC9]'}`}>
                  <header className="mb-3 flex items-center justify-between border-b border-[#D2CFC9] pb-2">
                    <div><h3 className="font-black text-[#0A1F13]">{dateLabel(day, { weekday: 'long' })}</h3><p className="text-xs font-bold text-[#6B7A70]">{dateLabel(day, { day: 'numeric', month: 'short' })}</p></div>
                    <span className={`rounded-full px-2 py-1 text-xs font-black ${entries.length ? 'bg-green-100 text-green-800' : 'bg-[#F9F6F0] text-[#6B7A70]'}`}>{entries.length}</span>
                  </header>
                  <div className="space-y-2">
                    {entries.map((lead) => {
                      const overdue = new Date(lead.follow_up_at) < new Date() && !['won', 'lost'].includes(lead.status);
                      return (
                        <article key={lead.id} className={`rounded-xl border p-3 ${overdue ? 'border-amber-300 bg-amber-50' : 'border-[#D2CFC9] bg-[#F9F6F0]'}`}>
                          <p className="flex items-center gap-1 text-xs font-black text-[#1A5632]"><Clock3 className="h-3.5 w-3.5" />{timeLabel(lead.follow_up_at)}</p>
                          <h4 className="mt-1 truncate text-sm font-black text-[#0A1F13]">{lead.customer_name}</h4>
                          <p className="mt-1 text-xs font-semibold text-[#6B7A70]">{STATUS_LABELS[lead.status] || 'عميل'}</p>
                          <div className="mt-2 flex items-center justify-between gap-1">
                            <a href={`tel:${lead.phone}`} aria-label={`اتصال بـ ${lead.customer_name}`} className="rounded-lg bg-white p-2 text-[#1A5632]"><Phone className="h-4 w-4" /></a>
                            {user?.role === 'admin' && <span className="truncate text-[11px] font-semibold text-[#6B7A70]">{lead.agent_name}</span>}
                            <button onClick={() => navigate('/leads', { state: { leadId: lead.id } })} className="text-xs font-black text-[#1A5632]">فتح السجل</button>
                          </div>
                        </article>
                      );
                    })}
                    {!entries.length && <p className="py-5 text-center text-xs font-medium text-[#9AA49E]">لا توجد مواعيد</p>}
                  </div>
                </section>
              );
            })}
          </div>
        )}
        {!loading && appointments.length < total && <div className="py-5 text-center"><button onClick={loadMore} disabled={loadingMore} className="min-h-12 rounded-xl border-2 border-[#1A5632] bg-white px-5 font-black text-[#1A5632]">{loadingMore ? 'جارٍ التحميل...' : 'تحميل مواعيد أخرى'}</button></div>}
      </div>
    </div>
  );
};
