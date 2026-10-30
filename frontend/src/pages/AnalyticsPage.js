import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Activity, ArrowRight, Building2, CalendarClock, BarChart3, CheckCircle, RefreshCw, Target, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STAGES = [
  { key: 'new', label: 'جديد', color: 'bg-blue-500' },
  { key: 'contacted', label: 'تم التواصل', color: 'bg-indigo-500' },
  { key: 'visit_scheduled', label: 'معاينة مجدولة', color: 'bg-amber-500' },
  { key: 'negotiating', label: 'قيد التفاوض', color: 'bg-purple-500' },
  { key: 'won', label: 'صفقة ناجحة', color: 'bg-emerald-600' },
  { key: 'lost', label: 'لم تتم الصفقة', color: 'bg-slate-400' },
];

export const AnalyticsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/analytics/overview`, { withCredentials: true })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.detail || 'تعذر تحميل ملخص الأداء. حاول مجدداً.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const properties = data?.properties || { total: 0, available: 0, sold: 0, rented: 0 };
  const leads = data?.leads || { total: 0, open: 0, follow_up_due: 0, won: 0, lost: 0, conversion_rate: 0, by_status: {} };
  const monthlyWins = data?.monthly_wins || [];
  const maxWins = Math.max(1, ...monthlyWins.map((month) => month.value));
  const summary = [
    { title: 'إجمالي العقارات', value: properties.total, detail: `${properties.available} عقار متاح`, icon: Building2, theme: 'bg-emerald-50 text-emerald-800' },
    { title: 'العملاء المحتملون', value: leads.total, detail: `${leads.open} قيد المتابعة`, icon: Users, theme: 'bg-blue-50 text-blue-800' },
    { title: 'نسبة إغلاق الصفقات', value: `${leads.conversion_rate}%`, detail: `${leads.won} صفقة ناجحة من الصفقات المغلقة`, icon: Target, theme: 'bg-purple-50 text-purple-800' },
    { title: 'متابعات مستحقة', value: leads.follow_up_due, detail: 'تحتاج إلى إجراء', icon: CalendarClock, theme: 'bg-amber-50 text-amber-900' },
  ];

  return (
    <div className="min-h-screen bg-[#F9F6F0] px-4 py-5 pb-28 sm:p-8 md:pb-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#D2CFC9] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4"><div className="rounded-2xl bg-green-50 p-3 text-[#1A5632]"><BarChart3 className="h-9 w-9" /></div><div><h1 className="text-3xl font-black text-[#0A1F13] sm:text-4xl">ملخص الأداء</h1><p className="mt-1 font-bold text-[#6B7A70]">صورة واضحة عن العقارات والعملاء والصفقات</p></div></div>
          <div className="flex items-center gap-2"><button onClick={() => navigate('/dashboard')} className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 font-extrabold text-[#2B4736]"><ArrowRight className="h-5 w-5" /> العقارات</button><button onClick={() => setRefreshKey((value) => value + 1)} aria-label="تحديث الأداء" className="rounded-xl border-2 border-[#D2CFC9] p-3 text-[#2B4736]"><RefreshCw className="h-5 w-5" /></button></div>
        </header>
        {user?.role === 'admin' && <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">الملخص يشمل بيانات جميع الوكلاء.</p>}
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</p>}
        {loading ? <div role="status" className="rounded-3xl border-2 border-[#D2CFC9] bg-white p-12 text-center font-bold text-[#2B4736]">جارٍ تجهيز ملخص الأداء...</div> : data && (
          <>
            <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="مؤشرات الأداء">
              {summary.map(({ title, value, detail, icon: Icon, theme }) => <article key={title} className="rounded-2xl border-2 border-[#D2CFC9] bg-white p-5 shadow-sm"><div className={`mb-4 inline-flex rounded-xl p-3 ${theme}`}><Icon className="h-6 w-6" /></div><p className="text-sm font-bold text-[#6B7A70]">{title}</p><p className="my-1 text-3xl font-black text-[#0A1F13]">{Number.isFinite(value) ? value.toLocaleString('ar-IQ') : value}</p><p className="text-sm font-semibold text-[#6B7A70]">{detail}</p></article>)}
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border-2 border-[#D2CFC9] bg-white p-5 sm:p-6">
                <header className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-green-50 p-2 text-[#1A5632]"><Building2 className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0A1F13]">حالة العقارات</h2><p className="text-sm font-semibold text-[#6B7A70]">توزيع محفظة العقارات المسجلة</p></div></header>
                <div className="grid grid-cols-3 gap-3">{[
                  { label: 'متاحة', count: properties.available, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'مباعة', count: properties.sold, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'مؤجرة', count: properties.rented, color: 'text-amber-800', bg: 'bg-amber-50' },
                ].map((item) => <div key={item.label} className={`rounded-xl p-4 text-center ${item.bg}`}><p className={`text-2xl font-black ${item.color}`}>{item.count.toLocaleString('ar-IQ')}</p><p className="mt-1 text-sm font-bold text-[#41544a]">{item.label}</p></div>)}</div>
                <button onClick={() => navigate('/dashboard')} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#1A5632]">عرض العقارات <ArrowRight className="h-4 w-4" /></button>
              </section>

              <section className="rounded-2xl border-2 border-[#D2CFC9] bg-white p-5 sm:p-6">
                <header className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2 text-blue-800"><Activity className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0A1F13]">مراحل العملاء</h2><p className="text-sm font-semibold text-[#6B7A70]">حركة الاستفسارات في مسار العمل</p></div></header>
                <div className="space-y-3">{STAGES.map((stage) => { const count = leads.by_status?.[stage.key] || 0; const percent = leads.total ? Math.max(count ? 4 : 0, count * 100 / leads.total) : 0; return <div key={stage.key}><div className="mb-1 flex justify-between text-sm"><span className="font-bold text-[#41544a]">{stage.label}</span><span className="font-black text-[#0A1F13]">{count.toLocaleString('ar-IQ')}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#F1F5F2]"><div className={`h-full rounded-full ${stage.color}`} style={{ width: `${percent}%` }} role="progressbar" aria-valuenow={count} aria-valuemin={0} aria-valuemax={leads.total} aria-label={stage.label} /></div></div>; })}</div>
                <button onClick={() => navigate('/leads')} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#1A5632]">إدارة العملاء <Users className="h-4 w-4" /></button>
              </section>

              <section className="rounded-2xl border-2 border-[#D2CFC9] bg-white p-5 sm:col-span-2 sm:p-6">
                <header className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-purple-50 p-2 text-purple-800"><CheckCircle className="h-5 w-5" /></div><div><h2 className="text-xl font-black text-[#0A1F13]">الصفقات الناجحة خلال آخر 6 أشهر</h2><p className="text-sm font-semibold text-[#6B7A70]">تُحتسب الصفقة عند تحويل حالة العميل إلى «صفقة ناجحة»</p></div></header>
                <div className="flex h-48 items-end justify-around gap-3 border-b border-[#D2CFC9] px-2">
                  {monthlyWins.map((month) => <div key={month.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"><span className="text-sm font-black text-[#2B4736]">{month.value.toLocaleString('ar-IQ')}</span><div className="w-full max-w-16 rounded-t-xl bg-[#1A5632] transition-all" style={{ height: `${month.value ? Math.max(10, month.value * 100 / maxWins) : 3}%` }} title={`${month.label}: ${month.value}`} /><span className="mb-2 text-center text-xs font-bold text-[#6B7A70]">{month.label}</span></div>)}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
