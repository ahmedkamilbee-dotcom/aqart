---
name: release-check
description: فحص ما قبل الـ commit أو النشر لمشروع عقاراتي - صياغة الخادم، بناء الواجهة، الاختبارات المتاحة، وأسرار مسرّبة.
---

# فحص قبل التسليم

شغّل المتاح وسجّل النتيجة الحقيقية لكل خطوة (نجح / فشل / ما انفحص ولماذا):

```bash
# 1. الخادم
python -m py_compile backend/*.py

# 2. الواجهة (إذا node_modules موجود)
test -d frontend/node_modules && (cd frontend && corepack yarn build) || echo "تخطّي: الحزم غير منصّبة"

# 3. الاختبارات (تحتاج قاعدة بيانات وخادم؛ إذا مو متوفرة، اذكر هذا)
(cd backend && python -m pytest -q) || true

# 4. أسرار
git diff --cached --name-only | grep -E '\.env$|\.pem$|\.key$' && echo "⚠️ ملف سري بالـ commit"
git diff --cached | grep -nE 'service_role|JWT_SECRET=|eyJhbGci' | head
```

- لا تعطّل اختبار حتى ينجح.
- إذا فشل شي، بلّغ بالمخرجات مو بملخص متفائل.
