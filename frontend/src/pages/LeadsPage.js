import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CalendarDays,
  BarChart3,
  CheckCircle,
  CircleAlert,
  Clock3,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = [
  { value: 'new', label: 'جديد', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'تم التواصل', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'visit_scheduled', label: 'معاينة مجدولة', color: 'bg-amber-100 text-amber-900' },
  { value: 'negotiating', label: 'قيد التفاوض', color: 'bg-purple-100 text-purple-800' },
  { value: 'won', label: 'صفقة ناجحة', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'لم تتم الصفقة', color: 'bg-slate-100 text-slate-700' },
];
const SOURCES = [
  { value: 'manual', label: 'إدخال من الوكيل' },
  { value: 'phone', label: 'اتصال هاتفي' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'website', label: 'الموقع' },
  { value: 'referral', label: 'إحالة' },
];
const EMPTY_FORM = {
  customer_name: '', phone: '', email: '', property_id: '', status: 'new',
  source: 'manual', notes: '', follow_up_at: '',
};
const inputClass = 'w-full min-h-[48px] rounded-xl border-2 border-[#D2CFC9] bg-white px-4 py-3 text-base font-semibold text-[#0A1F13] outline-none transition focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/15';

const localDateValue = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const formatDate = (iso) => {
  if (!iso) return 'غير محدد';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'غير محدد'
    : date.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
};

const statusInfo = (value) => STATUSES.find((item) => item.value === value) || STATUSES[0];

const toWhatsAppNumber = (phone) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) return `964${digits.slice(1)}`;
  if (digits.startsWith('964')) return digits;
  return digits;
};

