import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { PROPERTY } from '../constants/testIds';
import { IraqGovernoratePicker } from '../components/IraqGovernoratePicker';
import { PrivatePropertyImage } from '../components/PrivatePropertyImage';
import { uploadPropertyImage } from '../lib/uploadPropertyImage';
import {
  Home,
  DollarSign,
  Ruler,
  BedDouble,
  Phone,
  User,
  Upload,
  Save,
  ArrowRight,
  Trash2,
  MapPin,
  MessageCircle,
  Instagram,
} from 'lucide-react';

const API = `${(process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '')}/api`;

export const EditProperty = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    total_area: '',
    price: '',
    front_width: '',
    length: '',
    bedrooms: '',
    bathrooms: '',
    owner_name: '',
    owner_phone: '',
    whatsapp_number: '',
    instagram_username: '',
    governorate: '',
    district: '',
    images: [],
    status: 'available',
  });

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const { data } = await axios.get(`${API}/properties/${id}`, { withCredentials: true });
        // Authorization guard: redirect if user is not admin and not the property owner
        if (user && user.role !== 'admin' && user.id !== data.agent_id) {
          navigate(`/property/${id}`, { replace: true });
          return;
        }
        setFormData({
          total_area: data.total_area.toString(),
          price: data.price.toString(),
          front_width: data.front_width.toString(),
          length: data.length.toString(),
          bedrooms: data.bedrooms.toString(),
          bathrooms: data.bathrooms.toString(),
          owner_name: data.owner_name || '',
          owner_phone: data.owner_phone || '',
          whatsapp_number: data.whatsapp_number || '',
          instagram_username: data.instagram_username || '',
          governorate: data.governorate || '',
          district: data.district || '',
          images: data.images || [],
          status: data.status,
        });
      } catch (err) {
        setError(err.response?.data?.detail || 'تعذر تحميل العقار');
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchProperty();
    }
  }, [id, user, navigate]);

  const handleImageUpload = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError('');

    try {
      const imageUrl = await uploadPropertyImage(file);
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, imageUrl],
      }));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'تعذر رفع الصورة. حاول مرة أخرى.');
    } finally {
      setUploadingImage(false);
      input.value = '';
    }
  };

  const removeImage = (idx) => {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== idx),
    });
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      const payload = {
        total_area: parseFloat(formData.total_area),
        price: parseFloat(formData.price),
        front_width: parseFloat(formData.front_width),
        length: parseFloat(formData.length),
        bedrooms: parseInt(formData.bedrooms),
        bathrooms: parseInt(formData.bathrooms),
        owner_name: formData.owner_name,
        owner_phone: formData.owner_phone,
        whatsapp_number: formData.whatsapp_number.trim() || formData.owner_phone.trim(),
        instagram_username: formData.instagram_username.trim(),
        governorate: formData.governorate,
        district: formData.district,
        images: formData.images,
        status: formData.status,
      };

      await axios.put(`${API}/properties/${id}`, payload, { withCredentials: true });
      navigate(`/property/${id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'تعذر حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-28 md:pb-8 bg-[#F9F6F0] flex items-center justify-center" dir="rtl">
        <p className="text-3xl font-bold text-[#2B4736]">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-28 md:pb-8 bg-[#F9F6F0] p-4 sm:p-8"
      dir="rtl"
      data-testid="edit-property-page"
    >
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-6 mb-6 flex items-center justify-between">
          <h1 className="text-4xl font-extrabold text-[#0A1F13]">تعديل العقار</h1>
          <button
            data-testid="edit-property-cancel"
            onClick={() => navigate(`/property/${id}`)}
            className="min-h-[64px] px-6 bg-transparent border-4 border-[#1A5632] text-[#1A5632] rounded-2xl flex items-center gap-3 hover:bg-[#1A5632] hover:text-white transition-colors text-xl font-black"
          >
            <ArrowRight className="w-8 h-8" />
            إلغاء
          </button>
        </div>

        {error && (
          <div className="mb-6 p-6 bg-red-50 border-2 border-red-500 rounded-2xl">
            <p className="text-xl font-bold text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white border-2 border-[#D2CFC9] rounded-3xl p-8 space-y-6">
          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              حالة العقار
            </label>
            <select
              data-testid={PROPERTY.statusSelect}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold bg-white"
            >
              <option value="available">متاح</option>
              <option value="sold">مباع</option>
              <option value="rented">مؤجر</option>
            </select>
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              <Home className="inline-block w-8 h-8 ml-2" />
              المساحة الكلية (متر مربع)
            </label>
            <input
              data-testid={PROPERTY.totalAreaInput}
              type="number"
              value={formData.total_area}
              onChange={(e) => setFormData({ ...formData, total_area: e.target.value })}
              className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
            />
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              <DollarSign className="inline-block w-8 h-8 ml-2" />
              السعر (دينار عراقي)
            </label>
            <input
              data-testid={PROPERTY.priceInput}
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <Ruler className="inline-block w-8 h-8 ml-2" />
                مساحة الواجهة
              </label>
              <input
                data-testid={PROPERTY.frontWidthInput}
                type="number"
                value={formData.front_width}
                onChange={(e) => setFormData({ ...formData, front_width: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <Ruler className="inline-block w-8 h-8 ml-2" />
                الطول
              </label>
              <input
                data-testid={PROPERTY.lengthInput}
                type="number"
                value={formData.length}
                onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <BedDouble className="inline-block w-8 h-8 ml-2" />
                عدد الغرف
              </label>
              <input
                data-testid={PROPERTY.bedroomsInput}
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              />
            </div>
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <BedDouble className="inline-block w-8 h-8 ml-2" />
                عدد الحمامات
              </label>
              <input
                data-testid={PROPERTY.bathroomsInput}
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IraqGovernoratePicker
              compact
              className="md:col-span-2"
              title="حدد المحافظة على الخريطة"
              value={formData.governorate}
              onChange={(governorate) => setFormData({ ...formData, governorate })}
              selectTestId="property-governorate-input"
            />
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <MapPin className="inline-block w-8 h-8 ml-2" />
                القضاء
              </label>
              <input
                data-testid="property-district-input"
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
                placeholder="مثال: الكرادة"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <User className="inline-block w-8 h-8 ml-2" />
                اسم صاحب العقار
              </label>
              <input
                data-testid="property-owner-name-input"
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
                placeholder="مثال: أحمد علي"
              />
            </div>
            <div>
              <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
                <Phone className="inline-block w-8 h-8 ml-2" />
                رقم هاتف صاحب العقار
              </label>
              <input
                data-testid={PROPERTY.ownerPhoneInput}
                type="tel"
                value={formData.owner_phone}
                onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
                placeholder="مثال: 07701234567"
              />
            </div>
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              <MessageCircle className="inline-block w-8 h-8 ml-2 text-green-600" />
              رقم الواتساب (اختياري)
            </label>
            <input
              type="tel"
              value={formData.whatsapp_number}
              onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
              className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              placeholder="اتركه فارغاً إذا كان نفس رقم الهاتف الأساسي"
            />
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              <Instagram className="inline-block w-8 h-8 ml-2 text-pink-600" />
              حساب الإنستغرام (اختياري)
            </label>
            <input
              type="text"
              value={formData.instagram_username}
              onChange={(e) => setFormData({ ...formData, instagram_username: e.target.value })}
              className="w-full min-h-[64px] text-2xl p-4 rounded-xl border-2 border-[#D2CFC9] focus:border-[#1A5632] focus:ring-4 focus:ring-[#1A5632]/20 outline-none font-semibold"
              placeholder="مثال: aqarat_baghdad"
            />
          </div>

          <div>
            <label className="block text-2xl font-extrabold text-[#0A1F13] mb-3">
              صور العقار
            </label>
            <label
              htmlFor="image-upload-edit"
              data-testid={PROPERTY.imageUpload}
              className="w-full min-h-[64px] bg-[#1A5632] text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-[#0F3820] transition-colors cursor-pointer text-xl font-black mb-4"
            >
              <Upload className="w-8 h-8" />
              {uploadingImage ? 'جارٍ الرفع...' : 'إضافة صورة'}
            </label>
            <input
              id="image-upload-edit"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploadingImage}
            />
            {formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <PrivatePropertyImage
                      src={img}
                      alt={`صورة ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-xl border-2 border-[#D2CFC9]"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 left-2 bg-red-600 text-white p-2 rounded-full hover:bg-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            data-testid={PROPERTY.submitButton}
            onClick={handleSubmit}
            disabled={saving}
            className="w-full min-h-[72px] bg-[#1A5632] text-white rounded-2xl flex items-center justify-center gap-4 hover:bg-[#0F3820] transition-colors shadow-[0_8px_0_#0F3820] active:translate-y-2 active:shadow-[0_0px_0_#0F3820] text-2xl font-black disabled:opacity-50"
          >
            <Save className="w-10 h-10" />
            {saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </div>
  );
};
