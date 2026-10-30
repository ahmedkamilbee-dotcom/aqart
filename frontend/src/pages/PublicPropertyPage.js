import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { createPublicPropertyUrl } from '../config/brand';
import { ArrowRight, BedDouble, Building2, Bath, CalendarDays, MapPin, Phone, Ruler, Share2, ShieldCheck, Users } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const statusLabels = { available: 'متاح', sold: 'مباع', rented: 'مؤجر' };
const statusClasses = { available: 'bg-emerald-100 text-emerald-800', sold: 'bg-slate-100 text-slate-700', rented: 'bg-amber-100 text-amber-900' };

function iraqiWhatsAppNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('964')) return digits;
  if (digits.startsWith('0')) return `964${digits.slice(1)}`;
  return digits;
}

export const PublicPropertyPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);

  useEffect(() => {
    let active = true;
    axios.get(`${API}/public/properties/${encodeURIComponent(token)}`)
      .then(({ data }) => { if (active) { setProperty(data); setCurrentImageIdx(0); } })
      .catch((requestError) => {
        if (active) setError(requestError.response?.status === 404 ? 'رابط العقار غير متاح حالياً.' : 'تعذر تحميل معلومات العقار. حاول مرة ثانية.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!property) return undefined;
    const oldTitle = document.title;
    const title = `${[property.governorate, property.district].filter(Boolean).join(' · ') || 'عقار'} | عقاراتي`;
    document.title = title;
    const description = document.querySelector('meta[name="description"]');
    const oldDescription = description?.content;
    if (description) description.content = `عرض عقاري في ${[property.governorate, property.district].filter(Boolean).join('، ')}. السعر ${Number(property.price).toLocaleString('ar-IQ')} دينار عراقي.`;
    return () => {
      document.title = oldTitle;
      if (description && oldDescription) description.content = oldDescription;
    };
  }, [property]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(createPublicPropertyUrl(token));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (copyError) {
      setCopied(false);
    }
  };

  if (loading) return <main className="public-property-page flex min-h-screen items-center justify-center px-4" dir="rtl"><p role="status" className="rounded-2xl bg-white px-6 py-5 font-bold text-[#41544a] shadow">جارٍ تحميل العقار...</p></main>;

  if (error || !property) return (
    <main className="public-property-page flex min-h-screen items-center justify-center px-4" dir="rtl">
      <section className="max-w-lg rounded-3xl border border-[#E1E8E3] bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#F1F5F2] text-[#176B4D]"><Building2 size={28} /></div>
        <h1 className="text-2xl font-black text-[#14271E]">العقار غير متاح</h1><p className="mt-2 font-semibold text-[#64736B]">{error || 'يمكن أن يكون صاحب العقار أوقف رابط المشاركة.'}</p>
        <Link to="/" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#176B4D] px-5 font-black text-white"><ArrowRight size={18} /> الصفحة الرئيسية</Link>
      </section>
    </main>
  );

  const location = [property.governorate, property.district].filter(Boolean).join(' · ');
  const whatsapp = property.contact_phone ? `https://wa.me/${iraqiWhatsAppNumber(property.contact_phone)}?text=${encodeURIComponent('السلام عليكم، مهتم بالعقار المعروض في ' + (location || 'رابط عقاراتي'))}` : '';

  return (
    <main className="public-property-page min-h-screen px-4 py-5 sm:px-6 sm:py-9" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <header className="public-property-actions mb-5 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 font-black text-[#176B4D]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#176B4D] text-white"><Building2 size={21} /></span> عقاراتي</Link>
          <button onClick={() => navigate(-1)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D8E2DB] bg-white px-3 text-sm font-bold text-[#41544a]"><ArrowRight size={17} /> رجوع</button>
        </header>

        <article className="public-property-print overflow-hidden rounded-3xl border border-[#E1E8E3] bg-white shadow-[0_24px_70px_rgba(20,39,30,.09)]">
          {property.images?.length ? (
            <div className="public-property-gallery">
              <img src={`${process.env.REACT_APP_BACKEND_URL}${property.images[currentImageIdx]}`} alt={`صورة عقار ${location}`} className="h-full w-full object-cover" />
              <span className={`absolute right-5 top-5 rounded-full px-4 py-2 text-sm font-black ${statusClasses[property.status] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[property.status] || 'عقار'}</span>
            </div>
          ) : (
            <div className="public-property-gallery public-property-gallery-empty"><Building2 size={72} strokeWidth={1.2} /><span className={`absolute right-5 top-5 rounded-full px-4 py-2 text-sm font-black ${statusClasses[property.status] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[property.status] || 'عقار'}</span></div>
          )}
          {property.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto border-b border-[#E8EEE9] p-3" aria-label="صور العقار">
              {property.images.map((image, index) => (
                <button key={image} onClick={() => setCurrentImageIdx(index)} aria-label={`عرض الصورة ${index + 1}`} aria-pressed={currentImageIdx === index} className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${currentImageIdx === index ? 'border-[#176B4D]' : 'border-transparent'}`}>
                  <img src={`${process.env.REACT_APP_BACKEND_URL}${image}`} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-8 p-5 sm:p-8 md:grid-cols-[1fr_260px] md:p-10">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#176B4D]"><ShieldCheck size={15} /> عرض عقاري عبر عقاراتي</span>
              <h1 className="mt-3 text-2xl font-black leading-tight text-[#14271E] sm:text-4xl">{location || 'تفاصيل العقار'}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#64736B]"><MapPin size={17} /> {location || 'الموقع غير محدد'}</p>
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-[#F5F7F5] p-4"><span className="flex items-center gap-2 text-xs font-bold text-[#64736B]"><Ruler size={15} /> المساحة</span><strong className="mt-2 block text-lg font-black text-[#14271E]">{Number(property.total_area).toLocaleString('ar-IQ')} م²</strong></div>
                <div className="rounded-2xl bg-[#F5F7F5] p-4"><span className="flex items-center gap-2 text-xs font-bold text-[#64736B]"><BedDouble size={15} /> غرف النوم</span><strong className="mt-2 block text-lg font-black text-[#14271E]">{Number(property.bedrooms).toLocaleString('ar-IQ')}</strong></div>
                <div className="rounded-2xl bg-[#F5F7F5] p-4"><span className="flex items-center gap-2 text-xs font-bold text-[#64736B]"><Bath size={15} /> الحمامات</span><strong className="mt-2 block text-lg font-black text-[#14271E]">{Number(property.bathrooms).toLocaleString('ar-IQ')}</strong></div>
                <div className="rounded-2xl bg-[#F5F7F5] p-4"><span className="flex items-center gap-2 text-xs font-bold text-[#64736B]"><CalendarDays size={15} /> الواجهة</span><strong className="mt-2 block text-lg font-black text-[#14271E]">{Number(property.front_width).toLocaleString('ar-IQ')} م</strong></div>
              </div>
              <div className="mt-7 flex items-center gap-3 border-t border-[#E8EEE9] pt-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4ED] text-[#176B4D]"><Users size={19} /></span><div><p className="text-xs font-bold text-[#64736B]">الوكيل المسؤول</p><p className="font-black text-[#14271E]">{property.agent_name || 'فريق عقاراتي'}</p></div></div>
            </div>
            <aside className="flex flex-col rounded-2xl border border-[#E1E8E3] bg-[#FBFCFB] p-5 md:self-start">
              <span className="text-xs font-bold text-[#64736B]">السعر المطلوب</span><strong className="mt-2 text-2xl font-black text-[#176B4D]">{Number(property.price).toLocaleString('ar-IQ')} <small className="text-sm">د.ع</small></strong>
              <span className={`mt-4 inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-black ${statusClasses[property.status] || 'bg-slate-100 text-slate-700'}`}>{statusLabels[property.status] || 'عقار'}</span>
              <div className="public-property-actions mt-5 grid gap-2">
                {property.contact_phone ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#176B4D] px-4 text-sm font-black text-white"><Phone size={17} /> تواصل عبر واتساب</a> : <p className="rounded-xl bg-[#F1F5F2] p-3 text-xs leading-6 text-[#53655b]">للاستفسار، تواصل مع الشخص الذي أرسل لك هذا الرابط.</p>}
                <button onClick={copyLink} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D8E2DB] bg-white px-4 text-sm font-bold text-[#41544a]"><Share2 size={16} /> {copied ? 'تم نسخ الرابط' : 'نسخ رابط العقار'}</button>
                <button onClick={() => window.print()} className="min-h-11 rounded-xl border border-[#D8E2DB] bg-white px-4 text-sm font-bold text-[#41544a]">طباعة تفاصيل العقار</button>
              </div>
            </aside>
          </div>
        </article>
        <footer className="mt-5 text-center text-xs font-semibold text-[#809087]">شارك هذا الرابط للوصول إلى تفاصيل العقار. معلومات المالك غير معروضة.</footer>
      </div>
    </main>
  );
};
