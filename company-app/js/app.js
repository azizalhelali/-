// الهيكل: الحالة، التوجيه، العمود الجانبي، الشريط العلوي، البحث.
(function (A) {
  const KEY = 'company-proto-v1';
  const load = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
  A.state = load() || A.seed();
  A.save = () => { try { localStorage.setItem(KEY, JSON.stringify(A.state)); } catch (e) { /* التخزين غير متاح — تبقى البيانات في الذاكرة */ } };
  A.resetData = () => { A.state = A.seed(); A.save(); A.render(); A.toast('أُعيدت البيانات التجريبية'); };
  A.me = () => A.emp(A.state.currentUserId);

  // ───── عدّادات القائمة ─────
  A.myPending = () => A.state.letters.filter((l) => l.status === 'review' && (A.currentStep(l) || {}).userId === A.state.currentUserId);
  A.myInbox = () => {
    const me = A.me();
    return A.state.letters.filter((l) =>
      (l.type === 'incoming' && l.status === 'incoming' && l.assignedDept === me.dept) ||
      (l.status === 'sent' && l.recipientKind === 'internal' && (l.toDepts || []).includes(me.dept) && l.fromDept !== me.dept));
  };
  A.unread = (l) => !(l.readBy || []).includes(A.state.currentUserId);

  const NAV = [
    { label: 'الرئيسية', href: '#/dashboard', icon: 'home' },
    {
      group: 'corr', label: 'المراسلات', icon: 'mail', items: [
        { label: 'إنشاء معاملة', href: '#/corr/new', icon: 'plus', match: ['/corr/new', '/corr/edit'] },
        { label: 'بانتظار اعتمادي', href: '#/corr/pending', icon: 'clock', count: () => A.myPending().length },
        { label: 'الوارد', href: '#/corr/inbox', icon: 'inbox', count: () => A.myInbox().filter(A.unread).length },
        { label: 'مسوداتي', href: '#/corr/drafts', icon: 'edit', count: () => A.state.letters.filter((l) => l.createdBy === A.state.currentUserId && ['draft', 'returned'].includes(l.status)).length, muted: true },
        { label: 'متابعة الاعتماد', href: '#/corr/tracking', icon: 'flow' },
        { label: 'الصادر', href: '#/corr/outgoing', icon: 'send' },
        { label: 'الأرشيف', href: '#/corr/archive', icon: 'archive', match: ['/corr/archive', '/corr/view'] },
      ],
    },
    {
      group: 'hr', label: 'شؤون الموظفين', icon: 'users', items: [
        { label: 'لوحة الموارد البشرية', href: '#/hr', icon: 'chart' },
        { label: 'الموظفون', href: '#/hr/employees', icon: 'users', match: ['/hr/employees', '/hr/employee'] },
        { label: 'الحضور والانصراف', href: '#/hr/attendance', icon: 'clock' },
        { label: 'الإجازات', href: '#/hr/leaves', icon: 'calendar', count: () => A.state.leaves.filter((x) => x.status === 'pending').length, muted: true },
        { label: 'مسير الرواتب', href: '#/hr/payroll', icon: 'wallet' },
        { label: 'العقود والوثائق', href: '#/hr/contracts', icon: 'file' },
        { label: 'طلبات الموظفين', href: '#/hr/requests', icon: 'inbox', count: () => A.state.requests.filter((x) => x.status === 'pending').length, muted: true },
        { label: 'المخالفات والجزاءات', href: '#/hr/violations', icon: 'alert' },
        { label: 'مكافأة نهاية الخدمة', href: '#/hr/eos', icon: 'calc' },
        { label: 'التوطين (نطاقات)', href: '#/hr/saudization', icon: 'flag' },
        { label: 'مرجع نظام العمل', href: '#/hr/policy', icon: 'book' },
      ],
    },
    {
      group: 'settings', label: 'الإعدادات', icon: 'settings', items: [
        { label: 'مسارات الاعتماد', href: '#/settings/workflows', icon: 'flow' },
        { label: 'المستخدمون والصلاحيات', href: '#/settings/users', icon: 'shield' },
        { label: 'الهيكل التنظيمي', href: '#/settings/org', icon: 'building' },
        { label: 'الترويسة والترقيم', href: '#/settings/letterhead', icon: 'file' },
      ],
    },
  ];

  const closedGroups = (() => { try { return JSON.parse(localStorage.getItem(KEY + ':nav') || '[]'); } catch (e) { return []; } })();

  const isActive = (item, path) => {
    if (!item.match) return path === item.href.slice(1).split('?')[0];
    return item.match.some((m) => path === m || path.startsWith(m + '/'));
  };

  function renderSidebar(path) {
    const el = document.getElementById('sidebar');
    const link = (it) => {
      const n = it.count ? it.count() : 0;
      return `<a class="nav-item ${isActive(it, path) ? 'active' : ''}" href="${it.href}">${A.icon(it.icon)}<span>${A.esc(it.label)}</span>${n ? `<span class="count ${it.muted ? 'muted' : ''}">${n}</span>` : ''}</a>`;
    };
    const me = A.me();
    el.innerHTML = `
      <div class="brand"><div class="brand-mark">${A.esc(A.logoChar())}</div><div><div class="brand-name">الإدارة الداخلية</div><div class="brand-sub">${A.esc(A.state.settings.companyAr)}</div></div></div>
      <nav class="nav">
        ${NAV.map((n) => n.group
          ? `<div class="nav-group ${closedGroups.includes(n.group) ? 'closed' : ''}" data-g="${n.group}">
              <button class="nav-group-head" data-toggle="${n.group}">${A.icon(n.icon)}<span>${A.esc(n.label)}</span>${A.icon('chev', 'chev')}</button>
              <div class="nav-sub">${n.items.map(link).join('')}</div>
            </div>`
          : link(n)).join('')}
      </nav>
      <div class="side-foot">
        <label for="as-user">الدخول بصفة (للتجربة)</label>
        <select class="input" id="as-user">${A.options(A.state.users.map((u) => [u.empId, A.empName(u.empId) + ' — ' + A.emp(u.empId).job]), me.id)}</select>
        <div class="hint">بدّل المستخدم لتجربة رحلة الاعتماد من منظور كل صاحب صلاحية.</div>
      </div>`;
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
      const g = b.dataset.toggle, box = b.parentElement;
      box.classList.toggle('closed');
      const i = closedGroups.indexOf(g);
      if (i >= 0) closedGroups.splice(i, 1); else closedGroups.push(g);
      try { localStorage.setItem(KEY + ':nav', JSON.stringify(closedGroups)); } catch (e) { /* تجاهل */ }
    }));
    el.querySelector('#as-user').addEventListener('change', (e) => {
      A.state.currentUserId = e.target.value;
      A.save();
      A.render();
      A.toast('أنت الآن: ' + A.empName(e.target.value), 'user');
    });
  }

  function renderTopbar(view) {
    const el = document.getElementById('topbar');
    const me = A.me();
    const alerts = A.myPending().length + A.myInbox().filter(A.unread).length;
    el.innerHTML = `
      <button class="top-icon menu-btn" id="menu-btn" aria-label="القائمة">${A.icon('menu')}</button>
      <div>
        ${view.crumbs ? `<div class="crumbs">${view.crumbs.map((c) => (Array.isArray(c) ? `<a href="${c[1]}">${A.esc(c[0])}</a>` : A.esc(c))).join(' / ')}</div>` : ''}
        <div class="page-title">${A.esc(view.title)}</div>
      </div>
      <div class="top-search">
        ${A.icon('search')}
        <input id="gsearch" type="search" placeholder="ابحث برقم معاملة، موضوع، أو اسم موظف…" autocomplete="off">
      </div>
      <a class="top-icon" href="#/corr/pending" title="التنبيهات">${A.icon('bell')}${alerts ? '<span class="dot"></span>' : ''}</a>
      <div class="user-chip">${A.avatar(me.name)}<div class="txt"><div class="n">${A.esc(me.name)}</div><div class="r">${A.esc(me.job)}</div></div></div>`;
    el.querySelector('#menu-btn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    bindSearch(el.querySelector('#gsearch'));
  }

  // ───── البحث الشامل ─────
  A.searchAll = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return { letters: [], employees: [] };
    const has = (...xs) => xs.some((x) => String(x || '').toLowerCase().includes(q));
    return {
      letters: A.state.letters.filter((l) => has(l.number, l.subject, l.toEntity, l.fromEntity, l.body)).slice(0, 8),
      employees: A.state.employees.filter((e) => has(e.name, e.id, e.job, A.deptName(e.dept))).slice(0, 6),
    };
  };
  function bindSearch(input) {
    let pop = null;
    const close = () => { if (pop) { pop.remove(); pop = null; } };
    input.addEventListener('input', () => {
      close();
      const r = A.searchAll(input.value);
      if (!r.letters.length && !r.employees.length) return;
      pop = document.createElement('div');
      pop.className = 'search-pop';
      pop.innerHTML =
        (r.letters.length ? '<div class="grp">المعاملات</div>' + r.letters.map((l) => `<a href="#/corr/view/${l.id}">${A.icon(A.LT[l.type].icon)}<span class="small"><b>${A.esc(l.number || 'بدون رقم')}</b> — ${A.esc(l.subject)}</span></a>`).join('') : '') +
        (r.employees.length ? '<div class="grp">الموظفون</div>' + r.employees.map((e) => `<a href="#/hr/employee/${e.id}">${A.icon('user')}<span class="small"><b>${A.esc(e.name)}</b> — ${A.esc(e.job)}</span></a>`).join('') : '');
      input.parentElement.appendChild(pop);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; close(); }
      if (e.key === 'Enter') { const a = pop && pop.querySelector('a'); if (a) location.hash = a.getAttribute('href'); close(); }
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
  }

  // ───── التوجيه ─────
  const routes = A.routes;
  const match = (path) => {
    for (const r of routes) {
      const ps = r.pattern.split('/'), xs = path.split('/');
      if (ps.length !== xs.length) continue;
      const params = {};
      if (ps.every((p, i) => (p.startsWith(':') ? ((params[p.slice(1)] = decodeURIComponent(xs[i])), true) : p === xs[i]))) return { view: r.view, params };
    }
    return null;
  };
  A.go = (hash) => { if (location.hash === hash) A.render(); else location.hash = hash; };

  let lastPath = '';
  A.render = () => {
    const raw = location.hash.slice(1) || '/dashboard';
    const [path, qs] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const m = match(path) || match('/dashboard');
    const view = m.view(m.params, query);
    renderSidebar(path);
    renderTopbar(view);
    document.getElementById('modal-root').innerHTML = '';
    const content = document.getElementById('content');
    content.innerHTML = view.html;
    if (view.mount) view.mount(content);
    document.title = view.title + ' — الإدارة الداخلية';
    document.body.classList.remove('nav-open');
    if (path !== lastPath) window.scrollTo(0, 0);
    lastPath = path;
  };

  window.addEventListener('hashchange', A.render);
  document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  A.render();
})(window.APP);
