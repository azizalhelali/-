// تنسيق مجلس الإدارة — بناء السياق، تشغيل الوكلاء، إنتاج ملخّص اليوم
import { T, list, put, settings } from '../core/store.js';
import { callModel, aiReady, AIError } from './provider.js';
import { getAgent, AGENTS } from './agents.js';
import { today, daysUntil, uid } from '../core/util.js';

const MAX_PER_TYPE = 25;

const LABELS = {
  [T.PROJECT]: 'المشاريع',
  [T.CLIENT]: 'العملاء',
  [T.CONTRACT]: 'العقود',
  [T.MEETING]: 'الاجتماعات',
  [T.TASK]: 'المهام',
  [T.DECISION]: 'القرارات',
  [T.RISK]: 'المخاطر',
  [T.OPPORTUNITY]: 'الفرص',
  [T.STRATEGY]: 'الاستراتيجيات',
  [T.COMPETITOR]: 'المنافسون',
  [T.AUDIENCE]: 'شرائح الجمهور',
  [T.CAMPAIGN]: 'الحملات',
  [T.CONTENT]: 'المحتوى',
  [T.KNOWLEDGE]: 'المعرفة',
  [T.MESSAGE]: 'الرسائل',
  [T.SKILL]: 'المهارات',
  [T.LESSON]: 'الدروس',
  [T.TXN]: 'الحركات المالية',
  [T.INVOICE]: 'الفواتير',
  [T.WORKFLOW]: 'المسارات الآلية',
  [T.AUDIT]: 'سجل التدقيق',
};

/** يحوّل سجلًا إلى سطر مختصر يفهمه النموذج بلا حشو */
function summarize(r) {
  const parts = [];
  const push = (k, v) => {
    if (v === undefined || v === null || v === '' || v === false) return;
    parts.push(`${k}: ${typeof v === 'string' ? v.slice(0, 240) : v}`);
  };
  push('العنوان', r.title || r.name);
  push('الحالة', r.status);
  push('الأولوية', r.priority);
  push('العميل', r.clientName);
  push('المبلغ', r.amount);
  push('النوع', r.kind);
  push('التاريخ', r.date || r.dueDate || r.endDate || r.startDate);
  push('المنصة', r.platform);
  push('الشدة', r.severity);
  push('ملاحظة', r.notes || r.summary || r.body || r.description);
  return `- ${parts.join(' | ')}`;
}

/** يبني نص سياق العمل من أنواع محددة */
export function buildContext(scopes) {
  const s = settings();
  const lines = [
    `التاريخ: ${today()}`,
    s.businessName ? `اسم العمل: ${s.businessName}` : null,
    s.ownerName ? `المالك: ${s.ownerName}` : null,
    `العملة: ${s.currency}`,
    '',
  ].filter(Boolean);

  let hasData = false;
  for (const type of scopes) {
    const rows = list(type).slice(0, MAX_PER_TYPE);
    if (!rows.length) continue;
    hasData = true;
    lines.push(`## ${LABELS[type] || type} (${rows.length})`);
    for (const r of rows) lines.push(summarize(r));
    lines.push('');
  }
  if (!hasData) lines.push('(لا توجد بيانات مُدخلة بعد في هذه النطاقات.)');
  return lines.join('\n');
}

/** إحصاءات سريعة تُستخدم في مركز القيادة بلا ذكاء اصطناعي */
export function pulse() {
  const overdue = list(T.TASK, (t) => t.status !== 'done' && daysUntil(t.dueDate) < 0).length;
  const dueToday = list(T.TASK, (t) => t.status !== 'done' && daysUntil(t.dueDate) === 0).length;
  const openTasks = list(T.TASK, (t) => t.status !== 'done').length;
  const activeProjects = list(T.PROJECT, (p) => p.status === 'active').length;
  const month = new Date().toISOString().slice(0, 7);
  const txns = list(T.TXN, (t) => String(t.date || '').startsWith(month));
  const income = txns.filter((t) => t.kind === 'income').reduce((a, t) => a + (+t.amount || 0), 0);
  const expense = txns.filter((t) => t.kind === 'expense').reduce((a, t) => a + (+t.amount || 0), 0);
  const unpaid = list(T.INVOICE, (i) => i.status !== 'paid')
    .reduce((a, i) => a + (+i.amount || 0), 0);
  const expiring = list(T.CONTRACT, (c) => {
    const d = daysUntil(c.endDate);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const pendingDecisions = list(T.DECISION, (d) => d.status === 'pending').length;
  const openRisks = list(T.RISK, (r) => r.status !== 'closed').length;
  const openOpps = list(T.OPPORTUNITY, (o) => o.status !== 'closed').length;
  const unreadMsgs = list(T.MESSAGE, (m) => !m.handled).length;

  return {
    overdue, dueToday, openTasks, activeProjects,
    income, expense, net: income - expense, unpaid,
    expiring, pendingDecisions, openRisks, openOpps, unreadMsgs,
  };
}

/** تشغيل وكيل واحد بسؤال حر */
export async function askAgent(agentId, prompt, { signal } = {}) {
  const agent = getAgent(agentId);
  if (!agent) throw new AIError('وكيل غير معروف');
  if (!aiReady()) throw new AIError('طبقة الذكاء غير مُفعّلة. أضف مفتاح API من الإعدادات.', 'disabled');

  const context = buildContext(agent.scopes);
  const res = await callModel({
    system: agent.system,
    messages: [
      { role: 'user', content: `سياق العمل الحالي:\n\n${context}\n\n---\n\nالطلب: ${prompt}` },
    ],
    signal,
  });

  await put(T.AGENTRUN, {
    agentId,
    agentName: agent.name,
    prompt,
    output: res.text,
    usage: res.usage,
    at: new Date().toISOString(),
  });

  return res;
}

// ---- ملخّص اليوم ----

const BRIEF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'highlights', 'decisions', 'risks', 'opportunities'],
  properties: {
    summary: { type: 'string', description: 'فقرة واحدة قصيرة تصف حالة العمل اليوم' },
    highlights: {
      type: 'array',
      description: 'من ٣ إلى ٦ ملاحظات مهمة',
      items: { type: 'string' },
    },
    decisions: {
      type: 'array',
      description: 'قرارات تحتاج موافقة المستخدم',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'options'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'severity', 'action'],
        properties: {
          title: { type: 'string' },
          severity: { type: 'string', enum: ['منخفض', 'متوسط', 'مرتفع'] },
          action: { type: 'string' },
        },
      },
    },
    opportunities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'why', 'firstStep'],
        properties: {
          title: { type: 'string' },
          why: { type: 'string' },
          firstStep: { type: 'string' },
        },
      },
    },
  },
};

