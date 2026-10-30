import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { PROPERTY } from '../constants/testIds';
import { createPublicPropertyUrl } from '../config/brand';
import {
  Building2,
  DollarSign,
  Bed,
  Bath,
  MapPin,
  Ruler,
  Phone,
  User,
  ArrowRight,
  Edit,
  Trash2,
  AlertCircle,
  Users,
  Share2,
  Copy,
  X,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareBusy, setShareBusy] = useState(false);
  const [sharePhoneEnabled, setSharePhoneEnabled] = useState(false);
  const [publicShareUrl, setPublicShareUrl] = useState('');
  const [revokePending, setRevokePending] = useState(false);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await axios.get(`${API}/properties/${id}`, { withCredentials: true });
        setProperty(data);
      } catch (err) {
        setError(err.response?.data?.detail || 'تعذر تحميل تفاصيل العقار');
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/properties/${id}`, { withCredentials: true });
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'تعذر حذف العقار');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const canEditOrDelete =
    user && property && (user.role === 'admin' || user.id === property.agent_id);

  const shareText = property ? [
    '🏠 عرض عقاري من عقاراتي',
    [property.governorate, property.district].filter(Boolean).length
      ? `📍 الموقع: ${[property.governorate, property.district].filter(Boolean).join(' - ')}`
      : null,
    `💰 السعر: ${Number(property.price).toLocaleString('ar-IQ')} د.ع`,
    `📐 المساحة: ${property.total_area} م²`,
    `🛏 الغرف: ${property.bedrooms} | 🚿 الحمامات: ${property.bathrooms}`,
    `📌 الحالة: ${{ available: 'متاح', sold: 'مباع', rented: 'مؤجر' }[property.status] || 'غير محددة'}`,
    'للاستفسار، أرسل رسالة إلى المعلن.',
  ].filter(Boolean).join('\n') : '';

  const shareOnWhatsApp = () => {
    if (!shareText) return;
    const text = publicShareUrl ? `${shareText}\n🔗 تفاصيل العقار: ${publicShareUrl}` : shareText;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopyMessage('تم نسخ بطاقة العقار. يمكنك لصقها في المحادثة.');
    } catch (copyError) {
      setCopyMessage('تعذر النسخ من المتصفح. استخدم زر المشاركة عبر واتساب.');
    }
  };

  const openShareModal = () => {
    setShareOpen(true);
    setCopyMessage('');
    setShareError('');
    setSharePhoneEnabled(property?.public_contact_enabled === true);
    setPublicShareUrl(property?.public_share_token ? createPublicPropertyUrl(property.public_share_token) : '');
    setRevokePending(false);
  };

  const createPublicShare = async () => {
    setShareBusy(true);
    setShareError('');
    try {
      const { data } = await axios.post(
        `${API}/properties/${id}/public-share`,
        { include_agent_phone: sharePhoneEnabled },
        { withCredentials: true }
      );
      const url = createPublicPropertyUrl(data.token);
      setPublicShareUrl(url);
      setProperty((current) => ({ ...current, public_share_token: data.token, public_contact_enabled: data.contact_phone_enabled }));
      setCopyMessage('صار رابط العقار جاهزاً للمشاركة.');
    } catch (requestError) {
      setShareError(requestError.response?.data?.detail || 'تعذر تجهيز رابط المشاركة. حاول مرة ثانية.');
    } finally {
      setShareBusy(false);
    }
  };

  const copyPublicShare = async () => {
    if (!publicShareUrl) return;
    try {
      await navigator.clipboard.writeText(publicShareUrl);
      setCopyMessage('تم نسخ رابط العقار.');
    } catch (copyError) {
      setCopyMessage('انسخ الرابط من الحقل الظاهر.');
    }
  };

  const revokePublicShare = async () => {
    setShareBusy(true);
    setShareError('');
    try {
      await axios.delete(`${API}/properties/${id}/public-share`, { withCredentials: true });
      setPublicShareUrl('');
      setProperty((current) => ({ ...current, public_share_token: null, public_contact_enabled: false }));
      setSharePhoneEnabled(false);
      setCopyMessage('تم إيقاف الرابط العام.');
      setRevokePending(false);
    } catch (requestError) {
      setShareError(requestError.response?.data?.detail || 'تعذر إيقاف الرابط. حاول مرة ثانية.');
    } finally {
      setShareBusy(false);
    }
  };

  const statusLabel = {
    available: 'متاح',
    sold: 'مباع',
    rented: 'مؤجر',
  };
  const statusColor = {
    available: 'bg-green-100 text-green-800',
    sold: 'bg-red-100 text-red-800',
    rented: 'bg-yellow-100 text-yellow-800',
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-28 md:pb-8 bg-[#F9F6F0] flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-20 h-20 border-8 border-[#1A5632] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-3xl font-bold text-[#2B4736]">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen pb-28 md:pb-8 bg-[#F9F6F0] p-4 sm:p-8" dir="rtl">
        <div className="max-w-2xl mx-auto bg-white border-2 border-red-300 rounded-3xl p-12 text-center">
          <AlertCircle className="w-24 h-24 text-red-500 mx-auto mb-6" />
          <p className="text-3xl font-extrabold text-red-700 mb-6">
            {error || 'العقار غير موجود'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="min-h-[64px] px-8 bg-[#1A5632] text-white rounded-2xl text-xl font-black hover:bg-[#0F3820]"
          >
            العودة للوحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-28 md:pb-8 bg-[#F9F6F0] p-4 sm:p-8"
      dir="rtl"
      data-testid="property-details-page"
    >
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-6 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <button
            data-testid="property-back-button"
            onClick={() => navigate('/dashboard')}
            className="min-h-[64px] px-8 bg-transparent border-4 border-[#1A5632] text-[#1A5632] rounded-2xl flex items-center gap-3 hover:bg-[#1A5632] hover:text-white transition-colors text-xl font-black"
          >
            <ArrowRight className="w-8 h-8" />
            عودة
          </button>
          {canEditOrDelete && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openShareModal}
                className="min-h-[64px] px-5 bg-white border-2 border-[#D2CFC9] text-[#1A5632] rounded-2xl flex items-center gap-2 hover:bg-[#F9F6F0] transition-colors text-base font-black"
              >
                <Share2 className="w-6 h-6" />
                مشاركة العقار
              </button>
              <button
                onClick={() => navigate('/leads', { state: { propertyId: property.id } })}
                className="min-h-[64px] px-6 bg-[#1A5632] text-white rounded-2xl flex items-center gap-3 hover:bg-[#0F3820] transition-colors text-lg font-black"
              >
                <Users className="w-7 h-7" />
                إضافة عميل مهتم
              </button>
              <button
                data-testid={PROPERTY.editButton}
                onClick={() => navigate(`/edit-property/${id}`)}
                className="min-h-[64px] px-8 bg-[#D95D39] text-white rounded-2xl flex items-center gap-3 hover:bg-[#B84A2A] transition-colors text-xl font-black"
              >
                <Edit className="w-8 h-8" />
                تعديل
              </button>
              <button
                data-testid={PROPERTY.deleteButton}
                onClick={() => setShowDeleteConfirm(true)}
                className="min-h-[64px] px-8 bg-red-600 text-white rounded-2xl flex items-center gap-3 hover:bg-red-700 transition-colors text-xl font-black"
              >
                <Trash2 className="w-8 h-8" />
                حذف
              </button>
            </div>
          )}
        </div>

        {/* Images Gallery */}
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl overflow-hidden mb-6">
          {property.images && property.images.length > 0 ? (
            <>
              <img
                src={property.images[currentImageIdx]}
                alt="عقار"
                className="w-full h-96 object-cover"
                data-testid="property-main-image"
              />
              {property.images.length > 1 && (
                <div className="p-4 flex gap-3 overflow-x-auto">
                  {property.images.map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`صورة ${idx + 1}`}
                      onClick={() => setCurrentImageIdx(idx)}
                      className={`w-24 h-24 object-cover rounded-xl cursor-pointer flex-shrink-0 border-4 ${
                        currentImageIdx === idx ? 'border-[#1A5632]' : 'border-transparent'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-96 bg-[#F9F6F0] flex items-center justify-center">
              <Building2 className="w-32 h-32 text-[#6B7A70]" />
            </div>
          )}
        </div>

        {/* Main Info */}
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-8 mb-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-12 h-12 text-[#1A5632]" />
              <span
                className="text-5xl font-black text-[#0A1F13]"
                data-testid="property-detail-price"
              >
                {property.price.toLocaleString('ar-IQ')} د.ع
              </span>
            </div>
            <span
              className={`inline-block px-6 py-3 rounded-2xl text-2xl font-extrabold ${statusColor[property.status]}`}
              data-testid="property-detail-status"
            >
              {statusLabel[property.status]}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">المحافظة</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-governorate"
              >
                {property.governorate || 'غير محدد'}
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">القضاء</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-district"
              >
                {property.district || 'غير محدد'}
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <MapPin className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">المساحة الكلية</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-total-area"
              >
                {property.total_area} متر مربع
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <Ruler className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">مساحة الواجهة</span>
              </div>
              <p className="text-3xl font-black text-[#0A1F13]">{property.front_width} متر</p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <Ruler className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">الطول</span>
              </div>
              <p className="text-3xl font-black text-[#0A1F13]">{property.length} متر</p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <Bed className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">عدد الغرف</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-bedrooms"
              >
                {property.bedrooms}
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <Bath className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">عدد الحمامات</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-bathrooms"
              >
                {property.bathrooms}
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <User className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">اسم مالك العقار</span>
              </div>
              <p
                className="text-3xl font-black text-[#0A1F13]"
                data-testid="property-detail-owner-name"
              >
                {property.owner_name || 'غير محدد'}
              </p>
            </div>

            <div className="bg-[#F9F6F0] rounded-2xl p-6 border-2 border-[#D2CFC9]">
              <div className="flex items-center gap-3 mb-2">
                <Phone className="w-10 h-10 text-[#1A5632]" />
                <span className="text-2xl font-bold text-[#2B4736]">رقم المالك</span>
              </div>
              <a
                href={`tel:${property.owner_phone}`}
                className="text-3xl font-black text-[#1A5632] hover:underline"
                data-testid="property-detail-owner-phone"
                dir="ltr"
              >
                {property.owner_phone}
              </a>
            </div>
          </div>
        </div>

        {/* Agent Info */}
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-8">
          <div className="flex items-center gap-4">
            <User className="w-16 h-16 text-[#1A5632]" />
            <div>
              <p className="text-xl font-bold text-[#6B7A70] mb-1">مُدخل العقار</p>
              <p
                className="text-3xl font-extrabold text-[#0A1F13]"
                data-testid="property-detail-agent-name"
              >
                {property.agent_name}
              </p>
            </div>
          </div>
        </div>

        {shareOpen && (
          <div className="print-share-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="share-card-title" className="print-share-card w-full max-w-lg rounded-t-3xl border border-[#D2CFC9] bg-white p-6 shadow-2xl sm:rounded-3xl">
              <div className="no-print mb-5 flex items-start justify-between gap-4">
                <div><h2 id="share-card-title" className="text-2xl font-black text-[#0A1F13]">بطاقة العقار</h2><p className="mt-1 text-sm font-semibold text-[#6B7A70]">راجع المعلومات قبل مشاركتها</p></div>
                <button onClick={() => setShareOpen(false)} aria-label="إغلاق" className="rounded-xl p-2 text-[#2B4736] hover:bg-[#F9F6F0]"><X className="h-5 w-5" /></button>
              </div>
              <div className="rounded-2xl border border-[#D2CFC9] bg-[#F9F6F0] p-5">
                {property.images?.[0] && <img src={property.images[0]} alt="صورة العقار" className="mb-4 h-44 w-full rounded-xl object-cover" />}
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#1A5632]">عقاراتي · عرض عقاري</p>
                <h3 className="mb-3 text-xl font-black text-[#0A1F13]">{[property.governorate, property.district].filter(Boolean).join(' · ') || 'عقار مميز'}</h3>
                <p className="mb-4 text-2xl font-black text-[#1A5632]">{Number(property.price).toLocaleString('ar-IQ')} د.ع</p>
                <div className="grid grid-cols-3 gap-2 text-center text-sm font-bold text-[#2B4736]"><span className="rounded-lg bg-white p-2">{property.total_area} م²</span><span className="rounded-lg bg-white p-2">{property.bedrooms} غرف</span><span className="rounded-lg bg-white p-2">{property.bathrooms} حمامات</span></div>
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-white p-3 text-sm font-medium leading-6 text-[#41544a]">{shareText}</p>
              <div className="no-print mt-4 rounded-xl border border-[#E1E8E3] bg-white p-4">
                <h3 className="font-black text-[#14271E]">رابط يفتحه الزبون مباشرة</h3>
                <p className="mt-1 text-xs leading-5 text-[#64736B]">معلومات المالك ورقمه ما تظهر في الصفحة العامة.</p>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-bold text-[#41544a]">
                  <input type="checkbox" checked={sharePhoneEnabled} onChange={(event) => setSharePhoneEnabled(event.target.checked)} disabled={shareBusy} className="mt-1 h-4 w-4 accent-[#176B4D]" />
                  إظهار رقم هاتفي للزبائن في صفحة العقار
                </label>
                <button onClick={createPublicShare} disabled={shareBusy} className="mt-3 min-h-11 w-full rounded-xl bg-[#176B4D] px-4 text-sm font-black text-white disabled:opacity-60">
                  {shareBusy ? 'جارٍ تجهيز الرابط...' : publicShareUrl ? 'تحديث إعدادات الرابط' : 'إنشاء رابط عام'}
                </button>
                {publicShareUrl && <div className="mt-3 flex flex-wrap gap-2"><input aria-label="رابط العقار العام" readOnly value={publicShareUrl} className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#D8E2DB] bg-[#F5F7F5] px-3 text-xs text-[#41544a]" dir="ltr" /><button onClick={copyPublicShare} className="min-h-10 rounded-lg border border-[#D8E2DB] px-3 text-xs font-black text-[#176B4D]">نسخ الرابط</button></div>}
                {publicShareUrl && !revokePending && <button onClick={() => setRevokePending(true)} disabled={shareBusy} className="mt-3 text-xs font-bold text-red-700">إيقاف الرابط العام</button>}
                {revokePending && <div className="mt-3 rounded-lg bg-red-50 p-3"><p className="text-xs font-bold text-red-800">راح يتوقف الرابط الحالي. تريد تكمل؟</p><div className="mt-2 flex gap-2"><button onClick={revokePublicShare} disabled={shareBusy} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white">إيقاف الرابط</button><button onClick={() => setRevokePending(false)} className="rounded-lg border border-[#D8E2DB] px-3 py-2 text-xs font-bold">إلغاء</button></div></div>}
              </div>
              {shareError && <p role="alert" className="no-print mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{shareError}</p>}
              {copyMessage && <p role="status" className="no-print mt-3 text-sm font-bold text-[#1A5632]">{copyMessage}</p>}
              <div className="no-print mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button onClick={shareOnWhatsApp} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1A5632] px-4 font-black text-white"><Share2 className="h-5 w-5" /> مشاركة عبر واتساب</button>
                <button onClick={copyShareText} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 font-black text-[#2B4736]"><Copy className="h-5 w-5" /> نسخ النص</button>
                <button onClick={() => window.print()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 font-black text-[#2B4736]">حفظ البطاقة PDF</button>
              </div>
            </section>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full border-4 border-red-300">
              <div className="text-center mb-6">
                <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
                <h3 className="text-3xl font-extrabold text-[#0A1F13] mb-3">تأكيد الحذف</h3>
                <p className="text-xl font-bold text-[#2B4736]">
                  هل أنت متأكد من حذف هذا العقار؟ لا يمكن التراجع.
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  data-testid="property-delete-cancel"
                  className="flex-1 min-h-[64px] bg-transparent border-4 border-[#1A5632] text-[#1A5632] rounded-2xl text-xl font-black hover:bg-[#1A5632] hover:text-white transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  data-testid="property-delete-confirm"
                  className="flex-1 min-h-[64px] bg-red-600 text-white rounded-2xl text-xl font-black hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