export const LeadsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, open: 0, follow_up_due: 0, won: 0 });
  const [properties, setProperties] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [pendingDeleteLead, setPendingDeleteLead] = useState(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const propertyById = useMemo(
    () => Object.fromEntries(properties.map((property) => [property.id, property])),
    [properties]
  );

  useEffect(() => {
    let active = true;
    axios.get(`${API}/subscriptions/status`, { withCredentials: true })
      .then(({ data }) => { if (active) setSubscription(data); })
      .catch(() => { if (active) setSubscription({ has_active: false, status: 'unknown' }); });
    return () => { active = false; };
  }, []);

  const canManageLeads = user?.role === 'admin' || subscription?.has_active === true;

  useEffect(() => {
    let active = true;
    axios.get(`${API}/properties?limit=200`, { withCredentials: true })
      .then(({ data }) => { if (active) setProperties(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setProperties([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ skip: '0', limit: '50' });
        if (query.trim()) params.set('q', query.trim());
        if (statusFilter) params.set('status', statusFilter);
        const [leadResult, statsResult] = await Promise.all([
          axios.get(`${API}/leads?${params.toString()}`, { withCredentials: true }),
          axios.get(`${API}/leads/stats`, { withCredentials: true }),
        ]);
        if (!active) return;
        setItems(leadResult.data.items || []);
        setTotal(leadResult.data.total || 0);
        setStats(statsResult.data || { total: 0, open: 0, follow_up_due: 0, won: 0 });
      } catch (requestError) {
        if (active) {
          setError(requestError.response?.data?.detail || 'تعذر تحميل سجل العملاء. حاول مجدداً.');
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, statusFilter, refreshKey]);

  const openNewLead = () => {
    const propertyId = location.state?.propertyId || '';
    setEditingLead(null);
    setForm({ ...EMPTY_FORM, property_id: propertyId });
    setFormError('');
    setModalOpen(true);
    if (propertyId) navigate(location.pathname, { replace: true, state: null });
  };

  const openEditLead = (lead) => {
    setEditingLead(lead);
    setForm({
      customer_name: lead.customer_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      property_id: lead.property_id || '',
      status: lead.status || 'new',
      source: lead.source || 'manual',
      notes: lead.notes || '',
      follow_up_at: localDateValue(lead.follow_up_at),
    });
    setFormError('');
    setModalOpen(true);
  };

  useEffect(() => {
    const leadId = location.state?.leadId;
    if (!leadId) return undefined;
    let active = true;
    axios.get(`${API}/leads/${leadId}`, { withCredentials: true })
      .then(({ data }) => {
        if (active) openEditLead(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.detail || 'تعذر فتح سجل العميل.');
      })
      .finally(() => {
        if (active) navigate(location.pathname, { replace: true, state: null });
      });
    return () => { active = false; };
  }, [location.state, location.pathname, navigate]);

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingLead(null);
    setFormError('');
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const saveLead = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const payload = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      property_id: form.property_id || null,
      status: form.status,
      source: form.source,
      notes: form.notes.trim() || null,
      follow_up_at: form.follow_up_at ? new Date(form.follow_up_at).toISOString() : null,
    };
    try {
      if (editingLead) {
        await axios.patch(`${API}/leads/${editingLead.id}`, payload, { withCredentials: true });
      } else {
        await axios.post(`${API}/leads`, payload, { withCredentials: true });
      }
      setModalOpen(false);
      setEditingLead(null);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setFormError(requestError.response?.data?.detail || 'تعذر حفظ بيانات العميل. تحقق من الحقول وحاول مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (lead, nextStatus) => {
    if (nextStatus === lead.status) return;
    setBusyId(lead.id);
    setError('');
    try {
      await axios.patch(`${API}/leads/${lead.id}`, { status: nextStatus }, { withCredentials: true });
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'تعذر تحديث مرحلة التواصل.');
    } finally {
      setBusyId('');
    }
  };

  const deleteLead = async (lead) => {
    setBusyId(lead.id);
    setError('');
    try {
      await axios.delete(`${API}/leads/${lead.id}`, { withCredentials: true });
      setPendingDeleteLead(null);
      setRefreshKey((value) => value + 1);
    } catch (requestError) {
      setPendingDeleteLead(null);
      setError(requestError.response?.data?.detail || 'تعذر حذف سجل العميل. حاول مجدداً.');
    } finally {
      setBusyId('');
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ skip: String(items.length), limit: '50' });
      if (query.trim()) params.set('q', query.trim());
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await axios.get(`${API}/leads?${params.toString()}`, { withCredentials: true });
      setItems((current) => [...current, ...(data.items || [])]);
      setTotal(data.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'تعذر تحميل بقية السجلات. حاول مجدداً.');
    } finally {
      setLoadingMore(false);
    }
  };

  const statCards = [
    { label: 'كل العملاء', value: stats.total || 0, icon: Users, color: 'text-[#1A5632]', bg: 'bg-green-50' },
    { label: 'قيد المتابعة', value: stats.open || 0, icon: Clock3, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'متابعة مستحقة', value: stats.follow_up_due || 0, icon: CircleAlert, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'صفقات ناجحة', value: stats.won || 0, icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="min-h-screen bg-[#F9F6F0] px-4 py-5 pb-28 sm:p-8 md:pb-8" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <SubscriptionBanner />
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#D2CFC9] bg-white p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-green-50 p-3 text-[#1A5632]"><Users className="h-9 w-9" /></div>
            <div>
              <h1 className="text-3xl font-black text-[#0A1F13] sm:text-4xl">سجل العملاء</h1>
              <p className="mt-1 text-base font-bold text-[#6B7A70]">تابع المهتمين ومواعيد التواصل من مكان واحد</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <button onClick={() => navigate('/dashboard')} className="min-h-12 rounded-xl border-2 border-[#D2CFC9] px-3 font-extrabold text-[#2B4736] hover:bg-[#F9F6F0]" aria-label="العودة للعقارات"><ArrowRight className="h-5 w-5" /></button>
            <button onClick={() => navigate('/calendar')} className="inline-flex min-h-12 items-center gap-1 rounded-xl border-2 border-[#D2CFC9] px-3 text-sm font-extrabold text-[#2B4736] hover:bg-[#F9F6F0]"><CalendarDays className="h-5 w-5" /> المواعيد</button>
            <button onClick={() => navigate('/analytics')} className="inline-flex min-h-12 items-center gap-1 rounded-xl border-2 border-[#D2CFC9] px-3 text-sm font-extrabold text-[#2B4736] hover:bg-[#F9F6F0]"><BarChart3 className="h-5 w-5" /> الأداء</button>
            <button onClick={() => setRefreshKey((value) => value + 1)} className="min-h-12 rounded-xl border-2 border-[#D2CFC9] px-3 font-extrabold text-[#2B4736] hover:bg-[#F9F6F0]" aria-label="تحديث البيانات"><RefreshCw className="h-5 w-5" /></button>
            <button onClick={openNewLead} disabled={!canManageLeads} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1A5632] px-4 font-black text-white hover:bg-[#0F3820] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"><Plus className="h-5 w-5" /> تسجيل عميل</button>
          </div>
        </header>

        {user?.role === 'admin' && <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-900">أنت تشاهد سجلات العملاء من جميع الوكلاء. بيانات كل سجل تبقى مرتبطة بالوكيل المسؤول عنه.</p>}
        {!canManageLeads && subscription?.has_active === false && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950"><span>انتهى الاشتراك. يمكنك مشاهدة السجلات، لكن الإضافة والتعديل يتطلبان اشتراكاً فعالاً.</span><button onClick={() => navigate('/subscriptions')} className="rounded-lg bg-[#D95D39] px-4 py-2 font-black text-white">عرض الاشتراكات</button></div>}

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="ملخص العملاء">
          {statCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border-2 border-[#D2CFC9] bg-white p-4 sm:p-5">
              <div className={`mb-3 inline-flex rounded-xl p-2 ${bg} ${color}`}><Icon className="h-6 w-6" /></div>
              <p className="text-3xl font-black text-[#0A1F13]">{value.toLocaleString('ar-IQ')}</p>
              <p className="mt-1 text-sm font-bold text-[#6B7A70]">{label}</p>
            </div>
          ))}
        </section>

        <section className="mb-5 grid gap-3 rounded-2xl border-2 border-[#D2CFC9] bg-white p-4 sm:grid-cols-[1fr_260px]">
          <label className="relative block">
            <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7A70]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pr-12`} placeholder="ابحث بالاسم أو الهاتف أو الملاحظات" aria-label="البحث في العملاء" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass} aria-label="تصفية حسب المرحلة">
            <option value="">كل المراحل</option>
            {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>
        </section>

        {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 font-bold text-red-800"><span>{error}</span><button onClick={() => setError('')} aria-label="إخفاء التنبيه"><X className="h-5 w-5" /></button></div>}

        {loading ? (
          <div className="rounded-3xl border-2 border-[#D2CFC9] bg-white py-16 text-center text-xl font-bold text-[#2B4736]" role="status">جارٍ تحميل سجل العملاء...</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#BFC8C1] bg-white px-6 py-14 text-center">
            <Users className="mx-auto mb-4 h-14 w-14 text-[#6B7A70]" />
            <h2 className="text-2xl font-black text-[#0A1F13]">{query || statusFilter ? 'لا توجد نتائج مطابقة' : 'ابدأ بتسجيل أول عميل مهتم'}</h2>
            <p className="mx-auto mb-5 mt-2 max-w-xl font-semibold text-[#6B7A70]">سجّل بيانات المهتمين، وحدد مرحلة التواصل وموعد المتابعة حتى لا يفوتك أي استفسار.</p>
            {!query && !statusFilter && <button onClick={openNewLead} disabled={!canManageLeads} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1A5632] px-5 font-black text-white disabled:opacity-50"><Plus className="h-5 w-5" /> تسجيل عميل</button>}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((lead) => {
              const stage = statusInfo(lead.status);
              const property = propertyById[lead.property_id];
              const overdue = lead.follow_up_at && new Date(lead.follow_up_at) <= new Date() && !['won', 'lost'].includes(lead.status);
              const waNumber = toWhatsAppNumber(lead.phone);
              return (
                <article key={lead.id} className={`rounded-2xl border-2 bg-white p-4 shadow-sm sm:p-5 ${overdue ? 'border-amber-300' : 'border-[#D2CFC9]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-black text-[#0A1F13] sm:text-2xl">{lead.customer_name}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-black ${stage.color}`}>{stage.label}</span>
                        {overdue && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">موعد متابعة مستحق</span>}
                      </div>
                      {user?.role === 'admin' && <p className="mb-2 text-sm font-bold text-[#6B7A70]">الوكيل: {lead.agent_name || 'غير معروف'}</p>}
                      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-[#2B4736]">
                        <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-2 hover:text-[#1A5632]"><Phone className="h-4 w-4" />{lead.phone}</a>
                        {lead.email && <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 hover:text-[#1A5632]"><Mail className="h-4 w-4" />{lead.email}</a>}
                        {property && <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{[property.governorate, property.district].filter(Boolean).join(' - ') || `${property.total_area} م²`}</span>}
                        {lead.follow_up_at && <span className={`inline-flex items-center gap-2 ${overdue ? 'font-black text-amber-800' : ''}`}><CalendarClock className="h-4 w-4" />{formatDate(lead.follow_up_at)}</span>}
                      </div>
                      {lead.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F9F6F0] p-3 text-sm font-medium leading-6 text-[#2B4736]">{lead.notes}</p>}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                      <select value={lead.status} disabled={busyId === lead.id || !canManageLeads} onChange={(event) => changeStatus(lead, event.target.value)} className="min-h-10 flex-1 rounded-lg border border-[#D2CFC9] bg-white px-3 text-sm font-bold text-[#2B4736] sm:flex-none" aria-label={`تغيير مرحلة ${lead.customer_name}`}>
                        {STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-100 px-3 text-sm font-black text-green-900 hover:bg-green-200" aria-label={`مراسلة ${lead.customer_name} على واتساب`}>واتساب</a>
                      <button onClick={() => openEditLead(lead)} disabled={!canManageLeads} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#D2CFC9] px-3 text-sm font-bold text-[#2B4736] hover:bg-[#F9F6F0]"><Pencil className="h-4 w-4" /> تعديل</button>
                      <button onClick={() => setPendingDeleteLead(lead)} disabled={busyId === lead.id || !canManageLeads} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`حذف ${lead.customer_name}`}><Trash2 className="h-4 w-4" /> حذف</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && items.length < total && <div className="py-6 text-center"><button onClick={loadMore} disabled={loadingMore} className="min-h-12 rounded-xl border-2 border-[#1A5632] bg-white px-6 font-black text-[#1A5632] disabled:opacity-50">{loadingMore ? 'جارٍ التحميل...' : `تحميل المزيد (${(total - items.length).toLocaleString('ar-IQ')} متبقٍ)`}</button></div>}
        </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="lead-modal-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><h2 id="lead-modal-title" className="text-2xl font-black text-[#0A1F13]">{editingLead ? 'تعديل بيانات العميل' : 'تسجيل عميل مهتم'}</h2><p className="mt-1 text-sm font-semibold text-[#6B7A70]">بيانات التواصل تبقى خاصة بالوكيل المسؤول</p></div>
              <button onClick={closeModal} disabled={saving} className="rounded-xl p-2 text-[#2B4736] hover:bg-[#F9F6F0]" aria-label="إغلاق"><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={saveLead} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">اسم العميل <span className="text-red-600">*</span><input required minLength={2} maxLength={120} value={form.customer_name} onChange={updateField('customer_name')} className={inputClass} autoFocus /></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">رقم الهاتف <span className="text-red-600">*</span><input required minLength={7} maxLength={24} value={form.phone} onChange={updateField('phone')} className={inputClass} inputMode="tel" placeholder="07xxxxxxxxx" /></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">البريد الإلكتروني<input type="email" maxLength={254} value={form.email} onChange={updateField('email')} className={inputClass} dir="ltr" /></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">العقار المهتم به<select value={form.property_id} onChange={updateField('property_id')} className={inputClass}><option value="">بدون عقار محدد</option>{properties.map((property) => <option key={property.id} value={property.id}>{[property.governorate, property.district].filter(Boolean).join(' - ') || 'عقار'} · {Number(property.price).toLocaleString('ar-IQ')} د.ع</option>)}</select></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">مرحلة التواصل<select value={form.status} onChange={updateField('status')} className={inputClass}>{STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736]">مصدر الاستفسار<select value={form.source} onChange={updateField('source')} className={inputClass}>{SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736] sm:col-span-2">موعد المتابعة<input type="datetime-local" value={form.follow_up_at} onChange={updateField('follow_up_at')} className={inputClass} /></label>
                <label className="space-y-1 text-sm font-extrabold text-[#2B4736] sm:col-span-2">ملاحظات<textarea maxLength={2500} rows={4} value={form.notes} onChange={updateField('notes')} className={`${inputClass} min-h-28 resize-y`} placeholder="المتطلبات، الميزانية، ملاحظات المعاينة..." /></label>
              </div>
              {formError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{formError}</p>}
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeModal} disabled={saving} className="min-h-12 rounded-xl border-2 border-[#D2CFC9] px-5 font-bold text-[#2B4736]">إلغاء</button>
                <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-[#1A5632] px-6 font-black text-white disabled:opacity-60">{saving ? 'جارٍ الحفظ...' : editingLead ? 'حفظ التعديلات' : 'حفظ العميل'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteLead)}
        title="حذف سجل العميل"
        description={pendingDeleteLead ? `راح ينحذف سجل ${pendingDeleteLead.customer_name} وملاحظاته ومواعيد متابعته.` : ''}
        confirmLabel="حذف السجل"
        busy={Boolean(pendingDeleteLead && busyId === pendingDeleteLead.id)}
        onCancel={() => setPendingDeleteLead(null)}
        onConfirm={() => pendingDeleteLead && deleteLead(pendingDeleteLead)}
      />
    </div>
  );
};
