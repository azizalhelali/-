// الإعدادات — الهوية، طبقة الذكاء، القفل، الاشتراك
import { el, pageHeader, section, toast, spinner } from '../ui.js';
import { settings, saveSettings, all, T, list } from '../../core/store.js';
import { testConnection } from '../../ai/provider.js';
import * as vault from '../../core/vault.js';
import { num } from '../../core/util.js';

const MODELS = [
  { value: 'claude-opus-5', label: 'Claude Opus 5 — الأقوى للعمل المعقّد' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — توازن سرعة وذكاء' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — الأسرع والأرخص' },
];

const EFFORTS = [
  { value: 'low', label: 'منخفض — سريع ورخيص' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'مرتفع — الافتراضي' },
  { value: 'xhigh', label: 'مرتفع جدًا — للعمل الوكيلي المعقّد' },
];

const PLANS = [
  {
    name: 'مجاني',
    price: '٠',
    features: ['جهاز واحد', 'وكيل واحد', 'تكاملات محدودة', 'تشفير كامل', 'نسخ احتياطي يدوي'],
  },
  {
    name: 'Pro',
    price: '—',
    highlight: true,
    features: ['جميع الوكلاء التسعة', 'جميع التكاملات', 'مزامنة مشفّرة بين الأجهزة', 'ذكاء متقدّم', 'أتمتة غير محدودة'],
  },
  {
    name: 'Enterprise',
    price: '—',
    features: ['فرق وصلاحيات', 'سيرفر خاص', 'Self-hosted', 'سجل تدقيق موسّع', 'دعم مخصّص'],
  },
];

