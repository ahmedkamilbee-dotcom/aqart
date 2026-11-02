import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { PROPERTY, SEARCH, AUTH } from '../constants/testIds';
import {
  Plus,
  Search,
  Building2,
  DollarSign,
  Bed,
  Bath,
  MapPin,
  LogOut,
  Shield,
  CreditCard,
  CheckCircle,
  Key,
  Home as HomeIcon,
  Menu,
  X,
  User,
  Users,
  CalendarDays,
  BarChart3,
  LogIn,
} from 'lucide-react';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { IraqGovernoratePicker } from '../components/IraqGovernoratePicker';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_CONFIG = {
  available: { label: 'العقارات المتاحة', icon: HomeIcon, color: 'text-green-700', bg: 'bg-green-100' },
  sold: { label: 'العقارات المباعة', icon: CheckCircle, color: 'text-red-700', bg: 'bg-red-100' },
  rented: { label: 'العقارات المؤجرة', icon: Key, color: 'text-yellow-700', bg: 'bg-yellow-100' },
};

export const PropertyListPage = ({ status, testid }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [governorateFilter, setGovernorateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [listError, setListError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setListError('');
      try {
        const params = new URLSearchParams({ status, skip: '0', limit: '30' });
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (governorateFilter.trim()) params.set('governorate', governorateFilter.trim());
        if (districtFilter.trim()) params.set('district', districtFilter.trim());

        let resData = null;
        try {
          const res = await axios.get(`${API}/properties/page?${params.toString()}`, {
            withCredentials: true,
          });
          resData = res.data;
        } catch (pageErr) {
          // محاولة بديلة إذا كان السيرفر يعتمد مسار /properties العام
          if (pageErr.response?.status === 404) {
            const fallbackRes = await axios.get(`${API}/properties?${params.toString()}`, {
              withCredentials: true,
            });
            resData = Array.isArray(fallbackRes.data)
              ? { items: fallbackRes.data, total: fallbackRes.data.length }
              : fallbackRes.data;
          } else {
            throw pageErr;
          }
        }

        if (active) {
          const items = Array.isArray(resData?.items)
            ? resData.items
            : Array.isArray(resData)
            ? resData
            : [];
          setProperties(items);
          setTotal(resData?.total !== undefined ? resData.total : items.length);
        }
      } catch (error) {
        if (active) {
          // إذا كان الزائر غير مسجل أو السيرفر رفض التوثيق، لا نظهر رسالة خطأ مزعجة
          if (error.response?.status === 401 || !user) {
            setProperties([]);
            setTotal(0);
          } else {
            setListError(error.response?.data?.detail || 'تعذر تحميل العقارات. حاول مجدداً.');
            setProperties([]);
            setTotal(0);
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [status, searchQuery, governorateFilter, districtFilter, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const filteredProperties = properties;

  const loadMoreProperties = async () => {
    if (loadingMore || properties.length >= total) return;
    setLoadingMore(true);
    setListError('');
    try {
      const params = new URLSearchParams({ status, skip: String(properties.length), limit: '30' });
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (governorateFilter.trim()) params.set('governorate', governorateFilter.trim());
      if (districtFilter.trim()) params.set('district', districtFilter.trim());

      let resData = null;
      try {
        const res = await axios.get(`${API}/properties/page?${params.toString()}`, { withCredentials: true });
        resData = res.data;
      } catch (err) {
        if (err.response?.status === 404) {
          const fallbackRes = await axios.get(`${API}/properties?${params.toString()}`, { withCredentials: true });
          resData = Array.isArray(fallbackRes.data) ? { items: fallbackRes.data, total: fallbackRes.data.length } : fallbackRes.data;
        } else {
          throw err;
        }
      }

      const newItems = Array.isArray(resData?.items) ? resData.items : Array.isArray(resData) ? resData : [];
      setProperties((current) => [...current, ...newItems]);
      setTotal(resData?.total !== undefined ? resData.total : properties.length + newItems.length);
    } catch (error) {
      if (user) {
        setListError(error.response?.data?.detail || 'تعذر تحميل بقية العقارات. حاول مجدداً.');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const statusLabel = { available: 'متاح', sold: 'مباع', rented: 'مؤجر' };
  const statusColor = {
    available: 'bg-green-100 text-green-800',
    sold: 'bg-red-100 text-red-800',
    rented: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="min-h-screen bg-[#F9F6F0] p-4 sm:p-8 pb-28 md:pb-8" dir="rtl" data-testid={testid}>
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        {user && <SubscriptionBanner />}
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-[#1A5632] flex-shrink-0" />
            <div className="flex-1">
              <h1 className="text-2xl sm:text-4xl font-black text-[#0A1F13]">عقاراتي</h1>
              <p className="text-base sm:text-xl font-bold text-[#2B4736]">
                {user ? `مرحباً ${user.name || ''}` : 'دليلك العقاري في المحافظات العراقية'}
              </p>
            </div>
            {/* أزرار الموبايل */}
            {user ? (
              <button
                data-testid="mobile-menu-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden bg-[#1A5632] text-white p-3 rounded-2xl"
              >
                {menuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
              </button>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="md:hidden bg-[#1A5632] text-white px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> دخول المكاتب
              </button>
            )}
          </div>

          {/* أزرار الشاشات الكبيرة (Desktop Navigation) */}
          <div className="hidden flex-wrap justify-end gap-2 md:flex">
            {user ? (
              <>
                <button
                  onClick={() => navigate('/leads')}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1A5632] px-4 text-base font-black text-white hover:bg-[#0F3820]"
                >
                  <Users className="h-5 w-5" /> العملاء
                </button>
                <button
                  onClick={() => navigate('/calendar')}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 text-base font-black text-[#2B4736] hover:bg-[#F9F6F0]"
                >
                  <CalendarDays className="h-5 w-5" /> المواعيد
                </button>
                <button
                  onClick={() => navigate('/analytics')}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 text-base font-black text-[#2B4736] hover:bg-[#F9F6F0]"
                >
                  <BarChart3 className="h-5 w-5" /> الأداء
                </button>
                <button
                  onClick={() => navigate('/subscriptions')}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#D95D39] px-4 text-base font-black text-white hover:bg-[#B84A2A]"
                >
                  <CreditCard className="h-5 w-5" /> الاشتراكات
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 text-base font-black text-[#2B4736] hover:bg-[#F9F6F0]"
                  >
                    <Shield className="h-5 w-5" /> إدارة النظام
                  </button>
                )}
                <button
                  data-testid={AUTH.logoutButton}
                  onClick={handleLogout}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#D2CFC9] px-4 text-base font-black text-[#2B4736] hover:bg-[#F9F6F0]"
                >
                  <LogOut className="h-5 w-5" /> تسجيل الخروج
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1A5632] px-6 text-lg font-black text-white hover:bg-[#0F3820] shadow-sm"
              >
                <LogIn className="h-5 w-5" /> دخول أصحاب المكاتب
              </button>
            )}
          </div>

          {/* قائمة الموبايل المنسدلة للمسجلين */}
          {menuOpen && user && (
            <div className="w-full space-y-2 border-t border-[#D2CFC9] pt-3 md:hidden">
              {[
                { label: 'استفسارات العملاء', path: '/leads', icon: Users },
                { label: 'المواعيد والمتابعات', path: '/calendar', icon: CalendarDays },
                { label: 'ملخص الأداء', path: '/analytics', icon: BarChart3 },
                { label: 'الاشتراكات', path: '/subscriptions', icon: CreditCard },
                ...(user?.role === 'admin' ? [{ label: 'إدارة النظام', path: '/admin', icon: Shield }] : []),
              ].map(({ label, path, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => {
                    navigate(path);
                    setMenuOpen(false);
                  }}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D2CFC9] bg-white px-5 text-base font-extrabold text-[#2B4736]"
                >
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D2CFC9] px-5 text-base font-extrabold text-[#2B4736]"
              >
                <LogOut className="h-5 w-5" /> تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </div>

      {/* تصنيفات العقارات (المتاحة / المباعة / المؤجرة) */}
      <div className="max-w-7xl mx-auto mb-6 hidden md:block">
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-3 flex gap-2">
          <button
            data-testid="filter-available"
            onClick={() => navigate('/dashboard')}
            className={`flex-1 min-h-[60px] rounded-2xl flex items-center justify-center gap-3 text-xl font-black transition-colors ${
              status === 'available'
                ? 'bg-[#1A5632] text-white'
                : 'bg-transparent text-[#2B4736] hover:bg-[#F9F6F0]'
            }`}
          >
            <HomeIcon className="w-7 h-7" />
            المتاحة
          </button>
          <button
            data-testid="filter-sold"
            onClick={() => navigate('/sold')}
            className={`flex-1 min-h-[60px] rounded-2xl flex items-center justify-center gap-3 text-xl font-black transition-colors ${
              status === 'sold'
                ? 'bg-[#1A5632] text-white'
                : 'bg-transparent text-[#2B4736] hover:bg-[#F9F6F0]'
            }`}
          >
            <CheckCircle className="w-7 h-7" />
            المباعة
          </button>
          <button
            data-testid="filter-rented"
            onClick={() => navigate('/rented')}
            className={`flex-1 min-h-[60px] rounded-2xl flex items-center justify-center gap-3 text-xl font-black transition-colors ${
              status === 'rented'
                ? 'bg-[#1A5632] text-white'
                : 'bg-transparent text-[#2B4736] hover:bg-[#F9F6F0]'
            }`}
          >
            <Key className="w-7 h-7" />
            المؤجرة
          </button>
        </div>
      </div>

      {/* عنوان الصفحة وعدد العقارات */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className={`${config.bg} border-2 border-[#D2CFC9] rounded-3xl p-5 flex items-center gap-4`}>
          <StatusIcon className={`w-12 h-12 ${config.color}`} />
          <h2 className={`text-3xl sm:text-4xl font-black ${config.color}`}>{config.label}</h2>
          <span className="mr-auto text-2xl font-black text-[#2B4736]" aria-live="polite">
            {total.toLocaleString('ar-IQ')}
          </span>
        </div>
      </div>

      {/* شريط البحث وفلترة المحافظات */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Search className="w-8 h-8 sm:w-10 sm:h-10 text-[#2B4736] flex-shrink-0" />
            <input
              data-testid={SEARCH.searchInput}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالسعر أو المساحة أو المحافظة أو القضاء..."
              className="flex-1 min-h-[56px] text-xl sm:text-2xl p-3 sm:p-4 border-2 border-[#D2CFC9] rounded-xl focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
            />
          </div>
          <IraqGovernoratePicker
            value={governorateFilter}
            onChange={setGovernorateFilter}
            resultCount={total}
            loading={loading}
            selectTestId="filter-governorate-input"
          />
          <div className="flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#1A5632] flex-shrink-0" />
            <input
              data-testid="filter-district-input"
              type="text"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              placeholder="القضاء"
              className="flex-1 min-h-[52px] text-lg sm:text-xl p-3 border-2 border-[#D2CFC9] rounded-xl focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
            />
          </div>
        </div>
      </div>

      {/* زر إضافة عقار جديد (يوجه لتسجيل الدخول إذا لم يكن المستخدم مسجلاً) */}
      {status === 'available' && (
        <div className="max-w-7xl mx-auto mb-8">
          <button
            data-testid={PROPERTY.addButton}
            onClick={() => {
              if (user) {
                navigate('/add-property');
              } else {
                navigate('/auth');
              }
            }}
            className="w-full min-h-[72px] bg-[#1A5632] text-white rounded-2xl flex items-center justify-center gap-4 hover:bg-[#0F3820] transition-colors shadow-[0_8px_0_#0F3820] active:translate-y-2 active:shadow-[0_0px_0_#0F3820] text-2xl sm:text-3xl font-black"
          >
            <Plus className="w-10 h-10 sm:w-12 sm:h-12" />
            {user ? 'إضافة عقار جديد' : 'أصحاب المكاتب: أضف عقارك هنا'}
          </button>
        </div>
      )}

      {/* شبكة عرض العقارات */}
      <div className="max-w-7xl mx-auto" data-testid={SEARCH.resultsContainer}>
        {listError && user && (
          <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
            {listError}
          </p>
        )}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-3xl font-bold text-[#2B4736]">جارٍ التحميل...</p>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-12 text-center">
            <Building2 className="w-24 h-24 text-[#6B7A70] mx-auto mb-6" />
            <p className="text-3xl font-bold text-[#2B4736]">لا توجد عقارات في هذه الفئة حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProperties.map((property) => (
              <div
                key={property.id}
                data-testid={PROPERTY.card}
                className="bg-white border-2 border-[#D2CFC9] rounded-3xl overflow-hidden hover:border-[#1A5632] transition-colors cursor-pointer shadow-sm hover:shadow-md"
                onClick={() => navigate(`/property/${property.id}`)}
              >
                {property.images && property.images.length > 0 ? (
                  <img src={property.images[0]} alt="عقار" className="w-full h-56 object-cover" />
                ) : (
                  <div className="w-full h-56 bg-[#F9F6F0] flex items-center justify-center">
                    <Building2 className="w-20 h-20 text-[#6B7A70]" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-8 h-8 text-[#1A5632]" />
                      <span className="text-2xl font-black text-[#0A1F13]">
                        {Number(property.price).toLocaleString('ar-IQ')} د.ع
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-6 h-6 text-[#2B4736]" />
                    <span className="text-xl font-bold text-[#2B4736]">
                      {property.total_area} متر مربع
                    </span>
                  </div>
                  {(property.governorate || property.district) && (
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-6 h-6 text-[#1A5632]" />
                      <span className="text-lg font-bold text-[#0A1F13]">
                        {[property.governorate, property.district].filter(Boolean).join(' - ')}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <Bed className="w-6 h-6 text-[#2B4736]" />
                      <span className="text-xl font-bold">{property.bedrooms}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Bath className="w-6 h-6 text-[#2B4736]" />
                      <span className="text-xl font-bold">{property.bathrooms}</span>
                    </div>
                  </div>
                  {property.owner_name && (
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-6 h-6 text-[#1A5632]" />
                      <span className="text-lg font-bold text-[#0A1F13]">
                        المعلن: {property.owner_name}
                      </span>
                    </div>
                  )}
                  <div className="mt-3">
                    <span
                      className={`inline-block px-4 py-2 rounded-xl text-lg font-bold ${statusColor[property.status]}`}
                    >
                      {statusLabel[property.status]}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filteredProperties.length < total && (
          <div className="py-6 text-center">
            <button
              onClick={loadMoreProperties}
              disabled={loadingMore}
              className="min-h-12 rounded-xl border-2 border-[#1A5632] bg-white px-6 font-black text-[#1A5632] disabled:opacity-60"
            >
              {loadingMore
                ? 'جارٍ تحميل المزيد...'
                : `عرض المزيد (${(total - filteredProperties.length).toLocaleString('ar-IQ')} متبقٍ)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};