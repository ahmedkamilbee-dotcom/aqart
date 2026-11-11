---
name: rtl-page
description: بناء أو تعديل صفحة React عربية RTL بواجهة عقاراتي، متوافقة مع design_guidelines.json وتشتغل على الهاتف.
argument-hint: "<الصفحة أو المكوّن>"
---

# صفحة RTL: $ARGUMENTS

1. اقرأ `design_guidelines.json` (الألوان، الخطوط، المسافات، قواعد RTL) وصفحة مشابهة بـ `frontend/src/pages/`.
2. استخدم مكوّنات `frontend/src/components/ui/` (shadcn)، والأيقونات اللي يستخدمها المشروع.
3. RTL:
   - `ps-/pe-/ms-/me-/start-/end-` بدل `pl/pr/ml/mr/left/right`.
   - الأيقونات الاتجاهية (أسهم) تنقلب.
   - الأرقام والهواتف داخل `dir="ltr"` عند الحاجة.
4. الهاتف أولاً: يشتغل على 375px، أزرار 44px على الأقل، والتنقل السفلي (`BottomNav`) ما يغطي المحتوى.
5. حالات: تحميل، فارغ، خطأ برسالة عربية واضحة.
6. سجّل المسار بـ `frontend/src/App.js` إذا صفحة جديدة، واحمِه بـ `ProtectedRoute` إذا تحتاج دخول.
7. تحقق: `cd frontend && corepack yarn build` إذا الحزم منصّبة.
