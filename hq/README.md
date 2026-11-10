# 🏢 مقر عقاراتي (AI HQ)

شركة كاملة من وكلاء Claude داخل المشروع: مدير تنفيذي، 15 موظف، لوحة مكتب حيّة، موجز صباحي، اجتماع أحد، مستويات، ومكتبة مهارات.

## الفريق
| القسم | الموظف | المعرّف |
|---|---|---|
| الإدارة | 👔 Claude: المدير التنفيذي | الجلسة الرئيسية |
| الهندسة | 🖥️ ليث: واجهات React | `frontend-dev` |
| | ⚙️ نور: خادم FastAPI | `backend-dev` |
| | 🗄️ حيدر: قاعدة البيانات | `db-engineer` |
| | 🛡️ زينب: الأمان (قراءة فقط) | `security-auditor` |
| | 🧪 علي: الجودة والاختبارات | `qa-tester` |
| | 🚀 مصطفى: النشر والتشغيل | `devops` |
| | 🔍 رنا: مراجعة الكود (قراءة فقط) | `code-reviewer` |
| المنتج والتصميم | 🎨 مريم: تصميم RTL | `ui-designer` |
| | 🧭 يوسف: مدير المنتج | `product-manager` |
| النمو | 📈 هبة: SEO والمشاركة | `seo-specialist` |
| | ✍️ سجاد: المحتوى العربي | `content-writer` |
| | 📣 دعاء: التسويق | `marketing-lead` |
| العمليات | 🤝 كرار: المبيعات والاشتراكات | `sales-crm` |
| | 📊 آية: البيانات (قراءة فقط) | `data-analyst` |
| | 📚 عباس: الدعم والتوثيق | `support-docs` |

## الأوامر اليومية (داخل Claude Code)
| الأمر | شنو يسوي |
|---|---|
| `/hq-task <الطلب>` | المدير يقسّم الطلب ويوزّعه ويراجعه ويسجّل XP |
| `/morning-brief` | موجز الصباح → `hq/briefs/` |
| `/sunday-meeting` | اجتماع الأسبوع، مكافآت وأولويات → `hq/meetings/` |
| `/hire <الدور>` | توظيف وكيل جديد |

تكدر تكلّم موظف مباشرة: "خلّي db-engineer يضيف عمود ...".

## مكتبة المهارات (`.claude/skills/`)
`hq-task` · `morning-brief` · `sunday-meeting` · `hire` · `supabase-migration` · `api-endpoint` · `rtl-page` · `property-listing-copy` · `release-check` · `security-check`

## لوحة المكتب
```bash
node hq/hq.mjs list                       # حالة الفريق بالطرفية
node hq/hq.mjs board                      # يبني hq/board.html
node hq/hq.mjs start  db-engineer "..."   # يدوياً إذا احتجت
node hq/hq.mjs done   db-engineer 25 "..."
```
افتح `hq/board.html` بالمتصفح؛ تتحدّث كل دقيقة.

المستويات وطريقة كسب XP في [`LEVELS.md`](LEVELS.md).

## الملفات
- `roster.json`: الفريق والمستويات والمهام (المصدر الأساسي).
- `activity.json`: سجل النشاط.
- `board.html`: اللوحة (تتولّد تلقائياً، لا تعدّلها يدوياً).
- `briefs/`، `meetings/`: الموجزات والمحاضر.
- `reports/`: تقرير كل موظف كامل، حتى تقراه بنفسك.
- `projects/`: وثائق المشاريع (مثل محطة الصدى).
