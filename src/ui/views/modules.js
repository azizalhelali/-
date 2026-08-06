// تعريفات وحدات نظام التشغيل المبنية على العارض العام
import { T, list, put } from '../../core/store.js';
import { renderCollection } from './collection.js';
import { fmtDate, daysUntil, money, num } from '../../core/util.js';
import { settings } from '../../core/store.js';

const STATUS_PROJECT = [
  { value: 'active', label: 'نشط' },
  { value: 'paused', label: 'متوقف' },
  { value: 'done', label: 'مكتمل' },
];
const PRIORITY = [
  { value: 'high', label: 'عالية' },
  { value: 'normal', label: 'عادية' },
  { value: 'low', label: 'منخفضة' },
];
const PRIORITY_AR = { high: 'عالية', normal: 'عادية', low: 'منخفضة' };
const STATUS_AR = {
  active: 'نشط', paused: 'متوقف', done: 'مكتمل', open: 'مفتوح', closed: 'مغلق',
  draft: 'مسودة', ready: 'جاهز', published: 'منشور', signed: 'موقّع', expired: 'منتهٍ',
  todo: 'قيد الانتظار', doing: 'قيد التنفيذ', paid: 'مدفوعة', sent: 'مُرسلة', overdue: 'متأخرة',
  planned: 'مخطّط', learning: 'قيد التعلّم',
};

function tone(status) {
  if (['done', 'paid', 'published', 'signed', 'closed'].includes(status)) return 'good';
  if (['overdue', 'expired'].includes(status)) return 'bad';
  if (['paused', 'draft', 'planned'].includes(status)) return 'warn';
  return '';
}

function dueMeta(iso) {
  if (!iso) return null;
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d < 0) return `متأخر ${Math.abs(d)} يوم`;
  if (d === 0) return 'يستحق اليوم';
  return `خلال ${d} يوم`;
}

function clientOptions() {
  const rows = list(T.CLIENT);
  return [{ value: '', label: '— بلا عميل —' }, ...rows.map((c) => ({ value: c.name, label: c.name }))];
}

// ================= Business OS =================

export const projects = () => ({
  type: T.PROJECT,
  title: 'المشاريع',
  subtitle: 'كل ما تعمل عليه فعليًا، وحالته الحقيقية.',
  addLabel: '+ مشروع',
  defaults: { status: 'active', priority: 'normal' },
  tabs: [
    { value: 'all', label: 'الكل' },
    { value: 'active', label: 'نشطة', match: (r) => r.status === 'active' },
    { value: 'done', label: 'مكتملة', match: (r) => r.status === 'done' },
  ],
  fields: [
    { name: 'title', label: 'اسم المشروع', required: true },
    { name: 'clientName', label: 'العميل', type: 'select', options: clientOptions() },
    { name: 'status', label: 'الحالة', type: 'select', options: STATUS_PROJECT },
    { name: 'priority', label: 'الأولوية', type: 'select', options: PRIORITY },
    { name: 'value', label: 'القيمة', type: 'number' },
    { name: 'dueDate', label: 'تاريخ التسليم', type: 'date' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea' },
  ],
  agent: {
    id: 'ceo',
    label: 'راجع محفظة المشاريع',
    prompt: () => 'راجع محفظة مشاريعي: أيّها يستحق التركيز هذا الأسبوع، وأيّها يجب إيقافه أو إعادة تسعيره؟ اذكر السبب من البيانات.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) },
    meta: [
      r.clientName || null,
      r.priority ? `أولوية ${PRIORITY_AR[r.priority] || r.priority}` : null,
      r.value ? money(r.value, settings().currency) : null,
      dueMeta(r.dueDate),
    ],
    body: r.notes,
  }),
});

