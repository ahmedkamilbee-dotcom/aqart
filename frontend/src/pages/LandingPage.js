import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, ArrowRight, BarChart3, Building2, CalendarDays, Check,
  ChevronDown, ClipboardList, Menu, Phone, ShieldCheck, Smartphone, Users, X,
} from 'lucide-react';
import { ContactFooter } from '../components/ContactFooter';
import { buildSupportWhatsAppUrl, supportWhatsAppNumber } from '../config/brand';

const plans = [
  { name: 'تجربة مجانية', duration: '30 يوماً', amount: 0, free: true, detail: 'جرّب إدارة العقارات والعملاء قبل الاشتراك.' },
  { name: 'شهري', duration: 'شهر واحد', amount: 25000, detail: 'مرونة للتجربة والتشغيل الشهري.' },
  { name: 'ربع سنوي', duration: '3 أشهر', amount: 65000, detail: 'متابعة مستمرة بتكلفة أقل من الدفع الشهري.' },
  { name: 'سنوي', duration: '12 شهراً', amount: 250000, detail: 'خطة سنوية للمكاتب التي تعتمد النظام يومياً.', featured: true },
];

const features = [
  { icon: Building2, title: 'ملف واضح لكل عقار', description: 'سجّل الموقع والسعر والمساحة والصور والحالة، واعثر على العقار بالبحث والتصفية.' },
  { icon: Users, title: 'متابعة العملاء', description: 'احتفظ ببيانات العملاء وملاحظاتهم، واربط كل عميل بالعقار المناسب.' },
  { icon: CalendarDays, title: 'مواعيد ما تضيع', description: 'رتّب المتابعات خلال الأسبوع، وميّز المواعيد المستحقة حتى تعرف خطوتك القادمة.' },
  { icon: BarChart3, title: 'أداء مفهوم', description: 'شوف العقارات ومراحل التواصل والصفقات الناجحة بملخص سهل.' },
];

const questions = [
  { question: 'لمن صُمم عقاراتي؟', answer: 'للوكيل والمكتب العقاري الذي يريد ترتيب العقارات والعملاء والمتابعات في مكان واحد.' },
  { question: 'هل أگدر أشارك العقار ويا الزبون؟', answer: 'نعم. تقدر تنشئ رابطاً عاماً للعقار وتوقفه بأي وقت. معلومات المالك تبقى مخفية، ورقم الوكيل ما يظهر إلا إذا فعلت هذا الخيار.' },
  { question: 'من يشوف سجلات العملاء؟', answer: 'كل وكيل يشوف سجلاته فقط، والمدير العام يستطيع مراجعة سجلات الوكلاء.' },
  { question: 'شلون أفعل الاشتراك؟', answer: supportWhatsAppNumber ? 'تبدأ بتجربة مجانية مدتها 30 يوماً. بعدين تختار الباقة وتتواصل عبر واتساب حتى يفعّلها المدير.' : 'تبدأ بتجربة مجانية مدتها 30 يوماً، وتفعيل الباقات المدفوعة يتم يدوياً من إدارة المنصة.' },
];

