// أدوات الواجهة المشتركة: تنسيق، أيقونات، شارات، نوافذ، إشعارات، ورقة الخطاب الرسمية.
(function (A) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  A.esc = esc;

  // سجل المسارات — تملؤه ملفات الشاشات ويقرؤه app.js
  A.routes = [];
  A.route = (pattern, view) => A.routes.push({ pattern, view });

  // ───── تنسيق ─────
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  A.num = (n) => nf.format(Math.round((n || 0) * 100) / 100);
  A.money = (n) => A.num(n) + ' ر.س';
  const toDate = (v) => (v instanceof Date ? v : new Date(String(v).length <= 10 ? v + 'T12:00:00' : v));
  const fmt = (opts) => new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', opts);
  const hfmt = (opts) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', opts);
  A.gdate = (v) => (v ? fmt({ year: 'numeric', month: 'short', day: 'numeric' }).format(toDate(v)) : '—');
  A.gdateNum = (v) => (v ? fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(toDate(v)) : '—');
  A.hdate = (v) => (v ? hfmt({ year: 'numeric', month: 'long', day: 'numeric' }).format(toDate(v)) : '—');
  A.hyear = () => new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric' }).format(new Date()).replace(/\D/g, '');
  A.time = (v) => (v ? new Intl.DateTimeFormat('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }).format(toDate(v)) : '—');
  A.dt = (v) => (v ? A.gdate(v) + ' — ' + A.time(v) : '—');
  A.diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 864e5);
  A.daysLeft = (d) => (d ? A.diffDays(A.todayISO(), d) : null);
  A.yearsOfService = (hire, end) => A.diffDays(hire, end || A.todayISO()) / 365;
  A.serviceText = (years) => {
    const y = Math.floor(years), m = Math.floor((years - y) * 12);
    return (y ? y + ' سنة' : '') + (y && m ? ' و' : '') + (m ? m + ' شهر' : '') || 'أقل من شهر';
  };
  A.initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join(' ');
  A.uid = (p) => p + (++A.state.seq);

  // ───── مراجع البيانات ─────
  A.emp = (id) => A.state.employees.find((e) => e.id === id);
  A.empName = (id) => (A.emp(id) || {}).name || '—';
  A.dept = (id) => A.state.departments.find((d) => d.id === id);
  A.deptName = (id) => (A.dept(id) || {}).name || id;
  A.letter = (id) => A.state.letters.find((l) => l.id === id);
  A.user = (empId) => A.state.users.find((u) => u.empId === empId);
  A.can = (perm) => ((A.user(A.state.currentUserId) || {}).perms || []).includes(perm);
  A.wage = (e) => e.basic + e.housing + e.transport + e.other;

  // ───── أيقونات (SVG مضمّنة) ─────
  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    wallet: '<rect x="2" y="5" width="20" height="15" rx="2"/><path d="M2 10h20"/><path d="M16 15h2"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    flow: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a3 3 0 0 0 3 3h6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    print: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
    clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    back: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h8"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  };
  A.icon = (name, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.file}</svg>`;

  // ───── مكوّنات صغيرة ─────
  A.badge = (text, tone = 'gray') => `<span class="badge ${tone}">${esc(text)}</span>`;
  A.statusBadge = (s) => { const [t, c] = A.STATUS[s] || [s, 'gray']; return A.badge(t, c); };
  A.priorityBadge = (p) => (p === 'عادي' ? '<span class="muted small">عادي</span>' : A.badge(p, p === 'عاجل جداً' ? 'red' : 'amber'));
  A.avatar = (name) => `<span class="avatar">${esc(A.initials(name || '؟'))}</span>`;
  A.options = (items, selected) =>
    items.map((it) => {
      const [v, t] = Array.isArray(it) ? it : [it, it];
      return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(t)}</option>`;
    }).join('');
  A.kpi = ({ label, value, sub = '', tone = '', href = '', icon = '' }) => {
    const tag = href ? 'a' : 'div';
    return `<${tag} class="card kpi ${tone}" ${href ? `href="${href}"` : ''}>
      <div class="lbl">${icon ? A.icon(icon) : ''}${esc(label)}</div>
      <div class="val">${value}</div>
      ${sub ? `<div class="sub">${sub}</div>` : ''}
    </${tag}>`;
  };
  A.empty = (text) => `<div class="empty">${esc(text)}</div>`;
  A.paragraphs = (text) =>
    String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  // ───── نافذة حوار ─────
  A.modal = ({ title, body, actions = [], wide = false, onMount }) => {
    const root = document.getElementById('modal-root');
    const el = document.createElement('div');
    el.className = 'overlay';
    el.innerHTML = `<div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="dialog-head"><h2>${esc(title)}</h2><button class="x-btn" data-x aria-label="إغلاق">${A.icon('x')}</button></div>
      <div class="dialog-body">${body}</div>
      ${actions.length ? `<div class="dialog-foot">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-a="${i}">${a.icon ? A.icon(a.icon) : ''}${esc(a.label)}</button>`).join('')}</div>` : ''}
    </div>`;
    const close = () => { el.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.closest('[data-x]')) return close();
      const b = e.target.closest('[data-a]');
      if (b) {
        const a = actions[+b.dataset.a];
        const keep = a.onClick ? a.onClick(el.querySelector('.dialog-body'), close) : undefined;
        if (keep !== false) close();
      }
    });
    root.appendChild(el);
    if (onMount) onMount(el.querySelector('.dialog-body'));
    const first = el.querySelector('input, select, textarea');
    if (first) first.focus();
    return close;
  };

  A.confirm = (title, text, label, onYes, kind = 'primary') =>
    A.modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label, kind, onClick: onYes }, { label: 'إلغاء' }] });

  A.toast = (text, icon = 'check') => {
    const root = document.getElementById('toast-root');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = A.icon(icon) + '<span>' + esc(text) + '</span>';
    root.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  };

  // قراءة صورة مرفوعة وتصغيرها قبل حفظها (يبقي التخزين المحلي خفيفاً)
  A.readImage = (file, max = 600) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('type'));
    const r = new FileReader();
    r.onerror = reject;
    r.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });

  A.download = (filename, content, type = 'text/csv;charset=utf-8') => {
    const blob = new Blob(['﻿' + content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // ───── ورقة الخطاب الرسمية ─────
  // مولّد أرقام ثابت لكل نص — يجعل التوقيع التجريبي ورمز التحقق ثابتين لنفس الخطاب
  const seedOf = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
  const rng = (str) => { let h = seedOf(str); return (a, b) => { h = (Math.imul(h, 1103515245) + 12345) >>> 0; return a + ((h >>> 8) % 1000) / 1000 * (b - a); }; };
  const f1 = (n) => n.toFixed(1);

  // رمز تحقق شكلي (يُستبدل لاحقاً برمز QR حقيقي يتحقق من أصالة الخطاب)
  const qr = (seed) => {
    const N = 21, r = rng(seed);
    const finder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([fx, fy]) => {
      const dx = x - fx, dy = y - fy;
      if (dx < -1 || dy < -1 || dx > 7 || dy > 7) return false;
      return true;
    });
    const finderOn = (x, y) => {
      for (const [fx, fy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
        const dx = x - fx, dy = y - fy;
        if (dx >= 0 && dy >= 0 && dx < 7 && dy < 7) return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
      }
      return false;
    };
    let cells = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const on = finder(x, y) ? finderOn(x, y) : (y === 6 || x === 6) ? (x + y) % 2 === 0 : r(0, 1) < 0.47;
      if (on) cells += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    }
    return `<svg class="qr" viewBox="-1 -1 ${N + 2} ${N + 2}" fill="#000" shape-rendering="crispEdges">${cells}</svg>`;
  };

  A.logoChar = () => ((A.state.settings.companyAr.split(' ')[1] || 'ش').replace(/^ال/, '')[0] || 'ش');
  A.logoHtml = () => (A.state.settings.logo ? `<img class="lh-logo-img" src="${A.state.settings.logo}" alt="">` : `<div class="lh-logo">${esc(A.logoChar())}</div>`);


  // توقيع: الصورة المرفوعة لصاحب الصلاحية، وإلا توقيع تجريبي مولّد من اسمه
  A.signatureHtml = (empId) => {
    const u = A.user(empId);
    if (u && u.signature) return `<img class="sig-img" src="${u.signature}" alt="توقيع">`;
    const r = rng(A.empName(empId));
    let x = 10, d = `M ${x} ${f1(r(26, 38))}`;
    while (x < 140) { const nx = x + r(14, 28); d += ` C ${f1(x + r(3, 10))} ${f1(r(4, 56))}, ${f1(nx - r(3, 10))} ${f1(r(4, 56))}, ${f1(nx)} ${f1(r(20, 42))}`; x = nx; }
    d += ` M ${f1(r(14, 30))} ${f1(r(46, 52))} Q ${f1(r(70, 100))} ${f1(r(54, 62))} ${f1(r(145, 158))} ${f1(r(38, 46))}`;
    return `<svg class="sig-img" viewBox="0 0 170 64" aria-label="توقيع"><path d="${d}" fill="none" stroke="#1f3b73" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  };

  // ختم الشركة: الصورة المرفوعة من الإعدادات، وإلا ختم دائري مولّد من بيانات الشركة
  let sealSeq = 0;
  A.sealHtml = () => {
    const s = A.state.settings;
    if (s.seal) return `<img class="seal-img" src="${s.seal}" alt="ختم الشركة">`;
    const id = 'seal' + (++sealSeq), c = '#1d4e89';
    return `<svg class="seal-img" viewBox="0 0 120 120" aria-label="ختم الشركة">
      <defs><path id="${id}" d="M 17 60 A 43 43 0 1 1 103 60"/></defs>
      <circle cx="60" cy="60" r="57" fill="none" stroke="${c}" stroke-width="2.4"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="${c}" stroke-width="0.8"/>
      <circle cx="60" cy="60" r="30" fill="none" stroke="${c}" stroke-width="1"/>
      <text fill="${c}" font-family="Arial" font-size="9.5" font-weight="bold"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(s.companyAr)}</textPath></text>
      <text x="60" y="58" fill="${c}" font-family="Arial" font-size="8.5" font-weight="bold" text-anchor="middle">الختم الرسمي</text>
      <text x="60" y="70" fill="${c}" font-family="Arial" font-size="7" text-anchor="middle">س.ت ${esc(s.cr)}</text>
      <text x="60" y="100" fill="${c}" font-family="Arial" font-size="8" text-anchor="middle">★ ★ ★</text>
    </svg>`;
  };

  A.paper = (l) => {
    const s = A.state.settings;
    const issued = !!l.number && l.type !== 'incoming';
    const lastStep = l.steps && l.steps.length ? l.steps[l.steps.length - 1] : null;
    const signerId = lastStep ? lastStep.userId : A.state.workflows[l.type]?.slice(-1)[0];
    const signer = A.emp(signerId);
    const deptList = (l.toDepts || []).map(A.deptName);
    const allDepts = (l.toDepts || []).length === A.state.departments.length;
    const v = (x, ph) => (x ? `<span class="v">${esc(x)}</span>` : `<span class="pending">${ph}</span>`);
    const metaBox = (rows) => `<table class="lh-meta">${rows.map(([k, val]) => `<tr><td class="k">${k}</td><td>${val}</td></tr>`).join('')}</table>`;
    const stamps = (l.classification && l.classification !== 'عادي' ? `<span class="stamp-tag red">${esc(l.classification)}</span>` : '') +
      (l.priority && l.priority !== 'عادي' ? `<span class="stamp-tag amber">${esc(l.priority)}</span>` : '');

    if (l.type === 'incoming') {
      return `<div class="paper">
        <div class="lh">
          <div class="lh-side lh-stamps">${stamps}</div>
          <div class="lh-center"><div class="lh-logo">${A.icon('building')}</div><div class="lh-name">${esc(l.fromEntity)}</div><div class="lh-sub">جهة خارجية</div></div>
          <div class="lh-side">${metaBox([['رقم الجهة:', v(l.externalRef, '—')], ['قيد الوارد:', v(l.number, '—')], ['الاستلام:', v(A.hdate(l.receivedAt), '')]])}</div>
        </div>
        <div class="p-to"><span>السادة / ${esc(s.companyAr)}</span><span>المحترمين</span></div>
        <div class="mt-s">السلام عليكم ورحمة الله وبركاته، وبعد:</div>
        <div class="p-subject">الموضوع: <span>${esc(l.subject)}</span></div>
        <div class="p-body">${A.paragraphs(l.body)}</div>
        <div class="p-close">وتقبلوا تحياتنا،،،</div>
        <div class="p-foot"><div class="p-foot-info"><span>صورة ضوئية من الأصل — مسجّلة في نظام المراسلات</span></div></div>
      </div>`;
    }

    let title = '', to = '', opening = '', closing = 'وتقبلوا خالص التحية والتقدير،،،';
    if (l.type === 'external') {
      to = `<div class="p-to"><span>سعادة / ${esc(l.toEntity || '...')}</span><span>المحترمين</span></div>`;
      opening = '<div class="mt-s">السلام عليكم ورحمة الله وبركاته، وبعد:</div>';
    } else if (l.type === 'internal') {
      to = `<div class="p-to"><span>المكرم / مدير ${deptList.length > 1 ? 'إدارات: ' + esc(deptList.join('، ')) : esc(deptList[0] || '...')}</span><span>المحترم</span></div>`;
      opening = '<div class="mt-s">السلام عليكم ورحمة الله وبركاته، وبعد:</div>';
    } else if (l.type === 'decision') {
      title = `<div class="p-title">قرار إداري${issued ? ' رقم (' + esc(l.number) + ')' : ''}</div>`;
      opening = `<p>إن ${esc(signer ? signer.job : 'المدير العام')}، بناءً على الصلاحيات المخولة له، وبناءً على ما تقتضيه مصلحة العمل، يقرر ما يلي:</p>`;
      closing = '';
    } else if (l.type === 'circular') {
      title = `<div class="p-title">تعميم</div>`;
      to = `<div class="p-to"><span>إلى / ${allDepts || !deptList.length ? 'جميع منسوبي الشركة' : 'منسوبي ' + esc(deptList.join('، '))}</span><span>المحترمين</span></div>`;
      opening = '<div class="mt-s">السلام عليكم ورحمة الله وبركاته، وبعد:</div>';
      closing = 'شاكرين للجميع حسن التعاون،،،';
    } else if (l.type === 'report') {
      title = `<div class="p-title">تقرير</div>`;
      to = `<div class="p-to"><span>${deptList.includes('الإدارة العامة') ? 'سعادة المدير العام' : 'المكرم / مدير ' + esc(deptList[0] || '...')}</span><span>المحترم</span></div>`;
      opening = '<div class="mt-s">السلام عليكم ورحمة الله وبركاته، وبعد:</div>';
    }

    const ccDepts = (l.ccDepts || []).map(A.deptName);

    return `<div class="paper ${issued ? '' : 'draft-wm'}">
      <div class="lh">
        <div class="lh-side lh-stamps">${stamps}</div>
        <div class="lh-center">${A.logoHtml()}<div class="lh-name">${esc(s.companyAr)}</div></div>
        <div class="lh-side">${metaBox([
          ['الرقم:', v(l.number, 'عند الإصدار')],
          ['التاريخ:', v(issued ? A.hdate(l.issuedAt) : '', 'عند الإصدار')],
          ['الموافق:', v(issued ? A.gdate(l.issuedAt) + 'م' : '', '—')],
          ['المرفقات:', v(l.attachments && l.attachments.length ? l.attachments.length + ' مرفق' : 'لا يوجد', '')],
        ])}</div>
      </div>
      ${title}
      ${to}
      ${opening}
      ${l.type === 'decision' ? '' : `<div class="p-subject">الموضوع: <span>${esc(l.subject || '...')}</span></div>`}
      <div class="p-body">${l.body ? A.paragraphs(l.body) : '<p class="muted">نص المعاملة…</p>'}</div>
      ${closing ? `<div class="p-close">${closing}</div>` : ''}
      <div class="p-sign"><div class="box">
        <div class="ttl">${esc(signer ? signer.job : '')}</div>
        <div class="sig-area">${issued ? A.signatureHtml(signerId) + A.sealHtml() : '<span class="await">يظهر التوقيع والختم عند اكتمال الاعتماد</span>'}</div>
        <div class="nm">${esc(signer ? signer.name : '')}</div>
      </div></div>
      ${ccDepts.length ? `<div class="p-cc">صورة مع التحية لـ: ${esc(ccDepts.join('، '))}</div>` : ''}
      <div class="p-foot">
        <div class="p-foot-info">
          <span>${esc(s.address)}</span>
          <span>هاتف: <span class="ltr">${esc(s.phone)}</span> — البريد: <span class="ltr">${esc(s.email)}</span></span>
          <span>السجل التجاري: ${esc(s.cr)} — الرقم الضريبي: ${esc(s.vat)}</span>
        </div>
        ${issued ? `<div class="p-foot-qr">${qr(l.number)}<span>امسح للتحقق</span></div>` : ''}
      </div>
    </div>`;
  };
})(window.APP);