const BRIEF_SYSTEM = `
أنت الرئيس التنفيذي في مجلس إدارة نظام تشغيل شخصي للأعمال.
مهمتك: قراءة حالة العمل كاملة وإخراج ملخّص صباحي واحد.

قواعد ملزمة:
- اعتمد حصريًا على البيانات المعطاة. لا تخترع أي معلومة أو رقم أو اسم.
- إن كانت البيانات شحيحة، قلّل عدد العناصر بدل تعبئتها بافتراضات، واذكر في الملخّص ما ينقص.
- القرار = شيء لا يستطيع النظام حسمه وحده ويحتاج موافقة بشرية.
- الخطر = شيء قد يكلّف مالًا أو وقتًا أو علاقة إن أُهمل.
- الفرصة = شيء يمكن كسبه ولم يُستغل بعد.
- بحد أقصى: ٣ قرارات، ٣ مخاطر، ٣ فرص.
- كل نص بالعربية، قصير ومباشر، بلا مقدمات.
`.trim();

const ALL_SCOPES = [
  T.PROJECT, T.CLIENT, T.CONTRACT, T.TASK, T.MEETING,
  T.TXN, T.INVOICE, T.CAMPAIGN, T.CONTENT, T.COMPETITOR,
  T.MESSAGE, T.SKILL, T.KNOWLEDGE, T.WORKFLOW, T.RISK, T.OPPORTUNITY,
];

/** يبني ملخّص اليوم ويحفظ القرارات والمخاطر والفرص المشتقة منه */
export async function generateBrief({ signal } = {}) {
  if (!aiReady()) throw new AIError('طبقة الذكاء غير مُفعّلة. أضف مفتاح API من الإعدادات.', 'disabled');

  const context = buildContext(ALL_SCOPES);
  const p = pulse();
  const pulseText = `مؤشرات محسوبة آليًا: مهام متأخرة ${p.overdue}، مهام اليوم ${p.dueToday}، `
    + `مشاريع نشطة ${p.activeProjects}، دخل الشهر ${p.income}، مصروف الشهر ${p.expense}، `
    + `فواتير غير محصّلة ${p.unpaid}، عقود تنتهي خلال ٣٠ يومًا ${p.expiring}، `
    + `رسائل لم تُعالج ${p.unreadMsgs}.`;

  const res = await callModel({
    system: BRIEF_SYSTEM,
    messages: [{
      role: 'user',
      content: `${pulseText}\n\nحالة العمل:\n\n${context}\n\n---\n\nأخرج ملخّص اليوم.`,
    }],
    schema: BRIEF_SCHEMA,
    maxTokens: 12000,
    signal,
  });

  const data = res.json;
  if (!data) throw new AIError('تعذّر قراءة مخرجات النموذج.');

  const brief = await put(T.BRIEF, {
    date: today(),
    summary: data.summary,
    highlights: data.highlights || [],
    decisionCount: (data.decisions || []).length,
    riskCount: (data.risks || []).length,
    opportunityCount: (data.opportunities || []).length,
    usage: res.usage,
  });

  const batch = uid('batch');
  for (const d of data.decisions || []) {
    await put(T.DECISION, {
      title: d.title, why: d.why, options: d.options || [],
      status: 'pending', source: 'ai', batch,
    });
  }
  for (const r of data.risks || []) {
    await put(T.RISK, {
      title: r.title, severity: r.severity || 'متوسط', action: r.action,
      status: 'open', source: 'ai', batch,
    });
  }
  for (const o of data.opportunities || []) {
    await put(T.OPPORTUNITY, {
      title: o.title, why: o.why, firstStep: o.firstStep,
      status: 'open', source: 'ai', batch,
    });
  }

  return { brief, data };
}

/** لوحة مؤشرات المجلس */
export function agentKPIs() {
  return AGENTS.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    role: a.role,
    kpiLabel: a.kpiLabel,
    kpiValue: (() => { try { return a.kpi(); } catch { return 0; } })(),
    kpiFormat: a.kpiFormat || 'number',
  }));
}