const money = (value) => Number(value).toLocaleString('ar-IQ');

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const startPath = user ? '/dashboard' : '/auth?mode=register';

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <main className="landing-page" dir="rtl">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <a href="#top" className="landing-brand" aria-label="عقاراتي - الصفحة الرئيسية">
            <span className="landing-brand-mark"><Building2 size={24} /></span>
            <span><strong>عقاراتي</strong><small>إدارة عقارية أوضح</small></span>
          </a>
          <nav className="landing-nav-links" aria-label="التنقل الرئيسي">
            <a href="#features">المميزات</a>
            <a href="#how-it-works">طريقة العمل</a>
            <a href="#pricing">الأسعار</a>
            <a href="#faq">الأسئلة الشائعة</a>
          </nav>
          <div className="landing-nav-actions">
            {user ? (
              <button className="landing-button landing-button-primary landing-nav-cta" onClick={() => go('/dashboard')}>افتح لوحة العمل <ArrowLeft size={17} /></button>
            ) : (
              <>
                <button className="landing-login" onClick={() => go('/auth')}>دخول</button>
                <button className="landing-button landing-button-primary landing-nav-cta" onClick={() => go('/auth?mode=register')}>ابدأ مجاناً <ArrowLeft size={17} /></button>
              </>
            )}
          </div>
          <button className="landing-menu-toggle" aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
        {menuOpen && <nav className="landing-mobile-menu" aria-label="قائمة الهاتف">
          <a href="#features" onClick={() => setMenuOpen(false)}>المميزات</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>طريقة العمل</a>
          <a href="#pricing" onClick={() => setMenuOpen(false)}>الأسعار</a>
          <a href="#faq" onClick={() => setMenuOpen(false)}>الأسئلة الشائعة</a>
          <button onClick={() => go(user ? '/dashboard' : '/auth?mode=register')}>{user ? 'لوحة العمل' : 'ابدأ التجربة المجانية'}</button>
        </nav>}
      </header>

      <section className="landing-hero" id="top">
        <div className="landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><span className="landing-eyebrow-dot" /> نظام عربي للوكلاء والمكاتب العقارية</span>
            <h1>عقاراتك، عملاؤك، ومواعيدك <span>كلها بمكان واحد.</span></h1>
            <p>رتّب شغلك العقاري من أول تسجيل العقار إلى متابعة العميل وإغلاق الصفقة، بواجهة عربية سهلة تشتغل على الموبايل والكمبيوتر.</p>
            <div className="landing-hero-actions">
              <button className="landing-button landing-button-white" onClick={() => go(startPath)}>{user ? 'اذهب إلى لوحة العمل' : 'جرّب مجاناً لمدة شهر'} <ArrowLeft size={18} /></button>
              <a className="landing-button landing-button-ghost" href="#features">اكتشف المميزات <ArrowRight size={17} /></a>
            </div>
            <div className="landing-trust-notes">
              <span><Check size={16} /> عربي ومن اليمين لليسار</span>
              <span><Check size={16} /> تجربة مجانية 30 يوماً</span>
              <span><Check size={16} /> بيانات المالك مخفية عند المشاركة</span>
            </div>
          </div>
          <div className="landing-preview-wrap" aria-label="معاينة توضيحية للوحة عقاراتي">
            <div className="landing-preview-glow" />
            <div className="landing-preview-card">
              <div className="landing-preview-topline"><div><span className="landing-preview-kicker">معاينة للواجهة</span><h2>نظرة سريعة على يومك</h2></div><span className="landing-preview-date">بيانات توضيحية</span></div>
              <div className="landing-preview-stats">
                <div><span>العقارات المتاحة</span><strong>١٢</strong><Building2 size={18} /></div>
                <div><span>عملاء بالمتابعة</span><strong>٨</strong><Users size={18} /></div>
                <div><span>مواعيد اليوم</span><strong>٣</strong><CalendarDays size={18} /></div>
              </div>
              <div className="landing-preview-section-head"><span>المهام القادمة</span><span>هذا الأسبوع</span></div>
              <div className="landing-preview-task"><span className="landing-preview-task-icon"><PhoneIcon /></span><span><strong>متابعة عميل مهتم</strong><small>بغداد · 10:30 صباحاً</small></span><span className="landing-preview-task-state">اليوم</span></div>
              <div className="landing-preview-task"><span className="landing-preview-task-icon landing-preview-task-icon-gold"><ClipboardList size={18} /></span><span><strong>تحديث حالة العقار</strong><small>البصرة · 1:00 ظهراً</small></span><span className="landing-preview-task-state">اليوم</span></div>
              <div className="landing-preview-progress"><div><span>مسار العملاء</span><span>متابعة واضحة</span></div><div className="landing-preview-progress-track"><i /></div></div>
            </div>
            <div className="landing-preview-note"><ShieldCheck size={19} /><span>كل وكيل يشوف سجلاته الخاصة</span></div>
          </div>
        </div>
        <div className="landing-hero-orb landing-hero-orb-one" /><div className="landing-hero-orb landing-hero-orb-two" />
      </section>

      <section className="landing-audience-strip" aria-label="ملخص الاستخدام">
        <div><Smartphone size={20} /><span>يشتغل على الموبايل والكمبيوتر</span></div>
        <div><CalendarDays size={20} /><span>مواعيد متابعة أسبوعية</span></div>
        <div><ShieldCheck size={20} /><span>تحكم بمعلومات المشاركة</span></div>
      </section>

      <section className="landing-section landing-features" id="features">
        <div className="landing-section-heading"><span className="landing-section-label">كل شغلك بمكان واحد</span><h2>أدوات عملية للشغل اليومي</h2><p>رتّب التفاصيل المهمة وخلي الخطوة الجاية واضحة إلك ولفريقك.</p></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, title, description }, index) => <article className="landing-feature-card" key={title}><span className={`landing-feature-icon feature-tone-${index + 1}`}><Icon size={23} /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className="landing-work-section" id="how-it-works">
        <div className="landing-work-inner">
          <div className="landing-section-heading landing-section-heading-light"><span className="landing-section-label">بخطوات بسيطة</span><h2>ابدأ من أول يوم</h2><p>ما تحتاج خبرة تقنية حتى ترتب مكتبك.</p></div>
          <div className="landing-steps">
            <article><span>١</span><div><h3>أنشئ حساب المكتب</h3><p>سجّل حساب الوكيل وابدأ التجربة المجانية.</p></div></article>
            <article><span>٢</span><div><h3>أضف العقارات والعملاء</h3><p>سجّل التفاصيل، واربط العميل بالعقار المناسب.</p></div></article>
            <article><span>٣</span><div><h3>تابع وأغلق الصفقة</h3><p>رتّب مواعيدك، وشارك رابط العقار عند الحاجة.</p></div></article>
          </div>
          <button className="landing-button landing-button-white" onClick={() => go(startPath)}>ابدأ التجربة <ArrowLeft size={18} /></button>
        </div>
      </section>

      <section className="landing-section landing-pricing" id="pricing">
        <div className="landing-section-heading"><span className="landing-section-label">أسعار واضحة بالدينار العراقي</span><h2>اختار الباقة المناسبة إلك</h2><p>ابدأ مجاناً، وبعدها اختار مدة الاشتراك اللي تناسب شغلك.</p></div>
        <div className="landing-price-grid">{plans.map((plan) => <article className={`landing-price-card ${plan.featured ? 'landing-price-card-featured' : ''}`} key={plan.name}>
          {plan.featured && <span className="landing-price-badge">للاستخدام السنوي</span>}
          <h3>{plan.name}</h3><p className="landing-price-duration">{plan.duration}</p><div className="landing-price-value">{plan.free ? <strong>مجاناً</strong> : <><strong>{money(plan.amount)}</strong><span> د.ع</span></>}</div><p className="landing-price-detail">{plan.detail}</p><button className={`landing-button ${plan.featured ? 'landing-button-primary' : 'landing-button-outline'}`} onClick={() => { const price = plan.free ? 'مجاناً' : `${money(plan.amount)} د.ع`; const supportUrl = buildSupportWhatsAppUrl(`السلام عليكم، أرغب بطلب باقة ${plan.name} (${price}) من منصة عقاراتي.`); if (supportUrl) window.open(supportUrl, '_blank', 'noopener,noreferrer'); }}>{plan.free ? 'اطلب التجربة عبر واتساب' : 'اشترك عبر واتساب'} <ArrowLeft size={17} /></button>
        </article>)}</div>
        <p className="landing-pricing-note">طلبات الباقات المجانية والمدفوعة تصل إلى سجاد عبر واتساب.</p>
      </section>

      <section className="landing-section landing-faq" id="faq">
        <div className="landing-section-heading"><span className="landing-section-label">قبل ما تبدأ</span><h2>أسئلة تتكرر</h2></div>
        <div className="landing-faq-list">{questions.map((item) => <details key={item.question}><summary>{item.question}<ChevronDown size={18} /></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="landing-final-cta"><div><span className="landing-section-label">خطوتك الأولى بسيطة</span><h2>ابدأ بتنظيم شغلك العقاري اليوم.</h2><p>جرّب عقاراتي مجاناً لمدة 30 يوماً، وشوف إذا يناسب طريقة شغلك.</p></div><button className="landing-button landing-button-white" onClick={() => go(startPath)}>{user ? 'افتح لوحة العمل' : 'أنشئ حسابك' } <ArrowLeft size={18} /></button></section>
      <ContactFooter />
    </main>
  );
};

function PhoneIcon() {
  return <Phone size={18} />;
}