export const clients = () => ({
  type: T.CLIENT,
  title: 'العملاء',
  subtitle: 'من تعمل معه، وما قيمته الحقيقية.',
  addLabel: '+ عميل',
  fields: [
    { name: 'name', label: 'الاسم', required: true },
    { name: 'company', label: 'الجهة' },
    { name: 'email', label: 'البريد', type: 'email' },
    { name: 'phone', label: 'الهاتف' },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'active', label: 'نشط' }, { value: 'paused', label: 'متوقف' }, { value: 'closed', label: 'منتهٍ' },
    ] },
    { name: 'notes', label: 'ملاحظات', type: 'textarea' },
  ],
  agent: {
    id: 'finance',
    label: 'حلّل ربحية العملاء',
    prompt: () => 'من عملائي: من الأعلى قيمة ومن يستنزف وقتًا أكثر مما يدفع؟ اقترح إعادة تسعير أو إنهاء علاقة عند اللزوم.',
  },
  row: (r) => ({
    title: r.name,
    badge: r.status ? { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) } : null,
    meta: [r.company, r.email, r.phone],
    body: r.notes,
  }),
});

export const contracts = () => ({
  type: T.CONTRACT,
  title: 'العقود',
  subtitle: 'الالتزامات والتواريخ الحرجة.',
  addLabel: '+ عقد',
  fields: [
    { name: 'title', label: 'عنوان العقد', required: true },
    { name: 'clientName', label: 'الطرف الآخر', type: 'select', options: clientOptions() },
    { name: 'amount', label: 'القيمة', type: 'number' },
    { name: 'startDate', label: 'تاريخ البدء', type: 'date' },
    { name: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'draft', label: 'مسودة' }, { value: 'signed', label: 'موقّع' }, { value: 'expired', label: 'منتهٍ' },
    ] },
    { name: 'terms', label: 'البنود المهمة', type: 'textarea', rows: 6 },
  ],
  agent: {
    id: 'legal',
    label: 'راجع البنود',
    prompt: () => 'راجع عقودي وأبرز البنود غير المتوازنة، وشروط الإنهاء، ومخاطر الدفع، والملكية الفكرية.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status || '—', tone: tone(r.status) },
    meta: [
      r.clientName,
      r.amount ? money(r.amount, settings().currency) : null,
      r.endDate ? `ينتهي ${fmtDate(r.endDate)}` : null,
      dueMeta(r.endDate),
    ],
    body: r.terms,
  }),
});

export const meetings = () => ({
  type: T.MEETING,
  title: 'الاجتماعات',
  subtitle: 'ما قيل، وما تقرّر، وما بقي.',
  addLabel: '+ اجتماع',
  fields: [
    { name: 'title', label: 'الموضوع', required: true },
    { name: 'date', label: 'التاريخ', type: 'date', default: new Date().toISOString().slice(0, 10) },
    { name: 'attendees', label: 'الحضور' },
    { name: 'notes', label: 'المحضر', type: 'textarea', rows: 8 },
    { name: 'outcomes', label: 'القرارات والمخرجات', type: 'textarea', rows: 4 },
  ],
  agent: {
    id: 'operations',
    label: 'استخرج المهام',
    prompt: () => 'من محاضر اجتماعاتي: استخرج قائمة مهام واضحة بمالك ومهلة لكل مهمة، واذكر ما بقي بلا مالك.',
  },
  row: (r) => ({
    title: r.title,
    meta: [r.date ? fmtDate(r.date) : null, r.attendees],
    body: r.outcomes || r.notes,
  }),
});

export const tasks = () => ({
  type: T.TASK,
  title: 'المهام',
  subtitle: 'التنفيذ اليومي.',
  addLabel: '+ مهمة',
  defaults: { status: 'todo', priority: 'normal' },
  tabs: [
    { value: 'open', label: 'مفتوحة', match: (r) => r.status !== 'done' },
    { value: 'today', label: 'اليوم', match: (r) => r.status !== 'done' && daysUntil(r.dueDate) <= 0 },
    { value: 'all', label: 'الكل' },
  ],
  fields: [
    { name: 'title', label: 'المهمة', required: true },
    { name: 'project', label: 'المشروع' },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'todo', label: 'قيد الانتظار' }, { value: 'doing', label: 'قيد التنفيذ' }, { value: 'done', label: 'مكتملة' },
    ] },
    { name: 'priority', label: 'الأولوية', type: 'select', options: PRIORITY },
    { name: 'dueDate', label: 'الاستحقاق', type: 'date' },
    { name: 'notes', label: 'تفاصيل', type: 'textarea' },
  ],
  agent: {
    id: 'operations',
    label: 'رتّب يومي',
    prompt: () => 'رتّب مهامي المفتوحة حسب الأثر لا حسب التاريخ فقط. اقترح ثلاث مهام لليوم وما يجب تأجيله أو حذفه.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) },
    meta: [r.project, r.priority !== 'normal' ? PRIORITY_AR[r.priority] : null, dueMeta(r.dueDate)],
    body: r.notes,
    extraActions: r.status !== 'done'
      ? [{ icon: '✓', title: 'إنهاء', onClick: (rec) => put(T.TASK, { status: 'done' }, rec.id) }]
      : [{ icon: '↺', title: 'إعادة فتح', onClick: (rec) => put(T.TASK, { status: 'todo' }, rec.id) }],
  }),
});

