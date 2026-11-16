// استوديو المحتوى — عمود واحد، زر واحد.
// البيانات في متصفحك فقط. الاتصال الوحيد للخارج: api.anthropic.com عند ضغطك «اكتب لي».

const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PLATFORMS = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok' };
const ALL = Object.keys(PLATFORMS);
const GOALS = {
  growth: { label: 'نمو', brief: 'نمو: جذب متابعين جدد من العميل المثالي تحديدًا — أولوية للمشاركة والحفظ والمتابعة.' },
  trust: { label: 'ثقة', brief: 'ثقة: بناء السلطة والخبرة لدى العميل المثالي — أولوية للحفظ والتعليقات العميقة.' },
  convert: { label: 'مبيعات', brief: 'تحويل: تحريك العميل المثالي نحو طلب أو تواصل — دعوة واضحة غير مبتذلة.' },
};
const RESEARCH_TTL = 7 * 24 * 3600 * 1000; // تُحدَّث الدراسة تلقائيًا كل أسبوع

/* ---------- التخزين ---------- */
const KEY = 'studio.v1';
const SECRET = 'studio.key';
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const state = {
  icp: saved.icp || null,
  research: saved.research || null,
  generated: saved.generated || [],
  library: saved.library || [],
  settings: { model: 'claude-opus-5-5', effort: 'high', webSearch: true, remember: false, count: 3, ...saved.settings },
  ui: { platforms: [...ALL], goal: 'growth', tab: 'all', libTab: 'all', ...saved.ui },
};
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('تعذّر الحفظ في المتصفح', true); }
}
function getKey() {
  try { return sessionStorage.getItem(SECRET) || localStorage.getItem(SECRET) || ''; } catch { return ''; }
}
function setKey(k, remember) {
  try {
    sessionStorage.removeItem(SECRET); localStorage.removeItem(SECRET);
    if (k) (remember ? localStorage : sessionStorage).setItem(SECRET, k);
  } catch { /* تجاهل */ }
}

/* ---------- مساعدات ---------- */
function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 2600);
}
const spinner = (msg) => `<div class="spinner"><span class="pulse"></span>${esc(msg)}</div>`;
const plat = (p) => `<span class="dot ${esc(p)}"></span>${esc(PLATFORMS[p] || p)}`;
const ago = (t) => {
  const d = Math.floor((Date.now() - t) / 86400000);
  return d <= 0 ? 'اليوم' : d === 1 ? 'أمس' : `قبل ${d} أيام`;
};

/** شريط اختيار: متعدد أو مفرد */
function seg(el, items, get, set) {
  const render = () => {
    const v = get();
    el.innerHTML = items.map(([k, html]) => `<button type="button" data-k="${k}" class="${(Array.isArray(v) ? v.includes(k) : v === k) ? 'on' : ''}">${html}</button>`).join('');
  };
  el.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    set(b.dataset.k); save(); render();
  };
  render();
  return render;
}

/* ---------- التنقل ---------- */
function show(view) {
  for (const v of ['setup', 'home', 'library']) $(`#view-${v}`).classList.toggle('hidden', v !== view);
  if (view === 'library') renderLibrary();
  window.scrollTo(0, 0);
}
const ready = () => Boolean(state.icp?.niche && getKey());
$('#goHome').onclick = () => show(ready() ? 'home' : 'setup');
$('#goLibrary').onclick = () => show('library');

/* ---------- العميل المثالي (الإعداد) ---------- */
const ICP_FIELDS = [
  ['niche', 'المجال'], ['who', 'العميل المثالي'], ['pains', 'آلامه ورغباته'], ['desires', 'ما يريده'],
  ['voice', 'النبرة'], ['offer', 'العرض'], ['avoid', 'لا تستهدف'],
];
const icpText = () => ICP_FIELDS.filter(([k]) => state.icp?.[k]).map(([k, l]) => `${l}: ${state.icp[k]}`).join('\n');

