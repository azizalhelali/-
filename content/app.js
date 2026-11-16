// استوديو المحتوى — صفحة واحدة، بلا حزم، بلا سيرفر.
// البيانات في متصفحك فقط. الاتصال الوحيد للخارج: api.anthropic.com عند ضغطك «ادرس» أو «ولّد».

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PLATFORMS = {
  x: { name: 'X' },
  instagram: { name: 'Instagram' },
  tiktok: { name: 'TikTok' },
};
const ALL = Object.keys(PLATFORMS);

/* ---------- التخزين ---------- */
const KEY = 'studio.v1';
const SECRET = 'studio.key';
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const state = Object.assign({
  icp: null,
  research: null,
  generated: [],
  library: [],
  settings: { model: 'claude-opus-5-5', effort: 'high', webSearch: true, remember: false },
  ui: { researchPlatforms: [...ALL], genPlatforms: [...ALL], libFilter: 'all' },
}, load());
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

/* ---------- واجهة مساعدة ---------- */
function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}
const spinner = (msg) => `<div class="spinner"><span class="dot"></span>${esc(msg)}</div>`;
const pBadge = (p) => `<span class="badge p-${esc(p)}">${esc(PLATFORMS[p]?.name || p)}</span>`;
const fitBadge = (n) => {
  const v = Number(n) || 0;
  return `<span class="badge ${v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad'}">ملاءمة ${v}%</span>`;
};
const confLabel = { high: 'ثقة عالية', medium: 'ثقة متوسطة', low: 'ثقة منخفضة' };
const fmtDate = (t) => new Date(t).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function chips(host, key, { single = false, withAll = false } = {}) {
  const el = $(host);
  const opts = withAll ? ['all', ...ALL] : ALL;
  const render = () => {
    const sel = state.ui[key];
    el.innerHTML = opts.map((p) => {
      const on = single ? sel === p : sel.includes(p);
      return `<button type="button" class="chip ${on ? 'on' : ''}" data-p="${p}"><span class="dot"></span>${p === 'all' ? 'الكل' : PLATFORMS[p].name}</button>`;
    }).join('');
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const p = b.dataset.p;
    if (single) state.ui[key] = p;
    else {
      const s = new Set(state.ui[key]);
      s.has(p) ? s.delete(p) : s.add(p);
      if (!s.size) return toast('اختر منصة واحدة على الأقل');
      state.ui[key] = ALL.filter((x) => s.has(x));
    }
    save(); render();
    if (key === 'libFilter') renderLibrary();
  });
  render();
}

/* ---------- Claude API ---------- */
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

async function claude({ system, user, schema = null, search = false, signal }) {
  const apiKey = getKey();
  if (!apiKey) { openSettings(); throw new Error('أضف مفتاح Anthropic API من الإعدادات أولًا.'); }
  const s = state.settings;
  const base = {
    model: s.model || 'claude-opus-5-5',
    max_tokens: 16000,
    system,
    output_config: { effort: s.effort || 'high' },
    // عند رفض المُصنّف الأمني يُعاد الطلب تلقائيًا على نموذج بديل مناسب
    fallbacks: 'default',
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
      res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch {
      throw new Error('تعذّر الوصول إلى الشبكة.');
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error?.message || ''; } catch { /* تجاهل */ }
      // إن لم يُدعم خيار النموذج البديل في حسابك، نعيد المحاولة بدونه
      if (res.status === 400 && useFallback && /fallback/i.test(detail)) { useFallback = false; turn--; continue; }
      if (res.status === 401) throw new Error('مفتاح API غير صالح.');
      if (res.status === 429) throw new Error('تجاوزت حد الطلبات. أعد المحاولة بعد قليل.');
      if (res.status >= 500) throw new Error('خدمة النموذج غير متاحة حاليًا.');
      throw new Error(detail || `فشل الطلب (${res.status})`);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw new Error('رفض النموذج هذا الطلب. عدّل الصياغة وأعد المحاولة.');
    blocks.push(...(data.content || []));
    // البحث الطويل قد يتوقف مؤقتًا — نكمل من حيث توقف
    if (data.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: data.content }];
      continue;
    }
    if (data.stop_reason === 'max_tokens') throw new Error('انقطع الرد لطوله. قلّل العدد وأعد المحاولة.');
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