export function renderSettings(root) {
  async function save(patch) {
    await saveSettings(patch);
    toast('حُفظت الإعدادات', 'ok');
    draw();
  }

  function draw() {
    root.innerHTML = '';
    const s = settings();

    root.append(pageHeader('الإعدادات', 'الهوية، طبقة الذكاء، والقفل.'));

    // الهوية
    const nameInput = el('input', { type: 'text', value: s.ownerName || '', placeholder: 'اسمك' });
    const bizInput = el('input', { type: 'text', value: s.businessName || '', placeholder: 'اسم عملك' });
    const curSelect = el('select', {},
      ...['SAR', 'AED', 'USD', 'EUR', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'MAD', 'TND'].map((c) => {
        const o = el('option', { value: c, text: c });
        if (c === s.currency) o.selected = true;
        return o;
      }),
    );
    root.append(section('الهوية',
      el('div', { class: 'form' },
        el('div', { class: 'field' }, el('label', { text: 'اسمك' }), nameInput),
        el('div', { class: 'field' }, el('label', { text: 'اسم العمل' }), bizInput),
        el('div', { class: 'field' }, el('label', { text: 'العملة' }), curSelect),
      ),
      el('button', {
        class: 'btn primary', text: 'حفظ',
        onclick: () => save({
          ownerName: nameInput.value.trim(),
          businessName: bizInput.value.trim(),
          currency: curSelect.value,
        }),
      }),
    ));

    // طبقة الذكاء
    const enabled = el('input', { type: 'checkbox' });
    enabled.checked = Boolean(s.ai.enabled);
    const keyInput = el('input', {
      type: 'password', value: s.ai.apiKey || '', placeholder: 'sk-ant-…', autocomplete: 'off',
    });
    const modelSelect = el('select', {},
      ...MODELS.map((m) => {
        const o = el('option', { value: m.value, text: m.label });
        if (m.value === s.ai.model) o.selected = true;
        return o;
      }),
    );
    const effortSelect = el('select', {},
      ...EFFORTS.map((m) => {
        const o = el('option', { value: m.value, text: m.label });
        if (m.value === s.ai.effort) o.selected = true;
        return o;
      }),
    );
    const maxTokens = el('input', { type: 'number', value: s.ai.maxTokens || 8000, min: '1024', step: '1000' });
    const testHost = el('div', { class: 'test-result' });

    root.append(section('طبقة الذكاء',
      el('p', { class: 'muted', text: 'المفتاح يُخزَّن مشفّرًا داخل خزنتك على هذا الجهاز، ويُرسل مباشرةً إلى مزوّد النموذج. لا يمرّ بأي سيرفر وسيط.' }),
      el('div', { class: 'form' },
        el('div', { class: 'field field-inline' }, el('label', { text: 'تفعيل الوكلاء' }), enabled),
        el('div', { class: 'field' },
          el('label', { text: 'مفتاح Anthropic API' }), keyInput,
          el('small', { class: 'hint', text: 'احصل عليه من console.anthropic.com — يُنصح بمفتاح مخصّص لهذا التطبيق وحده.' }),
        ),
        el('div', { class: 'field' }, el('label', { text: 'النموذج' }), modelSelect),
        el('div', { class: 'field' },
          el('label', { text: 'مستوى الجهد' }), effortSelect,
          el('small', { class: 'hint', text: 'أعلى = أدق وأغلى. «مرتفع» يناسب معظم الحالات.' }),
        ),
        el('div', { class: 'field' },
          el('label', { text: 'سقف الرموز للرد الواحد' }), maxTokens,
          el('small', { class: 'hint', text: 'السقف يشمل تفكير النموذج ونصّ الرد معًا. لا تجعله منخفضًا.' }),
        ),
      ),
      el('div', { class: 'row-actions' },
        el('button', {
          class: 'btn primary', text: 'حفظ',
          onclick: () => save({
            ai: {
              enabled: enabled.checked,
              apiKey: keyInput.value.trim(),
              model: modelSelect.value,
              effort: effortSelect.value,
              maxTokens: Number(maxTokens.value) || 8000,
            },
          }),
        }),
        el('button', {
          class: 'btn', text: 'اختبر الاتصال',
          onclick: async () => {
            const key = keyInput.value.trim();
            if (!key) { toast('أدخل المفتاح أولًا', 'warn'); return; }
            testHost.innerHTML = '';
            testHost.append(spinner('جارٍ الاختبار…'));
            const res = await testConnection(key, modelSelect.value);
            testHost.innerHTML = '';
            if (res.ok) {
              testHost.append(el('p', { class: 'ok-text', text: '✓ الاتصال يعمل.' }));
            } else {
              testHost.append(el('p', {
                class: 'error',
                text: `✕ فشل (${res.status || 'شبكة'}) — ${res.detail || 'تحقّق من المفتاح والاتصال.'}`,
              }));
            }
          },
        }),
      ),
      testHost,
    ));

    // القفل
    const lockSelect = el('select', {},
      ...[
        { v: 0, l: 'بلا قفل تلقائي' }, { v: 5, l: '٥ دقائق' }, { v: 15, l: '١٥ دقيقة' },
        { v: 30, l: '٣٠ دقيقة' }, { v: 60, l: 'ساعة' },
      ].map(({ v, l }) => {
        const o = el('option', { value: v, text: l });
        if (Number(s.autoLockMinutes) === v) o.selected = true;
        return o;
      }),
    );
    root.append(section('القفل التلقائي',
      el('div', { class: 'form' },
        el('div', { class: 'field' }, el('label', { text: 'يقفل بعد خمول' }), lockSelect),
      ),
      el('button', {
        class: 'btn primary', text: 'حفظ',
        onclick: () => {
          const m = Number(lockSelect.value);
          vault.setAutoLockMinutes(m);
          save({ autoLockMinutes: m });
        },
      }),
    ));

    // حجم البيانات
    const total = all().filter((r) => r.type !== T.SETTING).length;
    root.append(section('بياناتك',
      el('p', { class: 'muted', text: `${num(total)} سجلًا مشفّرًا على هذا الجهاز — منها ${num(list(T.AUDIT).length)} حدث تدقيق.` }),
      el('p', { class: 'muted', text: 'للنسخ الاحتياطي والمحو الكامل، اذهب إلى قسم الأمن.' }),
      el('a', { class: 'btn', href: '#/security', text: 'فتح الأمن' }),
    ));

    // الاشتراك
    root.append(section('الاشتراك',
      el('div', { class: 'plans' },
        ...PLANS.map((p) => el('div', { class: `plan${p.highlight ? ' highlight' : ''}` },
          el('h4', { text: p.name }),
          el('div', { class: 'plan-price', text: p.price }),
          el('ul', {}, ...p.features.map((f) => el('li', { text: f }))),
          el('button', {
            class: `btn ${p.highlight ? 'primary' : ''}`,
            text: p.name === 'مجاني' ? 'خطتك الحالية' : 'قريبًا',
            disabled: true,
          }),
        )),
      ),
    ));
  }

  draw();
}