function openSetup() {
  const f = $('#icpForm');
  const first = !state.icp?.niche;
  $('#setupTitle').textContent = first ? 'لمن تكتب؟' : 'عميلك المثالي';
  $('#cancelSetup').classList.toggle('hidden', first);
  $('#keyRow').classList.toggle('hidden', Boolean(getKey()));
  for (const k of ['niche', 'who', 'pains', 'voice', 'offer', 'avoid', 'data']) f.elements[k].value = state.icp?.[k] || '';
  show('setup');
  f.elements.niche.focus();
}
$('#editIcp').onclick = openSetup;
$('#cancelSetup').onclick = () => show('home');
$('#icpForm').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  const prev = state.icp || {};
  const next = { ...prev };
  for (const k of ['niche', 'who', 'pains', 'voice', 'offer', 'avoid', 'data']) next[k] = f.elements[k].value.trim();
  const key = f.elements.apiKey.value.trim();
  if (!getKey() && !key) return toast('أضف مفتاح API', true);
  if (key) setKey(key, state.settings.remember);
  // تغيّر العميل = دراسة جديدة
  if (prev.niche !== next.niche || prev.who !== next.who || prev.data !== next.data) state.research = null;
  state.icp = next;
  save(); renderHome(); show('home');
};

/* ---------- Claude API ---------- */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function claude({ system, user, schema = null, search = false }) {
  const apiKey = getKey();
  if (!apiKey) { openSettings(); throw new Error('أضف مفتاح Anthropic API من الإعدادات.'); }
  const s = state.settings;
  const base = {
    model: s.model || 'claude-opus-5-5',
    max_tokens: 16000,
    system,
    output_config: { effort: s.effort || 'high' },
    fallbacks: 'default', // عند رفض المُصنّف الأمني يُعاد الطلب تلقائيًا على نموذج بديل
  };
  if (schema) base.output_config.format = { type: 'json_schema', schema };
  if (search) base.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }];

  let messages = [{ role: 'user', content: user }];
  let useFallback = true;
  const blocks = [];

  for (let turn = 0; turn < 5; turn++) {
    const body = { ...base, messages };
    const headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (useFallback) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    else delete body.fallbacks;

    let res;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch {
      throw new Error('تعذّر الوصول إلى الشبكة.');
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error?.message || ''; } catch { /* تجاهل */ }
      if (res.status === 400 && useFallback && /fallback/i.test(detail)) { useFallback = false; turn--; continue; }
      if (res.status === 401) throw new Error('مفتاح API غير صالح.');
      if (res.status === 429) throw new Error('تجاوزت حد الطلبات. أعد المحاولة بعد قليل.');
      if (res.status >= 500) throw new Error('خدمة النموذج غير متاحة حاليًا.');
      throw new Error(detail || `فشل الطلب (${res.status})`);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('رفض النموذج هذا الطلب. عدّل الصياغة وأعد المحاولة.');
    blocks.push(...(data.content || []));
    if (data.stop_reason === 'pause_turn') { // البحث الطويل يتوقف مؤقتًا — نكمل
      messages = [...messages, { role: 'assistant', content: data.content }];
      continue;
    }
    if (data.stop_reason === 'max_tokens') throw new Error('انقطع الرد لطوله. قلّل العدد من الإعدادات.');
    break;
  }

  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const sources = [];
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url && !sources.some((x) => x.url === r.url)) sources.push({ url: r.url, title: r.title || r.url });
    }
  }
  return { text, json: parseJSON(text), sources };
}

function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* تابع */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* تابع */ } }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* تابع */ } }
  return null;
}

/* ---------- الدراسة (تعمل تلقائيًا في الخلفية) ---------- */
const RESEARCH_SYSTEM = `أنت محلل نمو متخصص في X وInstagram وTikTok للسوق العربي والخليجي.
مهمتك: اكتشاف أنماط المحتوى الأكثر انتشارًا والأسرع في تحقيق النمو حاليًا في مجال المستخدم، ثم تصفيتها بعدسة العميل المثالي.
قواعد:
- الانتشار الذي يجلب جمهورًا غير العميل المثالي ليس نموًا. قيّم كل نمط بمدى جذبه للعميل المثالي تحديدًا (icp_fit من 0 إلى 100).
- ركّز على إشارات النمو الحقيقية: الحفظ، المشاركة، الإرسال في الخاص، المتابعات الناتجة عن المنشور، معدل الإكمال في الفيديو — لا الإعجابات وحدها.
- ابحث عن أمثلة وتقارير حديثة (آخر ٩٠ يومًا قدر الإمكان) عن تغيّرات الخوارزميات والصيغ الرائجة في المجال.
- لا تخترع أرقامًا أو حسابات. إن لم تجد دليلًا كافيًا فاذكر ذلك واجعل confidence = "low".
- إن أعطاك المستخدم منشورات بأرقامها فهي أقوى دليل: احسب النسب (حفظ/مشاهدة، مشاركة/مشاهدة، متابع/مشاهدة) واستخرج ما يميّز الأعلى.
- اكتب بالعربية، مختصرًا ومحددًا.
أعد الرد كائن JSON واحدًا فقط، بلا أي نص قبله أو بعده، بهذا الشكل:
{"summary":"خلاصة في جملتين","platforms":[{"platform":"x|instagram|tiktok","patterns":[{"name":"","format":"","why_it_spreads":"","growth_signal":"","icp_fit":0,"confidence":"high|medium|low","hook_example":""}],"avoid":[""]}],"next_moves":[""]}
لكل منصة من ٣ إلى ٥ أنماط مرتّبة من الأقوى. غطِّ المنصات الثلاث.`;