/* ---------- العميل المثالي ---------- */
const ICP_FIELDS = [
  ['niche', 'المجال'], ['who', 'العميل المثالي'], ['pains', 'آلامه'], ['desires', 'ما يريده'],
  ['offer', 'العرض'], ['voice', 'النبرة'], ['avoid', 'لا تستهدف'],
];
function icpText() {
  if (!state.icp) return '';
  return ICP_FIELDS.filter(([k]) => state.icp[k]).map(([k, l]) => `${l}: ${state.icp[k]}`).join('\n');
}
function renderIcp(editing = false) {
  const has = state.icp && state.icp.niche;
  $('#icpForm').classList.toggle('hidden', !editing);
  $('#icpView').classList.toggle('hidden', editing);
  $('#editIcp').classList.toggle('hidden', editing);
  if (editing) {
    const f = $('#icpForm');
    for (const [k] of ICP_FIELDS) f.elements[k].value = state.icp?.[k] || '';
    f.elements.niche.focus();
    return;
  }
  $('#icpView').innerHTML = has
    ? `<div class="icp-grid">${ICP_FIELDS.filter(([k]) => state.icp[k]).map(([k, l]) => `<div class="icp-item"><span>${l}</span><p>${esc(state.icp[k])}</p></div>`).join('')}</div>`
    : `<div class="empty">ابدأ هنا: عرّف عميلك المثالي مرة واحدة، وكل دراسة ومحتوى بعدها يُبنى عليه.</div>`;
}
$('#editIcp').onclick = () => renderIcp(true);
$('#cancelIcp').onclick = () => renderIcp(false);
$('#icpForm').onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  state.icp = Object.fromEntries(ICP_FIELDS.map(([k]) => [k, f.elements[k].value.trim()]));
  if (!state.icp.niche) return toast('اكتب مجالك على الأقل', true);
  save(); renderIcp(false); toast('حُفظ العميل المثالي');
};
function requireIcp() {
  if (state.icp?.niche) return true;
  toast('عرّف عميلك المثالي أولًا', true);
  renderIcp(true);
  return false;
}

/* ---------- الدراسة ---------- */
const RESEARCH_SYSTEM = `أنت محلل نمو متخصص في X وInstagram وTikTok للسوق العربي والخليجي.
مهمتك: اكتشاف أنماط المحتوى الأكثر انتشارًا والأسرع في تحقيق النمو حاليًا في مجال المستخدم، ثم تصفيتها بعدسة العميل المثالي.
قواعد:
- الانتشار الذي يجلب جمهورًا غير العميل المثالي ليس نموًا. قيّم كل نمط بمدى جذبه للعميل المثالي تحديدًا (icp_fit من 0 إلى 100).
- ركّز على إشارات النمو الحقيقية: الحفظ، المشاركة، الإرسال في الخاص، المتابعات الناتجة عن المنشور، معدل الإكمال في الفيديو — لا الإعجابات وحدها.
- ابحث عن أمثلة وتقارير حديثة (آخر ٩٠ يومًا قدر الإمكان) عن تغيّرات الخوارزميات والصيغ الرائجة في المجال.
- لا تخترع أرقامًا أو حسابات. إن لم تجد دليلًا كافيًا فاذكر ذلك واجعل confidence = "low".
- إن أعطاك المستخدم منشورات بأرقامها فهي أقوى دليل: احسب النسب (حفظ/مشاهدة، مشاركة/مشاهدة، متابع/مشاهدة) واستخرج ما يميّز الأعلى.
- اكتب بالعربية، مختصرًا ومحددًا وقابلًا للتنفيذ.
أعد الرد كائن JSON واحدًا فقط، بلا أي نص قبله أو بعده، بهذا الشكل:
{"summary":"خلاصة في جملتين","platforms":[{"platform":"x|instagram|tiktok","patterns":[{"name":"","format":"","why_it_spreads":"","growth_signal":"","icp_fit":0,"confidence":"high|medium|low","hook_example":""}],"avoid":[""]}],"own_data_insights":[""],"next_moves":[""]}
لكل منصة من ٣ إلى ٥ أنماط مرتّبة من الأقوى.`;

