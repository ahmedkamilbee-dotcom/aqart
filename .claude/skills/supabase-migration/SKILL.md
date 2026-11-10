---
name: supabase-migration
description: كتابة migration جديدة لقاعدة بيانات Supabase بمشروع عقاراتي، مع RLS والفهارس وتحديث README.
argument-hint: "<التغيير المطلوب>"
---

# Supabase migration: $ARGUMENTS

1. اقرأ الملفات الموجودة بـ `supabase/migrations/` بالترتيب، خصوصاً `*_init_schema.sql`، حتى تعرف الجداول والأسماء الحالية.
2. اسم الملف: `supabase/migrations/<YYYYMMDDHHMMSS>_<وصف_بالإنگليزي>.sql`، والتاريخ أحدث من آخر ملف.
3. القواعد:
   - **لا تعدّل ملف قديم.**
   - `create table if not exists` و `add column if not exists` و `create index if not exists`.
   - `alter table ... enable row level security;` لكل جدول جديد، مع سياسات تخلّي الوكيل يشوف صفوفه فقط.
   - أعمدة الوقت `timestamptz default now()`.
   - تعليق بأول الملف يشرح شنو يسوي ولماذا.
4. إذا الخادم يحتاج يقرأ الأعمدة الجديدة، اذكر بالتقرير شنو لازم يتغير بـ `backend/models.py` و`server.py` (هذا شغل `backend-dev`).
5. حدّث قائمة ملفات migrations بقسم "قاعدة البيانات والتخزين" في `README.md`.