async function research() {
  const user = `العميل المثالي:\n${icpText()}\n\nتاريخ اليوم: ${new Date().toISOString().slice(0, 10)}\n\n${state.icp.data ? `بياناتي (أقوى دليل):\n${state.icp.data}` : 'لا توجد بيانات خاصة — اعتمد على البحث.'}`;
  const r = await claude({ system: RESEARCH_SYSTEM, user, search: state.settings.webSearch });
  if (!r.json) throw new Error('لم تصل الدراسة بالشكل المتوقع. أعد المحاولة.');
  state.research = { ...r.json, sources: r.sources.slice(0, 10), at: Date.now() };
  save();
}
const researchFresh = () => state.research && Date.now() - state.research.at < RESEARCH_TTL;

function renderBasis() {
  const r = state.research;
  $('#basis').innerHTML = r
    ? `مبني على دراسة ما ينتشر في مجالك · ${ago(r.at)} <button class="link" id="toggleResearch">عرض</button><button class="link" id="refreshResearch">تحديث</button>`
    : 'أول مرة: بدرس ما ينتشر في مجالك ثم أكتب — يأخذ دقيقة أو اثنتين.';
  $('#researchPanel').classList.add('hidden');
}
document.addEventListener('click', async (e) => {
  if (e.target.id === 'toggleResearch') {
    const p = $('#researchPanel');
    const open = p.classList.toggle('hidden') === false;
    e.target.textContent = open ? 'إخفاء' : 'عرض';
    if (open) p.innerHTML = researchHTML();
  }
  if (e.target.id === 'refreshResearch') {
    const btn = e.target; btn.disabled = true;
    $('#status').innerHTML = spinner('أدرس ما ينتشر الآن…');
    try { await research(); $('#status').innerHTML = ''; toast('تحدّثت الدراسة'); renderBasis(); }
    catch (err) { $('#status').innerHTML = `<p class="error-box">${esc(err.message)}</p>`; btn.disabled = false; }
  }
});
function researchHTML() {
  const r = state.research; if (!r) return '';
  const fit = (n) => { const v = Number(n) || 0; return `<span class="fit ${v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad'}">${v}%</span>`; };
  return `${r.summary ? `<p class="insight">${esc(r.summary)}</p>` : ''}
    ${(r.platforms || []).filter((p) => p && typeof p === 'object').map((p) => `<div>
      <div class="plat-title">${plat(p.platform)}</div>
      ${(p.patterns || []).map((t) => `<div class="pat"><span><b>${esc(t.name)}</b> — ${esc(t.why_it_spreads)}</span>${fit(t.icp_fit)}</div>`).join('')}
    </div>`).join('')}
    ${r.sources?.length ? `<div class="sources">${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title).slice(0, 50)}</a>`).join('')}</div>` : ''}`;
}

/* ---------- الكتابة ---------- */
const PIECE = {
  type: 'object',
  additionalProperties: false,
  required: ['platform', 'format', 'hook', 'body', 'cta', 'hashtags', 'pattern_used', 'icp_reason', 'growth_lever', 'score'],
  properties: {
    platform: { type: 'string', enum: ALL },
    format: { type: 'string', description: 'تغريدة / ثريد / كاروسيل / ريل / فيديو…' },
    hook: { type: 'string', description: 'أول سطر أو أول ٣ ثوانٍ' },
    body: { type: 'string', description: 'المحتوى كاملًا جاهزًا للنشر: نص التغريدة أو الثريد مرقّمًا، أو شرائح الكاروسيل، أو سكربت الفيديو بالثواني ونص الشاشة' },
    cta: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    pattern_used: { type: 'string' },
    icp_reason: { type: 'string', description: 'جملة قصيرة: لماذا يجذب العميل المثالي تحديدًا' },
    growth_lever: { type: 'string' },
    score: { type: 'integer', description: 'من 0 إلى 100: احتمال النمو المؤهَّل' },
  },
};
const GEN_SCHEMA = { type: 'object', additionalProperties: false, required: ['pieces'], properties: { pieces: { type: 'array', items: PIECE } } };
const GEN_SYSTEM = `أنت كاتب محتوى ومخطط نمو لمنصات X وInstagram وTikTok.
اكتب محتوى جاهزًا للنشر فورًا، بلهجة ونبرة المستخدم، موجّهًا لعميله المثالي وحده.
قواعد:
- كل قطعة مبنية على نمط مثبت من الدراسة إن وُجدت.
- الخطّاف أهم سطر: محدد، يلمس ألم العميل المثالي أو رغبته، بلا تهويل أو وعود كاذبة.
- لكل منصة أسلوبها: X مختصر وحاد (ثريد مرقّم عند الحاجة، كل تغريدة دون ٢٨٠ حرفًا)، Instagram كاروسيل بشرائح مرقّمة أو ريل بنص شاشة + كابشن، TikTok سكربت بالثواني مع نص الشاشة والمشهد.
- لا تكتب ما يجذب جمهورًا واسعًا غير مناسب على حساب العميل المثالي.
- ٣ إلى ٥ هاشتاقات دقيقة فقط.
- رتّب القطع داخل كل منصة من الأقوى، وكن صادقًا في score.`;

async function run() {
  if (!ready()) return openSetup();
  const btn = $('#run'), status = $('#status');
  const plats = state.ui.platforms;
  btn.disabled = true;
  $('#results').innerHTML = '';
  $('#resultTabs').classList.add('hidden');
  try {
    if (!researchFresh()) {
      status.innerHTML = spinner('أدرس ما ينتشر في مجالك الآن…');
      await research();
      renderBasis();
    }
    status.innerHTML = spinner('أكتب…');
    const r = state.research;
    const recent = state.library.slice(0, 15).map((p) => `- ${p.hook}`).join('\n');
    const topic = $('#topic').value.trim();
    const user = `العميل المثالي:\n${icpText()}\n\nالهدف: ${GOALS[state.ui.goal].brief}\nالمنصات: ${plats.map((p) => PLATFORMS[p]).join('، ')}\nالعدد: ${state.settings.count} لكل منصة\n${topic ? `الموضوع: ${topic}` : 'اختر أقوى المواضيع للعميل المثالي.'}\n\nخلاصة الدراسة:\n${JSON.stringify({ summary: r.summary, platforms: r.platforms, next_moves: r.next_moves })}${recent ? `\n\nسبق حفظه — لا تكرّره:\n${recent}` : ''}`;
    const res = await claude({ system: GEN_SYSTEM, user, schema: GEN_SCHEMA });
    const pieces = res.json?.pieces;
    if (!Array.isArray(pieces) || !pieces.length) throw new Error('لم يصل محتوى. أعد المحاولة.');
    state.generated = pieces.map((p) => ({ ...p, id: crypto.randomUUID(), at: Date.now() }));
    state.ui.tab = 'all';
    save();
    status.innerHTML = '';
    renderResults();
    $('#resultTabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    status.innerHTML = `<p class="error-box">${esc(e.message)}</p>`;
  } finally { btn.disabled = false; }
}
$('#run').onclick = run;
$('#topic').onkeydown = (e) => { if (e.key === 'Enter') run(); };

/* ---------- عرض القطع ---------- */
function pieceHTML(p, inLib) {
  const tags = (p.hashtags || []).map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ');
  const isSaved = state.library.some((x) => x.id === p.id);
  return `<article class="piece" data-id="${p.id}">
    <div class="piece-meta">${plat(p.platform)} · ${esc(p.format)}<span class="score" title="احتمال النمو المؤهَّل">${Number(p.score) || 0}</span></div>
    <div class="hook">${esc(p.hook)}</div>
    <div class="text">${esc(p.body)}</div>
    ${p.cta ? `<div class="cta">${esc(p.cta)}</div>` : ''}
    ${tags ? `<div class="tags">${esc(tags)}</div>` : ''}
    <div class="piece-foot">
      <span class="why">${esc(p.icp_reason)}</span>
      <button class="btn" data-act="copy">نسخ</button>
      ${inLib ? '<button class="btn ghost" data-act="del">حذف</button>' : `<button class="btn ghost" data-act="save" ${isSaved ? 'disabled' : ''}>${isSaved ? 'محفوظ ✓' : 'حفظ'}</button>`}
    </div>
  </article>`;
}
function tabsFor(el, list, key, after) {
  const present = ALL.filter((p) => list.some((x) => x.platform === p));
  el.classList.toggle('hidden', present.length < 2);
  if (state.ui[key] !== 'all' && !present.includes(state.ui[key])) state.ui[key] = 'all';
  seg(el, [['all', 'الكل'], ...present.map((p) => [p, plat(p)])], () => state.ui[key], (k) => { state.ui[key] = k; after(); });
}
function renderResults() {
  const g = state.generated;
  tabsFor($('#resultTabs'), g, 'tab', renderResults);
  const items = g.filter((p) => state.ui.tab === 'all' || p.platform === state.ui.tab);
  $('#results').innerHTML = items.length ? `<div class="pieces">${items.map((p) => pieceHTML(p, false)).join('')}</div>` : '';
}
function renderLibrary() {
  const l = state.library;
  $('#libCount').textContent = l.length || '';
  tabsFor($('#libTabs'), l, 'libTab', renderLibrary);
  const items = l.filter((p) => state.ui.libTab === 'all' || p.platform === state.ui.libTab);
  $('#libOut').innerHTML = items.length
    ? `<div class="pieces">${items.map((p) => pieceHTML(p, true)).join('')}</div>`
    : '<p class="empty">ما حفظت شيء بعد.</p>';
}
const copyText = (p) => {
  const tags = (p.hashtags || []).map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ');
  return [p.hook, p.body, p.cta, tags].filter(Boolean).join('\n\n');
};
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('.piece').dataset.id;
  const p = state.generated.find((x) => x.id === id) || state.library.find((x) => x.id === id);
  if (!p) return;
  if (b.dataset.act === 'copy') {
    try { await navigator.clipboard.writeText(copyText(p)); toast('نُسخ'); } catch { toast('تعذّر النسخ', true); }
  } else if (b.dataset.act === 'save') {
    if (!state.library.some((x) => x.id === id)) state.library.unshift(p);
    save(); b.textContent = 'محفوظ ✓'; b.disabled = true;
    $('#libCount').textContent = state.library.length;
  } else if (b.dataset.act === 'del') {
    state.library = state.library.filter((x) => x.id !== id);
    save(); renderLibrary();
  }
});

/* ---------- الإعدادات ---------- */
const dlg = $('#settings');
function openSettings() {
  const f = $('#settingsForm'), s = state.settings;
  f.elements.apiKey.value = getKey();
  f.elements.remember.checked = s.remember;
  f.elements.count.value = String(s.count);
  f.elements.model.value = s.model;
  f.elements.effort.value = s.effort;
  f.elements.webSearch.checked = s.webSearch;
  dlg.showModal();
}
$('#openSettings').onclick = openSettings;
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const f = $('#settingsForm');
  state.settings = {
    remember: f.elements.remember.checked,
    count: Number(f.elements.count.value) || 3,
    model: f.elements.model.value.trim() || 'claude-opus-5-5',
    effort: f.elements.effort.value,
    webSearch: f.elements.webSearch.checked,
  };
  setKey(f.elements.apiKey.value.trim(), state.settings.remember);
  save(); toast('حُفظت');
  if (!ready()) openSetup();
});
$('#wipe').onclick = () => {
  if (!confirm('سيُمحى كل شيء من هذا المتصفح. متأكد؟')) return;
  try { localStorage.removeItem(KEY); } catch { /* تجاهل */ }
  setKey('', false);
  location.reload();
};

/* ---------- التشغيل ---------- */
function renderHome() {
  $('#forWho').textContent = state.icp?.who || state.icp?.niche || '';
  renderBasis();
  renderResults();
}
seg($('#platforms'), ALL.map((p) => [p, plat(p)]), () => state.ui.platforms, (k) => {
  const s = new Set(state.ui.platforms);
  if (s.has(k) && s.size === 1) return toast('منصة وحدة على الأقل');
  s.has(k) ? s.delete(k) : s.add(k);
  state.ui.platforms = ALL.filter((p) => s.has(p));
});
seg($('#goal'), Object.entries(GOALS).map(([k, g]) => [k, g.label]), () => state.ui.goal, (k) => { state.ui.goal = k; });

$('#libCount').textContent = state.library.length || '';
if (ready()) { renderHome(); show('home'); } else openSetup();