async function runResearch() {
  if (!requireIcp()) return;
  const btn = $('#runResearch'), out = $('#researchOut');
  const plats = state.ui.researchPlatforms;
  const own = $('#ownData').value.trim();
  const search = state.settings.webSearch;
  btn.disabled = true;
  out.innerHTML = spinner(search ? 'يبحث ويحلّل… قد يستغرق دقيقة أو اثنتين' : 'يحلّل…');
  try {
    const user = `العميل المثالي:\n${icpText()}\n\nالمنصات المطلوبة: ${plats.map((p) => PLATFORMS[p].name).join('، ')}\nتاريخ اليوم: ${new Date().toISOString().slice(0, 10)}\n\n${own ? `بياناتي (أقوى دليل):\n${own}` : 'لا توجد بيانات خاصة — اعتمد على البحث.'}`;
    const r = await claude({ system: RESEARCH_SYSTEM, user, search });
    if (!r.json) throw new Error('لم يصل الرد بالشكل المتوقع. أعد المحاولة.');
    state.research = { ...r.json, sources: r.sources.slice(0, 12), at: Date.now(), selected: plats };
    save(); renderResearch();
    toast('اكتملت الدراسة');
  } catch (e) {
    out.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

function renderResearch() {
  const r = state.research, out = $('#researchOut');
  $('#researchDate').textContent = r ? `آخر دراسة: ${fmtDate(r.at)}` : '';
  if (!r) { out.innerHTML = ''; return; }
  const plats = (r.platforms || []).filter((p) => p && typeof p === 'object');
  out.innerHTML = `<div class="out">
    ${r.summary ? `<div class="insight">${esc(r.summary)}</div>` : ''}
    ${plats.map((p) => `<div class="plat">
      <div class="plat-head">${pBadge(p.platform)}</div>
      ${(p.patterns || []).map((t) => `<div class="pattern">
        <div class="pattern-top"><h3>${esc(t.name)}</h3><span>${fitBadge(t.icp_fit)}</span></div>
        <p>${esc(t.format)} · <span class="muted">${esc(confLabel[t.confidence] || '')}</span></p>
        <p>${esc(t.why_it_spreads)}</p>
        <p><b>إشارة النمو:</b> ${esc(t.growth_signal)}</p>
        ${t.hook_example ? `<p class="hook">« ${esc(t.hook_example)} »</p>` : ''}
      </div>`).join('')}
      ${p.avoid?.length ? `<p class="small muted" style="margin-top:.5rem">تجنّب:</p><ul class="list">${p.avoid.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    </div>`).join('')}
    ${r.own_data_insights?.filter(Boolean).length ? `<div><h3>من بياناتك</h3><ul class="list">${r.own_data_insights.filter(Boolean).map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${r.next_moves?.filter(Boolean).length ? `<div><h3>الخطوات التالية</h3><ul class="list">${r.next_moves.filter(Boolean).map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
    ${r.sources?.length ? `<div class="sources">المصادر: ${r.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title).slice(0, 60)}</a>`).join('')}</div>` : ''}
  </div>`;
}

/* ---------- التوليد ---------- */
const PIECE = {
  type: 'object',
  additionalProperties: false,
  required: ['platform', 'format', 'hook', 'body', 'cta', 'hashtags', 'pattern_used', 'icp_reason', 'growth_lever', 'score', 'best_time'],
  properties: {
    platform: { type: 'string', enum: ALL },
    format: { type: 'string', description: 'تغريدة / ثريد / كاروسيل / ريل / فيديو تيك توك…' },
    hook: { type: 'string', description: 'أول سطر أو أول ٣ ثوانٍ' },
    body: { type: 'string', description: 'المحتوى كاملًا جاهزًا للنشر: نص التغريدة أو الثريد مرقّمًا، أو شرائح الكاروسيل، أو سكربت الفيديو بمشاهده ونص الشاشة' },
    cta: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
    pattern_used: { type: 'string', description: 'النمط من الدراسة الذي بُني عليه' },
    icp_reason: { type: 'string', description: 'لماذا يجذب العميل المثالي تحديدًا ويصدّ غيره' },
    growth_lever: { type: 'string', description: 'رافعة النمو: حفظ، مشاركة، تعليق، متابعة…' },
    score: { type: 'integer', description: 'تقدير من 0 إلى 100 لاحتمال النمو المؤهَّل' },
    best_time: { type: 'string' },
  },
};
const GEN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['pieces'],
  properties: { pieces: { type: 'array', items: PIECE } },
};
const GOALS = {
  growth: 'نمو: جذب متابعين جدد من العميل المثالي تحديدًا — أولوية للمشاركة والحفظ والمتابعة.',
  trust: 'ثقة: بناء السلطة والخبرة لدى العميل المثالي — أولوية للحفظ والتعليقات العميقة.',
  convert: 'تحويل: تحريك العميل المثالي نحو طلب أو تواصل — دعوة واضحة غير مبتذلة.',
};
const GEN_SYSTEM = `أنت كاتب محتوى ومخطط نمو لمنصات X وInstagram وTikTok.
اكتب محتوى جاهزًا للنشر فورًا، بلهجة ونبرة المستخدم، موجّهًا لعميله المثالي وحده.
قواعد:
- كل قطعة مبنية على نمط مثبت من الدراسة إن وُجدت، واذكر النمط.
- الخطّاف أهم سطر: محدد، يلمس ألم العميل المثالي أو رغبته، بلا تهويل أو وعود كاذبة.
- اكتب لكل منصة بأسلوبها: X مختصر وحاد (ثريد مرقّم عند الحاجة، دون ٢٨٠ حرفًا للتغريدة الواحدة)، Instagram كاروسيل بشرائح مرقّمة أو ريل بنص شاشة + كابشن، TikTok سكربت بالثواني مع نص الشاشة والمشهد.
- لا تكتب محتوى يجذب جمهورًا واسعًا غير مناسب على حساب العميل المثالي.
- لا تنسخ محتوى أحد. لا هاشتاقات كثيرة: ٣ إلى ٥ دقيقة.
- كن صادقًا في score: لا تعطِ كل القطع درجات عالية.`;

async function runGen() {
  if (!requireIcp()) return;
  const btn = $('#runGen'), out = $('#genOut');
  const plats = state.ui.genPlatforms;
  const count = Number($('#count').value);
  const goal = $('#goal').value;
  const topic = $('#topic').value.trim();
  btn.disabled = true;
  out.innerHTML = spinner('يكتب…');
  try {
    const r = state.research;
    const research = r ? JSON.stringify({ summary: r.summary, platforms: r.platforms, next_moves: r.next_moves }) : 'لا توجد دراسة بعد — اعتمد على أفضل الممارسات الحالية التي تعرفها.';
    const recent = state.library.slice(0, 15).map((p) => `- ${p.hook}`).join('\n');
    const user = `العميل المثالي:\n${icpText()}\n\nالهدف: ${GOALS[goal]}\nالمنصات: ${plats.map((p) => PLATFORMS[p].name).join('، ')}\nالعدد: ${count} قطع لكل منصة\n${topic ? `الموضوع: ${topic}` : 'اختر أقوى المواضيع للعميل المثالي.'}\n\nخلاصة الدراسة:\n${research}\n${recent ? `\nمحتوى سبق حفظه — لا تكرّره:\n${recent}` : ''}`;
    const res = await claude({ system: GEN_SYSTEM, user, schema: GEN_SCHEMA });
    const pieces = res.json?.pieces;
    if (!Array.isArray(pieces) || !pieces.length) throw new Error('لم يصل محتوى. أعد المحاولة.');
    state.generated = pieces.map((p) => ({ ...p, id: crypto.randomUUID(), at: Date.now(), goal }));
    save(); renderGenerated();
  } catch (e) {
    out.innerHTML = `<div class="error-box">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

function pieceHTML(p, inLibrary) {
  const tags = (p.hashtags || []).map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ');
  return `<article class="piece" data-id="${p.id}">
    <div class="piece-head">${pBadge(p.platform)}<span class="badge">${esc(p.format)}</span>${p.best_time ? `<span class="small muted">${esc(p.best_time)}</span>` : ''}<span class="score">${Number(p.score) || 0}</span></div>
    <div class="piece-body">
      <div class="hook">${esc(p.hook)}</div>
      <div class="text">${esc(p.body)}</div>
      ${p.cta ? `<div class="cta">← ${esc(p.cta)}</div>` : ''}
      ${tags ? `<div class="tags">${esc(tags)}</div>` : ''}
      <div class="why">
        <div><b>لماذا للعميل المثالي</b>${esc(p.icp_reason)}</div>
        <div><b>رافعة النمو · النمط</b>${esc(p.growth_lever)} · ${esc(p.pattern_used)}</div>
      </div>
    </div>
    <div class="piece-actions">
      <button class="btn sm" data-act="copy">نسخ</button>
      ${inLibrary ? `<button class="btn sm danger" data-act="del">حذف</button>` : `<button class="btn sm" data-act="save">حفظ</button>`}
    </div>
  </article>`;
}
function renderGenerated() {
  const g = state.generated;
  $('#genOut').innerHTML = g.length ? `<div class="pieces">${g.map((p) => pieceHTML(p, false)).join('')}</div>` : '';
}
function renderLibrary() {
  const f = state.ui.libFilter;
  const items = state.library.filter((p) => f === 'all' || p.platform === f);
  $('#libCount').textContent = state.library.length;
  $('#libOut').innerHTML = items.length
    ? `<div class="pieces">${items.map((p) => pieceHTML(p, true)).join('')}</div>`
    : `<div class="empty">لا شيء محفوظ بعد. احفظ ما يعجبك من اللوحة.</div>`;
}
function copyText(p) {
  const tags = (p.hashtags || []).map((t) => (t.startsWith('#') ? t : '#' + t)).join(' ');
  return [p.hook, '', p.body, p.cta ? '\n' + p.cta : '', tags ? '\n' + tags : ''].join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('.piece').dataset.id;
  const p = state.generated.find((x) => x.id === id) || state.library.find((x) => x.id === id);
  if (!p) return;
  if (b.dataset.act === 'copy') {
    try { await navigator.clipboard.writeText(copyText(p)); toast('نُسخ'); } catch { toast('تعذّر النسخ', true); }
  } else if (b.dataset.act === 'save') {
    if (!state.library.some((x) => x.id === id)) state.library.unshift(p);
    save(); renderLibrary(); b.textContent = 'محفوظ ✓'; b.disabled = true;
  } else if (b.dataset.act === 'del') {
    state.library = state.library.filter((x) => x.id !== id);
    save(); renderLibrary();
  }
});

/* ---------- الإعدادات ---------- */
const dlg = $('#settings');
function openSettings() {
  const f = $('#settingsForm');
  f.elements.apiKey.value = getKey();
  f.elements.model.value = state.settings.model;
  f.elements.effort.value = state.settings.effort;
  f.elements.remember.checked = state.settings.remember;
  f.elements.webSearch.checked = state.settings.webSearch;
  dlg.showModal();
}
$('#openSettings').onclick = openSettings;
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') return;
  const f = $('#settingsForm');
  state.settings = {
    model: f.elements.model.value.trim() || 'claude-opus-5-5',
    effort: f.elements.effort.value,
    remember: f.elements.remember.checked,
    webSearch: f.elements.webSearch.checked,
  };
  setKey(f.elements.apiKey.value.trim(), state.settings.remember);
  save(); toast('حُفظت الإعدادات');
});
$('#wipe').onclick = () => {
  if (!confirm('سيُمحى العميل المثالي والدراسات والمكتبة والمفتاح من هذا المتصفح. متأكد؟')) return;
  try { localStorage.removeItem(KEY); } catch { /* تجاهل */ }
  setKey('', false);
  location.reload();
};

/* ---------- التبويبات والتشغيل ---------- */
$$('.top .tab').forEach((t) => t.onclick = () => {
  $$('.top .tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#tab-board').classList.toggle('hidden', t.dataset.tab !== 'board');
  $('#tab-library').classList.toggle('hidden', t.dataset.tab !== 'library');
});
$('#runResearch').onclick = runResearch;
$('#runGen').onclick = runGen;

chips('#researchPlatforms', 'researchPlatforms');
chips('#genPlatforms', 'genPlatforms');
chips('#libFilter', 'libFilter', { single: true, withAll: true });
renderIcp(false);
renderResearch();
renderGenerated();
renderLibrary();
if (!getKey()) setTimeout(() => toast('ابدأ بإضافة مفتاح API من ⚙'), 600);