// ================= Growth OS =================

export const strategy = () => ({
  type: T.STRATEGY,
  title: 'الاستراتيجية',
  subtitle: 'أين تلعب، وكيف تفوز.',
  addLabel: '+ استراتيجية',
  fields: [
    { name: 'title', label: 'العنوان', required: true },
    { name: 'horizon', label: 'المدى', type: 'select', options: [
      { value: 'quarter', label: 'ربع سنة' }, { value: 'year', label: 'سنة' }, { value: 'long', label: 'مدى بعيد' },
    ] },
    { name: 'goal', label: 'الهدف القابل للقياس', type: 'textarea' },
    { name: 'bets', label: 'الرهانات الأساسية', type: 'textarea', rows: 5 },
  ],
  agent: {
    id: 'marketing',
    label: 'اختبر الاستراتيجية',
    prompt: () => 'اختبر استراتيجيتي: ما الافتراض الأضعف فيها؟ وما أرخص تجربة تثبته أو تنفيه خلال أسبوعين؟',
  },
  row: (r) => ({ title: r.title, meta: [r.horizon], body: r.goal }),
});

export const competitors = () => ({
  type: T.COMPETITOR,
  title: 'المنافسون',
  subtitle: 'ما الذي يعمل عندهم، وما الفجوة.',
  addLabel: '+ منافس',
  fields: [
    { name: 'name', label: 'الاسم', required: true },
    { name: 'url', label: 'الموقع أو الحساب' },
    { name: 'strengths', label: 'نقاط قوّتهم', type: 'textarea' },
    { name: 'gaps', label: 'الفجوات التي تركوها', type: 'textarea' },
  ],
  agent: {
    id: 'marketing',
    label: 'حلّل المنافسة',
    prompt: () => 'قارن بين المنافسين المسجّلين واستخرج فجوة واحدة يمكنني احتلالها خلال ٣٠ يومًا، مع خطوات التنفيذ.',
  },
  row: (r) => ({ title: r.name, meta: [r.url], body: r.gaps || r.strengths }),
});

export const audience = () => ({
  type: T.AUDIENCE,
  title: 'الجمهور',
  subtitle: 'لمن تتحدّث، وما الذي يهمّه.',
  addLabel: '+ شريحة',
  fields: [
    { name: 'name', label: 'اسم الشريحة', required: true },
    { name: 'pain', label: 'الألم الأساسي', type: 'textarea' },
    { name: 'channels', label: 'أين يوجدون' },
    { name: 'notes', label: 'ملاحظات', type: 'textarea' },
  ],
  agent: {
    id: 'marketing',
    label: 'حدّد الرسالة',
    prompt: () => 'لكل شريحة جمهور مسجّلة: اكتب رسالة واحدة من جملتين تخاطب ألمها مباشرة، واذكر القناة الأنسب.',
  },
  row: (r) => ({ title: r.name, meta: [r.channels], body: r.pain }),
});

export const campaigns = () => ({
  type: T.CAMPAIGN,
  title: 'الحملات',
  subtitle: 'الجهد المنظّم ونتائجه.',
  addLabel: '+ حملة',
  defaults: { status: 'planned' },
  fields: [
    { name: 'title', label: 'اسم الحملة', required: true },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'planned', label: 'مخطّطة' }, { value: 'active', label: 'نشطة' }, { value: 'done', label: 'منتهية' },
    ] },
    { name: 'channel', label: 'القناة' },
    { name: 'budget', label: 'الميزانية', type: 'number' },
    { name: 'result', label: 'النتيجة حتى الآن', type: 'textarea' },
  ],
  agent: {
    id: 'marketing',
    label: 'أعد توزيع الجهد',
    prompt: () => 'قيّم حملاتي بالنتيجة لا بالنشاط. ما الحملة التي يجب إيقافها وما التي تستحق مضاعفة الجهد؟',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) },
    meta: [r.channel, r.budget ? money(r.budget, settings().currency) : null],
    body: r.result,
  }),
});

export const content = () => ({
  type: T.CONTENT,
  title: 'المحتوى',
  subtitle: 'من الفكرة إلى النشر.',
  addLabel: '+ محتوى',
  defaults: { status: 'draft' },
  tabs: [
    { value: 'all', label: 'الكل' },
    { value: 'draft', label: 'مسودات', match: (r) => r.status === 'draft' },
    { value: 'ready', label: 'جاهز', match: (r) => r.status === 'ready' },
    { value: 'published', label: 'منشور', match: (r) => r.status === 'published' },
  ],
  fields: [
    { name: 'title', label: 'العنوان أو الفكرة', required: true },
    { name: 'platform', label: 'المنصة', type: 'select', options: [
      { value: 'linkedin', label: 'لينكدإن' }, { value: 'x', label: 'إكس' },
      { value: 'instagram', label: 'إنستغرام' }, { value: 'youtube', label: 'يوتيوب' },
      { value: 'newsletter', label: 'نشرة بريدية' }, { value: 'blog', label: 'مدوّنة' },
    ] },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'draft', label: 'مسودة' }, { value: 'ready', label: 'جاهز' }, { value: 'published', label: 'منشور' },
    ] },
    { name: 'scheduledAt', label: 'موعد النشر', type: 'date' },
    { name: 'body', label: 'النص', type: 'textarea', rows: 10 },
  ],
  agent: {
    id: 'content',
    label: 'اكتب مسودات',
    prompt: () => 'من أفكار المحتوى المسجّلة عندي: اكتب مسودتين جاهزتين للنشر بأسلوب المنصة المحددة، واحذف فكرة ضعيفة واذكر سبب حذفها.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) },
    meta: [r.platform, r.scheduledAt ? fmtDate(r.scheduledAt) : null],
    body: r.body,
  }),
});

// ================= Knowledge OS =================

export const knowledge = () => ({
  type: T.KNOWLEDGE,
  title: 'المعرفة',
  subtitle: 'كل ما قرأته وشاهدته، في مكان واحد مترابط.',
  addLabel: '+ مصدر',
  fields: [
    { name: 'title', label: 'العنوان', required: true },
    { name: 'kind', label: 'النوع', type: 'select', options: [
      { value: 'note', label: 'ملاحظة' }, { value: 'article', label: 'مقال' },
      { value: 'book', label: 'كتاب' }, { value: 'video', label: 'فيديو' },
      { value: 'pdf', label: 'مستند' }, { value: 'meeting', label: 'اجتماع' },
    ] },
    { name: 'source', label: 'الرابط أو المصدر' },
    { name: 'tags', label: 'وسوم (افصل بفاصلة)' },
    { name: 'body', label: 'المحتوى أو الخلاصة', type: 'textarea', rows: 10 },
    { name: 'processed', label: 'تمت معالجته', type: 'checkbox' },
  ],
  agent: {
    id: 'research',
    label: 'اربط المعرفة',
    prompt: () => 'لخّص مصادري في نقاط قابلة للاستخدام، واربطها بمشاريعي الحالية. أنهِ كل مصدر بسطر: لماذا يهمّني الآن.',
  },
  row: (r) => ({
    title: r.title,
    badge: r.processed ? { text: 'معالَج', tone: 'good' } : null,
    meta: [r.kind, r.tags, r.source],
    body: r.body,
  }),
});

// ================= Communication OS =================

export const messages = () => ({
  type: T.MESSAGE,
  title: 'الصندوق الموحّد',
  subtitle: 'البريد والرسائل والتفاعلات في مكان واحد.',
  addLabel: '+ رسالة',
  tabs: [
    { value: 'open', label: 'لم تُعالج', match: (r) => !r.handled },
    { value: 'all', label: 'الكل' },
  ],
  fields: [
    { name: 'title', label: 'الموضوع', required: true },
    { name: 'channel', label: 'القناة', type: 'select', options: [
      { value: 'email', label: 'بريد' }, { value: 'whatsapp', label: 'واتساب' },
      { value: 'linkedin', label: 'لينكدإن' }, { value: 'x', label: 'إكس' },
      { value: 'instagram', label: 'إنستغرام' }, { value: 'other', label: 'أخرى' },
    ] },
    { name: 'from', label: 'من' },
    { name: 'body', label: 'النص', type: 'textarea', rows: 6 },
    { name: 'handled', label: 'تمت معالجتها', type: 'checkbox' },
  ],
  agent: {
    id: 'ceo',
    label: 'لخّص وارتّب',
    prompt: () => 'لخّص رسائلي غير المعالَجة في مجموعات، وحدّد أي منها يحتاج ردًّا مني اليوم وأيها يمكن تجاهله.',
  },
  row: (r) => ({
    title: r.title,
    badge: r.handled ? { text: 'معالَجة', tone: 'good' } : { text: 'جديدة', tone: 'warn' },
    meta: [r.channel, r.from],
    body: r.body,
    extraActions: [{
      icon: r.handled ? '↺' : '✓',
      title: r.handled ? 'إعادة فتح' : 'تمّت',
      onClick: (rec) => put(T.MESSAGE, { handled: !rec.handled }, rec.id),
    }],
  }),
});

// ================= Learning OS =================

export const skills = () => ({
  type: T.SKILL,
  title: 'خطة التعلّم',
  subtitle: 'مهارات مرتبطة مباشرةً بما تعمل عليه.',
  addLabel: '+ مهارة',
  defaults: { status: 'planned' },
  fields: [
    { name: 'title', label: 'المهارة', required: true },
    { name: 'level', label: 'مستواك الحالي', type: 'select', options: [
      { value: 'none', label: 'صفر' }, { value: 'basic', label: 'أساسي' },
      { value: 'good', label: 'جيد' }, { value: 'strong', label: 'قوي' },
    ] },
    { name: 'linkedProject', label: 'المشروع المرتبط' },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'planned', label: 'مخطّطة' }, { value: 'learning', label: 'قيد التعلّم' }, { value: 'done', label: 'مُتقنة' },
    ] },
    { name: 'outcome', label: 'المخرج الملموس المطلوب', type: 'textarea' },
  ],
  agent: {
    id: 'learning',
    label: 'ابنِ خطة',
    prompt: () => 'ابنِ لي خطة تعلّم مرتبطة بمشاريعي: مهارة واحدة، ثلاث خطوات، ومخرج ملموس يُستخدم في العمل خلال أسبوع.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status, tone: tone(r.status) },
    meta: [r.linkedProject, r.level],
    body: r.outcome,
  }),
});

// ================= Automation OS =================

export const workflows = () => ({
  type: T.WORKFLOW,
  title: 'الأتمتة',
  subtitle: 'كل ما يتكرر يستحق أن يصير مسارًا.',
  addLabel: '+ مسار',
  fields: [
    { name: 'title', label: 'اسم المسار', required: true },
    { name: 'trigger', label: 'المُشغّل (متى يبدأ؟)' },
    { name: 'steps', label: 'الخطوات', type: 'textarea', rows: 8 },
    { name: 'savedMinutes', label: 'الوقت الموفَّر شهريًا (دقيقة)', type: 'number' },
    { name: 'status', label: 'الحالة', type: 'select', options: [
      { value: 'draft', label: 'مسودة' }, { value: 'active', label: 'مُفعّل' },
    ] },
  ],
  agent: {
    id: 'operations',
    label: 'اكتشف التكرار',
    prompt: () => 'ابحث في مهامي واجتماعاتي ورسائلي عن الأنماط المتكررة. لكل نمط: صِفه، قدّر الوقت الضائع شهريًا، واقترح مسار أتمتة بخطوات مرقّمة.',
  },
  row: (r) => ({
    title: r.title,
    badge: { text: STATUS_AR[r.status] || r.status || 'مسودة', tone: tone(r.status) },
    meta: [r.trigger, r.savedMinutes ? `يوفّر ${num(r.savedMinutes)} دقيقة/شهر` : null],
    body: r.steps,
  }),
});

/** يبني دالة عرض جاهزة من دالة إعداد */
export function collectionView(configFn) {
  return (root) => renderCollection(root, configFn());
}
