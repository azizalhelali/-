// شؤون الموظفين — متوافق مع نظام العمل السعودي وتعديلاته النافذة من فبراير 2025.
(function (A) {
  const esc = (s) => A.esc(s);
  const CR = [['شؤون الموظفين', '#/hr']];

  // ───── حسابات ─────
  A.leaveOn = (empId, day = A.todayISO()) => A.state.leaves.find((x) => x.empId === empId && x.status === 'approved' && x.from <= day && x.to >= day);
  A.empStatus = (e) => {
    const lv = A.leaveOn(e.id);
    if (lv) return ['في إجازة', 'blue'];
    if (e.probationEnd && e.probationEnd > A.todayISO()) return ['فترة تجربة', 'amber'];
    return ['على رأس العمل', 'green'];
  };
  A.annualEntitlement = (e) => (A.yearsOfService(e.hireDate) >= 5 ? 30 : 21);
  A.annualBalance = (e) => A.annualEntitlement(e) - e.annualTaken;
  A.gosi = (e) => {
    const g = A.state.settings.gosi;
    const base = Math.min(e.basic + e.housing, g.cap);
    return e.saudi
      ? { employee: base * g.saudiEmployee / 100, employer: base * g.saudiEmployer / 100, base }
      : { employee: 0, employer: base * g.nonSaudiEmployer / 100, base };
  };
  A.eos = ({ start, end, wage, reason }) => {
    const days = Math.max(A.diffDays(start, end), 0);
    const years = days / 365;
    const first = Math.min(years, 5), rest = Math.max(years - 5, 0);
    const full = (first * wage) / 2 + rest * wage;
    let factor = 1, rule = 'نصف أجر شهر عن كل سنة من السنوات الخمس الأولى، وأجر شهر كامل عن كل سنة بعدها (المادة 84).';
    if (reason === 'resign') {
      factor = years < 2 ? 0 : years < 5 ? 1 / 3 : years < 10 ? 2 / 3 : 1;
      rule = 'استقالة: لا مكافأة قبل سنتين، ثلث المكافأة من 2 إلى أقل من 5 سنوات، ثلثاها من 5 إلى أقل من 10 سنوات، وكاملة لـ 10 سنوات فأكثر (المادة 85).';
    } else if (reason === 'art80') {
      factor = 0; rule = 'فسخ العقد وفق إحدى حالات المادة 80 لا يُستحق عنه مكافأة، بعد إتاحة الفرصة للعامل لإبداء أسباب معارضته.';
    } else if (reason === 'art81' || reason === 'force' || reason === 'female') {
      rule = 'تُستحق المكافأة كاملة (المادتان 81 و87).';
    }
    return { days, years, first, rest, full, factor, award: full * factor, rule };
  };

  // حضور تجريبي ثابت لكل موظف ويوم
  const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
  const hm = (mins) => String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
  A.attendance = (e, day) => {
    const dow = new Date(day + 'T12:00:00').getDay();
    if (dow === 5 || dow === 6) return { status: 'عطلة', tone: 'gray' };
    if (day < e.hireDate) return { status: '—', tone: 'gray' };
    if (A.leaveOn(e.id, day)) return { status: 'إجازة', tone: 'blue' };
    const isToday = day === A.todayISO();
    const h = hash(e.id + day) % 100;
    const start = 8 * 60;
    if (h < 5) return { status: 'غائب', tone: 'red' };
    if (h < 11) return { status: 'عمل عن بُعد', tone: 'blue', in: hm(start - 5), out: isToday ? null : hm(start + 480) };
    const late = h < 24 ? 6 + (h * 7) % 40 : 0;
    const inM = start - (late ? -late : (h % 15));
    const outM = start + 480 + (hash(day + e.id) % 50);
    return { status: late ? 'متأخر' : 'حاضر', tone: late ? 'amber' : 'green', in: hm(inM), out: isToday ? null : hm(outM), late, hours: isToday ? null : ((outM - inM) / 60).toFixed(1) };
  };
  const monthDays = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const n = new Date(y, m, 0).getDate();
    const today = A.todayISO();
    return Array.from({ length: n }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`).filter((d) => d <= today);
  };
  A.absences = (e, ym) => monthDays(ym).filter((d) => A.attendance(e, d).status === 'غائب').length;

  // ───── لوحة الموارد البشرية ─────
  A.route('/hr', () => {
    const S = A.state, emps = S.employees, today = A.todayISO();
    const saudis = emps.filter((e) => e.saudi).length;
    const onLeave = emps.filter((e) => A.leaveOn(e.id)).length;
    const contracts = emps.filter((e) => e.contractEnd && A.daysLeft(e.contractEnd) <= 60);
    const iqamas = emps.filter((e) => e.iqamaExpiry && A.daysLeft(e.iqamaExpiry) <= 90);
    const probation = emps.filter((e) => e.probationEnd > today && A.daysLeft(e.probationEnd) <= 120);
    const payroll = emps.reduce((s, e) => s + A.wage(e), 0);
    const att = emps.map((e) => A.attendance(e, today));
    const present = att.filter((a) => ['حاضر', 'متأخر', 'عمل عن بُعد'].includes(a.status)).length;
    const alerts = [
      ...iqamas.map((e) => ({ tone: A.daysLeft(e.iqamaExpiry) <= 30 ? 'red' : 'amber', icon: 'globe', t: 'انتهاء إقامة: ' + e.name, m: 'خلال ' + A.daysLeft(e.iqamaExpiry) + ' يوماً — ' + A.gdate(e.iqamaExpiry), href: '#/hr/employee/' + e.id })),
      ...contracts.map((e) => ({ tone: A.daysLeft(e.contractEnd) <= 30 ? 'red' : 'amber', icon: 'file', t: 'انتهاء عقد: ' + e.name, m: 'خلال ' + A.daysLeft(e.contractEnd) + ' يوماً — يلزم قرار التجديد أو الإشعار', href: '#/hr/contracts' })),
      ...probation.map((e) => ({ tone: 'blue', icon: 'clock', t: 'نهاية فترة التجربة: ' + e.name, m: 'بعد ' + A.daysLeft(e.probationEnd) + ' يوماً — يلزم تقييم الأداء', href: '#/hr/employee/' + e.id })),
    ].sort((a, b) => (a.tone === 'red' ? -1 : 1) - (b.tone === 'red' ? -1 : 1));
    const byDept = S.departments.map((d) => ({ d, n: emps.filter((e) => e.dept === d.id).length }));
    const maxD = Math.max(...byDept.map((x) => x.n));
    return {
      title: 'لوحة الموارد البشرية', crumbs: ['شؤون الموظفين'],
      html: `
        <div class="page-head"><div><h1>لوحة الموارد البشرية</h1><p>نظرة يومية على القوى العاملة والإجراءات المستحقة.</p></div>
          <div class="row"><a class="btn" href="#/hr/leaves?new=1">${A.icon('calendar')}طلب إجازة</a><a class="btn primary" href="#/hr/employees?new=1">${A.icon('plus')}إضافة موظف</a></div></div>
        <div class="grid g4">
          ${A.kpi({ label: 'إجمالي الموظفين', value: emps.length, sub: `${saudis} سعودي — ${emps.length - saudis} غير سعودي`, href: '#/hr/employees', icon: 'users' })}
          ${A.kpi({ label: 'الحضور اليوم', value: `${present}<span class="muted" style="font-size:15px"> / ${att.filter((a) => a.status !== 'عطلة').length || emps.length}</span>`, sub: `${att.filter((a) => a.status === 'متأخر').length} متأخر — ${att.filter((a) => a.status === 'غائب').length} غائب`, href: '#/hr/attendance', icon: 'clock' })}
          ${A.kpi({ label: 'في إجازة اليوم', value: onLeave, sub: `${S.leaves.filter((x) => x.status === 'pending').length} طلبات بانتظار الاعتماد`, href: '#/hr/leaves', icon: 'calendar' })}
          ${A.kpi({ label: 'نسبة التوطين', value: Math.round((saudis / emps.length) * 100) + '%', sub: 'تقدير داخلي — المرجع منصة قوى', href: '#/hr/saudization', icon: 'flag', tone: 'good' })}
          ${A.kpi({ label: 'إجمالي الرواتب الشهرية', value: A.num(payroll), sub: 'ريال — قبل الاستقطاعات', href: '#/hr/payroll', icon: 'wallet' })}
          ${A.kpi({ label: 'عقود تنتهي خلال 60 يوماً', value: contracts.length, tone: contracts.length ? 'warn' : '', href: '#/hr/contracts', icon: 'file' })}
          ${A.kpi({ label: 'إقامات تنتهي خلال 90 يوماً', value: iqamas.length, tone: iqamas.some((e) => A.daysLeft(e.iqamaExpiry) <= 30) ? 'bad' : iqamas.length ? 'warn' : '', href: '#/hr/contracts', icon: 'globe' })}
          ${A.kpi({ label: 'طلبات الموظفين المفتوحة', value: S.requests.filter((r) => r.status === 'pending').length, href: '#/hr/requests', icon: 'inbox' })}
        </div>
        <div class="split mt">
          <div class="card"><div class="card-head"><h2>تنبيهات تستلزم إجراء</h2><span class="spacer"></span><span class="muted small">${alerts.length}</span></div>
            <div class="card-body flush">${alerts.length ? `<ul class="list">${alerts.map((a) => `<li><span class="ico-box ${a.tone}">${A.icon(a.icon)}</span><a class="fill" href="${a.href}"><div class="ttl">${esc(a.t)}</div><div class="meta">${esc(a.m)}</div></a></li>`).join('')}</ul>` : A.empty('لا توجد تنبيهات')}</div></div>
          <div class="card"><div class="card-head"><h2>التوزيع حسب الإدارة</h2></div><div class="card-body">
            ${byDept.map((x) => `<div class="mb" style="margin-bottom:12px"><div class="row small"><span>${esc(x.d.name)}</span><span class="spacer"></span><b>${x.n}</b></div><div class="bar mt-s"><i style="width:${(x.n / maxD) * 100}%"></i></div></div>`).join('')}
          </div></div>
        </div>`,
    };
  });

  // ───── الموظفون ─────
  function employeeForm(e = {}) {
    return `<div class="form-grid">
      <div class="field full"><label>الاسم الكامل</label><input class="input" name="name" value="${esc(e.name || '')}"></div>
      <div class="field"><label>الجنس</label><select class="input" name="gender">${A.options(['ذكر', 'أنثى'], e.gender)}</select></div>
      <div class="field"><label>الجنسية</label><select class="input" name="nationality">${A.options(['سعودي', 'مصري', 'أردني', 'هندي', 'باكستاني', 'فلبيني', 'سوداني', 'يمني', 'أخرى'], e.nationality)}</select></div>
      <div class="field"><label>المسمى الوظيفي</label><input class="input" name="job" value="${esc(e.job || '')}"></div>
      <div class="field"><label>الإدارة</label><select class="input" name="dept">${A.options(A.state.departments.map((d) => [d.id, d.name]), e.dept)}</select></div>
      <div class="field"><label>تاريخ المباشرة</label><input class="input" type="date" name="hireDate" value="${esc(e.hireDate || A.todayISO())}"></div>
      <div class="field"><label>نوع العقد</label><select class="input" name="contractType">${A.options(['غير محدد المدة', 'محدد المدة'], e.contractType)}</select></div>
      <div class="field"><label>الراتب الأساسي</label><input class="input" type="number" name="basic" value="${e.basic || ''}"></div>
      <div class="field"><label>بدل السكن</label><input class="input" type="number" name="housing" value="${e.housing ?? ''}" placeholder="عادة 25% من الأساسي"></div>
      <div class="field"><label>بدل النقل</label><input class="input" type="number" name="transport" value="${e.transport ?? ''}"></div>
      <div class="field"><label>بدلات أخرى</label><input class="input" type="number" name="other" value="${e.other ?? 0}"></div>
      <div class="field"><label>نهاية العقد (للمحدد المدة)</label><input class="input" type="date" name="contractEnd" value="${esc(e.contractEnd || '')}"></div>
      <div class="field"><label>انتهاء الإقامة (لغير السعودي)</label><input class="input" type="date" name="iqamaExpiry" value="${esc(e.iqamaExpiry || '')}"></div>
    </div>
    <div class="note mt">${A.icon('info')}<div>فترة التجربة تُحسب آلياً بحد أقصى 180 يوماً من تاريخ المباشرة. يجب توثيق العقد في منصة قوى خلال المدة النظامية.</div></div>`;
  }
  function readEmployeeForm(b) {
    const f = (n) => b.querySelector(`[name=${n}]`).value;
    const o = {
      name: f('name').trim(), gender: f('gender'), nationality: f('nationality'), job: f('job').trim(), dept: f('dept'), hireDate: f('hireDate'),
      contractType: f('contractType'), basic: +f('basic') || 0, housing: f('housing') === '' ? Math.round((+f('basic') || 0) * 0.25) : +f('housing'),
      transport: +f('transport') || 0, other: +f('other') || 0, contractEnd: f('contractEnd') || null, iqamaExpiry: f('iqamaExpiry') || null,
    };
    o.saudi = o.nationality === 'سعودي';
    o.probationEnd = A.addDays(180, o.hireDate);
    return o;
  }
  const openNewEmployee = () => A.modal({
    title: 'إضافة موظف', wide: true, body: employeeForm(),
    actions: [{ label: 'حفظ', kind: 'primary', icon: 'check', onClick: (b) => {
      const o = readEmployeeForm(b);
      if (!o.name || !o.job || !o.basic) { A.toast('أكمل الاسم والمسمى والراتب', 'alert'); return false; }
      const n = Math.max(...A.state.employees.map((e) => +e.id.slice(1))) + 1;
      const e = { id: 'E' + n, ...o, annualTaken: 0, sickTaken: 0, hajjTaken: false, phone: '', email: '', idNo: '', iban: '' };
      A.state.employees.push(e); A.save(); A.toast('أُضيف ' + e.name); A.go('#/hr/employee/' + e.id);
    } }, { label: 'إلغاء' }],
  });

  A.route('/hr/employees', (p, q) => {
    const emps = A.state.employees;
    return {
      title: 'الموظفون', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>الموظفون</h1><p>${emps.length} موظفاً في ${A.state.departments.length} إدارات.</p></div>
          <div class="row"><button class="btn" id="exp">${A.icon('download')}تصدير</button><button class="btn primary" id="add">${A.icon('plus')}إضافة موظف</button></div></div>
        <div class="card">
          <div class="card-head">
            <input class="input" id="q" placeholder="بحث بالاسم أو الرقم الوظيفي أو المسمى…" style="max-width:320px">
            <select class="input" id="d" style="max-width:200px"><option value="">كل الإدارات</option>${A.options(A.state.departments.map((d) => [d.id, d.name]))}</select>
            <select class="input" id="n" style="max-width:160px"><option value="">كل الجنسيات</option><option value="1">سعودي</option><option value="0">غير سعودي</option></select>
          </div>
          <div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>الرقم</th><th>الإدارة</th><th>الجنسية</th><th>تاريخ المباشرة</th><th>مدة الخدمة</th><th class="num">إجمالي الراتب</th><th>الحالة</th></tr></thead>
          <tbody>${emps.map((e) => { const [st, tone] = A.empStatus(e); return `<tr class="click" data-href="#/hr/employee/${e.id}" data-d="${e.dept}" data-n="${e.saudi ? 1 : 0}" data-t="${esc((e.name + ' ' + e.id + ' ' + e.job).toLowerCase())}">
            <td><div class="row" style="flex-wrap:nowrap">${A.avatar(e.name)}<div><div class="cell-main">${esc(e.name)}</div><div class="cell-sub">${esc(e.job)}</div></div></div></td>
            <td class="ltr" style="text-align:right">${e.id}</td><td>${esc(A.deptName(e.dept))}</td><td>${esc(e.nationality)}</td>
            <td class="small">${A.gdate(e.hireDate)}</td><td class="small">${A.serviceText(A.yearsOfService(e.hireDate))}</td>
            <td class="num">${A.num(A.wage(e))}</td><td>${A.badge(st, tone)}</td></tr>`; }).join('')}</tbody></table></div>
        </div>`,
      mount(root) {
        A.bindRows(root);
        const q = root.querySelector('#q'), d = root.querySelector('#d'), n = root.querySelector('#n');
        const apply = () => root.querySelectorAll('tbody tr').forEach((tr) => {
          tr.style.display = (!d.value || tr.dataset.d === d.value) && (!n.value || tr.dataset.n === n.value) && tr.dataset.t.includes(q.value.trim().toLowerCase()) ? '' : 'none';
        });
        [q, d, n].forEach((x) => x.addEventListener('input', apply));
        root.querySelector('#add').addEventListener('click', openNewEmployee);
        root.querySelector('#exp').addEventListener('click', () => {
          const rows = [['الرقم', 'الاسم', 'الجنسية', 'المسمى', 'الإدارة', 'تاريخ المباشرة', 'الأساسي', 'السكن', 'النقل', 'أخرى']];
          A.state.employees.forEach((e) => rows.push([e.id, e.name, e.nationality, e.job, A.deptName(e.dept), e.hireDate, e.basic, e.housing, e.transport, e.other]));
          A.download('الموظفون.csv', rows.map((r) => r.join(',')).join('\n'));
        });
        if (location.hash.includes('new=1')) { history.replaceState(null, '', '#/hr/employees'); openNewEmployee(); }
      },
    };
  });

  A.route('/hr/employee/:id', (p) => {
    const e = A.emp(p.id);
    if (!e) return { title: 'غير موجود', html: A.empty('الموظف غير موجود') };
    const [st, tone] = A.empStatus(e);
    const yrs = A.yearsOfService(e.hireDate);
    const g = A.gosi(e);
    const eos = A.eos({ start: e.hireDate, end: A.todayISO(), wage: A.wage(e), reason: 'employer' });
    const leaves = A.state.leaves.filter((x) => x.empId === e.id);
    const viol = A.state.violations.filter((x) => x.empId === e.id);
    const reqs = A.state.requests.filter((x) => x.empId === e.id);
    const dl = (rows) => `<dl class="dl">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
    const exp = (d) => { if (!d) return '—'; const n = A.daysLeft(d); return `${A.gdate(d)} ${n <= 30 ? A.badge('بعد ' + n + ' يوماً', 'red') : n <= 90 ? A.badge('بعد ' + n + ' يوماً', 'amber') : ''}`; };
    return {
      title: e.name, crumbs: [...CR, ['الموظفون', '#/hr/employees']],
      html: `
        <div class="card mb"><div class="card-body row" style="gap:16px">
          <span class="avatar" style="width:56px;height:56px;font-size:18px">${esc(A.initials(e.name))}</span>
          <div><h1>${esc(e.name)}</h1><div class="muted">${esc(e.job)} — ${esc(A.deptName(e.dept))} — <span class="ltr">${e.id}</span></div></div>
          <span class="spacer"></span>${A.badge(st, tone)}
          <button class="btn" id="edit">${A.icon('edit')}تعديل البيانات</button>
          <a class="btn" href="#/hr/leaves?new=1&emp=${e.id}">${A.icon('calendar')}إجازة</a>
          <button class="btn" id="letter">${A.icon('file')}خطاب تعريف</button>
        </div></div>
        <div class="tabs" id="tabs">
          ${['البيانات الأساسية', 'العقد والراتب', 'الإجازات', 'الحضور', 'المخالفات والطلبات', 'نهاية الخدمة'].map((t, i) => `<button class="tab ${i === 0 ? 'on' : ''}" data-tab="${i}">${t}</button>`).join('')}
        </div>
        <div data-pane="0"><div class="grid g2">
          <div class="card"><div class="card-head"><h2>البيانات الشخصية</h2></div><div class="card-body">${dl([
            ['الجنس', esc(e.gender)], ['الجنسية', esc(e.nationality)], [e.saudi ? 'رقم الهوية' : 'رقم الإقامة', `<span class="ltr">${esc(e.idNo || '—')}</span>`],
            ...(e.saudi ? [] : [['انتهاء الإقامة', exp(e.iqamaExpiry)]]), ['الجوال', `<span class="ltr">${esc(e.phone || '—')}</span>`], ['البريد', `<span class="ltr">${esc(e.email || '—')}</span>`],
          ])}</div></div>
          <div class="card"><div class="card-head"><h2>البيانات الوظيفية</h2></div><div class="card-body">${dl([
            ['المسمى', esc(e.job)], ['الإدارة', esc(A.deptName(e.dept))], ['المدير المباشر', esc(A.empName(A.dept(e.dept).manager === e.id ? 'E1001' : A.dept(e.dept).manager))],
            ['تاريخ المباشرة', A.gdate(e.hireDate) + ' <span class="muted small">(' + A.hdate(e.hireDate) + ')</span>'], ['مدة الخدمة', A.serviceText(yrs)],
            ['نهاية التجربة', e.probationEnd > A.todayISO() ? exp(e.probationEnd) : '<span class="muted">انتهت</span>'],
          ])}</div></div>
        </div></div>
        <div data-pane="1" hidden><div class="grid g2">
          <div class="card"><div class="card-head"><h2>العقد</h2></div><div class="card-body">${dl([
            ['نوع العقد', esc(e.contractType)], ['نهاية العقد', exp(e.contractEnd)], ['توثيق العقد', A.badge('موثّق في قوى', 'green')],
            ['فترة الإشعار', e.contractType === 'غير محدد المدة' ? '60 يوماً من صاحب العمل / 30 يوماً من العامل' : 'حسب العقد'],
            ['الآيبان', `<span class="ltr">${esc(e.iban || '—')}</span>`],
          ])}</div></div>
          <div class="card"><div class="card-head"><h2>مكوّنات الراتب</h2></div><div class="card-body flush"><table class="t"><tbody>
            <tr><td>الراتب الأساسي</td><td class="num">${A.num(e.basic)}</td></tr>
            <tr><td>بدل السكن</td><td class="num">${A.num(e.housing)}</td></tr>
            <tr><td>بدل النقل</td><td class="num">${A.num(e.transport)}</td></tr>
            <tr><td>بدلات أخرى</td><td class="num">${A.num(e.other)}</td></tr>
            <tr><td class="bold">الإجمالي</td><td class="num bold">${A.num(A.wage(e))}</td></tr>
            <tr><td class="muted">استقطاع التأمينات (حصة الموظف)</td><td class="num muted">− ${A.num(g.employee)}</td></tr>
            <tr><td class="muted">حصة المنشأة في التأمينات</td><td class="num muted">${A.num(g.employer)}</td></tr>
          </tbody></table></div></div>
        </div></div>
        <div data-pane="2" hidden>
          <div class="grid g3 mb">
            ${A.kpi({ label: 'رصيد الإجازة السنوية', value: A.annualBalance(e) + ' يوم', sub: `الاستحقاق ${A.annualEntitlement(e)} يوماً — المستخدم ${e.annualTaken}` })}
            ${A.kpi({ label: 'الإجازات المرضية هذا العام', value: e.sickTaken + ' يوم', sub: 'من 30 يوماً بأجر كامل' })}
            ${A.kpi({ label: 'إجازة الحج', value: e.hajjTaken ? 'مُستخدمة' : yrs >= 2 ? 'مستحقة' : 'غير مستحقة بعد', sub: 'مرة واحدة بعد سنتين خدمة' })}
          </div>
          <div class="card">${leaveTable(leaves, false)}</div>
        </div>
        <div data-pane="3" hidden><div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>اليوم</th><th>الحضور</th><th>الانصراف</th><th>الساعات</th><th>الحالة</th></tr></thead><tbody>
          ${Array.from({ length: 14 }, (_, i) => A.addDays(-i)).map((d) => { const a = A.attendance(e, d); return `<tr><td>${A.gdate(d)}</td><td class="ltr" style="text-align:right">${a.in || '—'}</td><td class="ltr" style="text-align:right">${a.out || '—'}</td><td>${a.hours || '—'}</td><td>${A.badge(a.status + (a.late ? ' ' + a.late + 'د' : ''), a.tone)}</td></tr>`; }).join('')}
        </tbody></table></div></div></div>
        <div data-pane="4" hidden><div class="grid g2">
          <div class="card"><div class="card-head"><h2>المخالفات</h2></div><div class="card-body flush">${viol.length ? `<ul class="list">${viol.map((v) => { const t = A.VIOLATIONS.find((x) => x.key === v.vkey); return `<li><span class="ico-box red">${A.icon('alert')}</span><div><div class="small bold">${esc(t.label)}</div><div class="meta">التكرار ${v.occurrence} — ${esc(t.p[Math.min(v.occurrence, 4) - 1])} — ${A.gdate(v.date)}</div></div></li>`; }).join('')}</ul>` : A.empty('لا توجد مخالفات')}</div></div>
          <div class="card"><div class="card-head"><h2>الطلبات</h2></div><div class="card-body flush">${reqs.length ? `<ul class="list">${reqs.map((r) => `<li><span class="ico-box">${A.icon('inbox')}</span><div style="flex:1"><div class="small bold">${esc(r.type)}</div><div class="meta">${esc(r.details)}</div></div>${reqBadge(r.status)}</li>`).join('')}</ul>` : A.empty('لا توجد طلبات')}</div></div>
        </div></div>
        <div data-pane="5" hidden><div class="card"><div class="card-body">
          <div class="grid g3">
            ${A.kpi({ label: 'المكافأة التقديرية حتى اليوم', value: A.num(eos.award), sub: 'ريال — بافتراض الإنهاء من صاحب العمل' })}
            ${A.kpi({ label: 'مدة الخدمة', value: eos.years.toFixed(2) + ' سنة', sub: eos.days + ' يوماً' })}
            ${A.kpi({ label: 'تعويض رصيد الإجازات', value: A.num((A.annualBalance(e) * A.wage(e)) / 30), sub: A.annualBalance(e) + ' يوماً متبقية' })}
          </div>
          <div class="row mt"><a class="btn" href="#/hr/eos?emp=${e.id}">${A.icon('calc')}فتح الحاسبة التفصيلية</a></div>
        </div></div></div>`,
      mount(root) {
        root.querySelector('#tabs').addEventListener('click', (ev) => {
          const t = ev.target.closest('.tab'); if (!t) return;
          root.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
          root.querySelectorAll('[data-pane]').forEach((x) => (x.hidden = x.dataset.pane !== t.dataset.tab));
        });
        root.querySelector('#edit').addEventListener('click', () => A.modal({
          title: 'تعديل بيانات الموظف', wide: true, body: employeeForm(e),
          actions: [{ label: 'حفظ', kind: 'primary', onClick: (b) => { Object.assign(e, readEmployeeForm(b)); A.save(); A.toast('حُفظت البيانات'); A.render(); } }, { label: 'إلغاء' }],
        }));
        root.querySelector('#letter').addEventListener('click', () => salaryLetter(e, 'إلى من يهمه الأمر'));
      },
    };
  });

  // خطاب تعريف بالراتب: يُنشئ مسودة في المراسلات تمر بنفس رحلة الاعتماد
  function salaryLetter(e, to, expLetter) {
    const body = expLetter
      ? `تشهد ${A.state.settings.companyAr} بأن السيد/ ${e.name}، ${e.saudi ? 'سعودي' : e.nationality} الجنسية، قد عمل لديها بوظيفة (${e.job}) في ${A.deptName(e.dept)}، اعتباراً من تاريخ ${A.gdate(e.hireDate)}م وحتى تاريخه، وكان خلال فترة عمله مثالاً للجد والالتزام.\n\nوقد أُعطي هذه الشهادة بناءً على طلبه دون أدنى مسؤولية على الشركة.`
      : `تشهد ${A.state.settings.companyAr} بأن السيد/ ${e.name}، ${e.saudi ? 'سعودي' : e.nationality} الجنسية، ويحمل ${e.saudi ? 'هوية' : 'إقامة'} رقم (${e.idNo})، يعمل لديها بوظيفة (${e.job}) منذ تاريخ ${A.gdate(e.hireDate)}م وحتى تاريخه، ويتقاضى راتباً شهرياً إجمالياً قدره (${A.num(A.wage(e))}) ريال، تفصيله كالتالي:\n- الراتب الأساسي: ${A.num(e.basic)} ريال\n- بدل السكن: ${A.num(e.housing)} ريال\n- بدل النقل: ${A.num(e.transport)} ريال${e.other ? '\n- بدلات أخرى: ' + A.num(e.other) + ' ريال' : ''}\n\nوقد أُعطي هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على الشركة.`;
    const l = A.newDraft({ type: 'external', subject: expLetter ? 'شهادة خبرة — ' + e.name : 'خطاب تعريف بالراتب — ' + e.name, toEntity: to, body });
    A.toast('أُنشئت مسودة في المراسلات');
    A.go('#/corr/edit/' + l.id);
  }

  // ───── الإجازات ─────
  const LT = (k) => A.LEAVE_TYPES.find((t) => t.key === k);
  const leaveDays = (x) => A.diffDays(x.from, x.to) + 1;
  const reqBadge = (s) => A.badge({ pending: 'بانتظار الاعتماد', approved: 'معتمد', rejected: 'مرفوض' }[s], { pending: 'amber', approved: 'green', rejected: 'red' }[s]);
  function leaveTable(list, actions) {
    if (!list.length) return A.empty('لا توجد إجازات');
    return `<div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>ملاحظة</th><th>الحالة</th>${actions ? '<th></th>' : ''}</tr></thead><tbody>
      ${list.map((x) => `<tr><td><div class="cell-main">${esc(A.empName(x.empId))}</div><div class="cell-sub">${esc(A.deptName(A.emp(x.empId).dept))}</div></td>
        <td>${esc(LT(x.type).label)}<div class="cell-sub">${esc(LT(x.type).art)}</div></td><td class="small">${A.gdate(x.from)}</td><td class="small">${A.gdate(x.to)}</td><td>${leaveDays(x)}</td>
        <td class="small muted">${esc(x.note || '')}</td><td>${reqBadge(x.status)}</td>
        ${actions ? `<td style="white-space:nowrap">${x.status === 'pending' ? `<button class="btn sm primary" data-ok="${x.id}">اعتماد</button> <button class="btn sm" data-no="${x.id}">رفض</button>` : ''}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>`;
  }
  function leaveDialog(empId) {
    A.modal({
      title: 'طلب إجازة', wide: true,
      body: `<div class="form-grid">
        <div class="field"><label>الموظف</label><select class="input" name="emp">${A.options(A.state.employees.map((e) => [e.id, e.name]), empId)}</select></div>
        <div class="field"><label>نوع الإجازة</label><select class="input" name="type">${A.options(A.LEAVE_TYPES.map((t) => [t.key, t.label]))}</select></div>
        <div class="field"><label>من تاريخ</label><input class="input" type="date" name="from" value="${A.addDays(1)}"></div>
        <div class="field"><label>إلى تاريخ</label><input class="input" type="date" name="to" value="${A.addDays(1)}"></div>
        <div class="field full"><label>ملاحظة / مرفق</label><input class="input" name="note" placeholder="مثال: رقم التقرير الطبي"></div>
      </div>
      <div class="note info mt" id="lv-rule"></div>
      <div class="note warn mt" id="lv-warn" hidden></div>`,
      onMount: (b) => {
        const f = (n) => b.querySelector(`[name=${n}]`);
        const check = () => {
          const t = LT(f('type').value), e = A.emp(f('emp').value);
          if (t.days && f('from').value) f('to').value = A.addDays(t.days - 1, f('from').value);
          const days = f('from').value && f('to').value ? A.diffDays(f('from').value, f('to').value) + 1 : 0;
          b.querySelector('#lv-rule').innerHTML = `${A.icon('book')}<div><b>${esc(t.label)} — ${esc(t.art)} — ${esc(t.paid)}</b><div class="mt-s">${esc(t.note)}</div><div class="mt-s">المدة المطلوبة: <b>${days}</b> يوماً${t.key === 'annual' ? ` — الرصيد المتاح: <b>${A.annualBalance(e)}</b> يوماً` : ''}</div></div>`;
          const w = [];
          if (days <= 0) w.push('تاريخ النهاية قبل تاريخ البداية.');
          if (t.key === 'annual' && days > A.annualBalance(e)) w.push('المدة تتجاوز رصيد الإجازة السنوية.');
          if (t.female && e.gender !== 'أنثى') w.push('هذا النوع خاص بالعاملات.');
          if (t.minYears && A.yearsOfService(e.hireDate) < t.minYears) w.push('يشترط إمضاء سنتين متصلتين في الخدمة.');
          if (t.key === 'hajj' && e.hajjTaken) w.push('سبق للموظف الحصول على إجازة الحج.');
          if (t.min && (days < t.min || days > t.max)) w.push(`المدة يجب أن تكون بين ${t.min} و${t.max} يوماً.`);
          if (t.key === 'sick' && e.sickTaken + days > 30) w.push(`ما يزيد على 30 يوماً بأجر كامل يُصرف بثلاثة أرباع الأجر (المستخدم هذا العام: ${e.sickTaken} يوماً).`);
          const ww = b.querySelector('#lv-warn');
          ww.hidden = !w.length;
          ww.innerHTML = A.icon('alert') + '<div>' + w.map(esc).join('<br>') + '</div>';
        };
        ['emp', 'type', 'from', 'to'].forEach((n) => f(n).addEventListener('change', check));
        check();
      },
      actions: [{ label: 'تقديم الطلب', kind: 'primary', icon: 'check', onClick: (b) => {
        const f = (n) => b.querySelector(`[name=${n}]`).value;
        if (!f('from') || !f('to') || f('to') < f('from')) { A.toast('تحقق من التواريخ', 'alert'); return false; }
        A.state.leaves.unshift({ id: A.uid('LV'), empId: f('emp'), type: f('type'), from: f('from'), to: f('to'), note: f('note'), status: 'pending', createdAt: new Date().toISOString() });
        A.save(); A.toast('قُدّم طلب الإجازة'); A.go('#/hr/leaves');
      } }, { label: 'إلغاء' }],
    });
  }
  A.route('/hr/leaves', (p, q) => {
    const L = A.state.leaves;
    const pending = L.filter((x) => x.status === 'pending');
    const current = L.filter((x) => x.status === 'approved' && x.to >= A.todayISO());
    return {
      title: 'الإجازات', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>الإجازات</h1><p>طلبات الإجازات وأرصدتها وفق المواد 109–117 و151 و160 من نظام العمل.</p></div>
          <button class="btn primary" id="new">${A.icon('plus')}طلب إجازة</button></div>
        <div class="tabs" id="tabs">
          <button class="tab on" data-tab="0">بانتظار الاعتماد (${pending.length})</button>
          <button class="tab" data-tab="1">الحالية والقادمة (${current.length})</button>
          <button class="tab" data-tab="2">كل الطلبات</button>
          <button class="tab" data-tab="3">أرصدة الموظفين</button>
          <button class="tab" data-tab="4">أنواع الإجازات النظامية</button>
        </div>
        <div data-pane="0"><div class="card">${leaveTable(pending, true)}</div></div>
        <div data-pane="1" hidden><div class="card">${leaveTable(current, false)}</div></div>
        <div data-pane="2" hidden><div class="card">${leaveTable(L, true)}</div></div>
        <div data-pane="3" hidden><div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>مدة الخدمة</th><th>الاستحقاق السنوي</th><th>المستخدم</th><th>الرصيد</th><th>مرضية مستخدمة</th><th>إجازة الحج</th></tr></thead><tbody>
          ${A.state.employees.map((e) => `<tr class="click" data-href="#/hr/employee/${e.id}"><td class="cell-main">${esc(e.name)}</td><td class="small">${A.serviceText(A.yearsOfService(e.hireDate))}</td><td>${A.annualEntitlement(e)}</td><td>${e.annualTaken}</td><td><b>${A.annualBalance(e)}</b></td><td>${e.sickTaken}</td><td>${e.hajjTaken ? A.badge('مُستخدمة', 'gray') : A.yearsOfService(e.hireDate) >= 2 ? A.badge('مستحقة', 'green') : A.badge('غير مستحقة', 'gray')}</td></tr>`).join('')}
        </tbody></table></div></div></div>
        <div data-pane="4" hidden><div class="grid g2">${A.LEAVE_TYPES.map((t) => `<div class="law"><div class="art">${esc(t.art)} — ${esc(t.paid)}</div><h3>${esc(t.label)}</h3><p>${esc(t.note)}</p></div>`).join('')}</div></div>`,
      mount(root) {
        A.bindRows(root);
        root.querySelector('#tabs').addEventListener('click', (ev) => {
          const t = ev.target.closest('.tab'); if (!t) return;
          root.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
          root.querySelectorAll('[data-pane]').forEach((x) => (x.hidden = x.dataset.pane !== t.dataset.tab));
        });
        root.querySelector('#new').addEventListener('click', () => leaveDialog());
        root.addEventListener('click', (ev) => {
          const ok = ev.target.closest('[data-ok]'), no = ev.target.closest('[data-no]');
          if (!ok && !no) return;
          const x = L.find((y) => y.id === (ok || no).dataset[ok ? 'ok' : 'no']);
          x.status = ok ? 'approved' : 'rejected';
          if (ok) { const e = A.emp(x.empId); if (x.type === 'annual') e.annualTaken += leaveDays(x); if (x.type === 'sick') e.sickTaken += leaveDays(x); if (x.type === 'hajj') e.hajjTaken = true; }
          A.save(); A.toast(ok ? 'اعتُمدت الإجازة' : 'رُفض الطلب'); A.render();
        });
        if (q.new) { history.replaceState(null, '', '#/hr/leaves'); leaveDialog(q.emp); }
      },
    };
  });

  // ───── الحضور والانصراف ─────
  A.route('/hr/attendance', (p, q) => {
    const day = q.d || A.todayISO();
    const rows = A.state.employees.map((e) => ({ e, a: A.attendance(e, day) }));
    const c = (s) => rows.filter((r) => r.a.status === s).length;
    const s = A.state.settings;
    return {
      title: 'الحضور والانصراف', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>الحضور والانصراف</h1><p>الدوام من ${s.workStart} إلى ${s.workEnd} — 8 ساعات يومياً و48 ساعة أسبوعياً، و6 ساعات للعاملين المسلمين في رمضان (المادة 98).</p></div>
          <div class="row"><input class="input" type="date" id="day" value="${day}" max="${A.todayISO()}" style="width:auto"><button class="btn" id="exp">${A.icon('download')}تصدير</button></div></div>
        <div class="grid g4 mb">
          ${A.kpi({ label: 'حاضر', value: c('حاضر') + c('عمل عن بُعد'), tone: 'good', sub: c('عمل عن بُعد') + ' عن بُعد' })}
          ${A.kpi({ label: 'متأخر', value: c('متأخر'), tone: c('متأخر') ? 'warn' : '' })}
          ${A.kpi({ label: 'غائب', value: c('غائب'), tone: c('غائب') ? 'bad' : '' })}
          ${A.kpi({ label: 'إجازة', value: c('إجازة') })}
        </div>
        ${c('عطلة') === rows.length ? `<div class="note mb">${A.icon('calendar')}<div>عطلة نهاية الأسبوع.</div></div>` : ''}
        <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>الإدارة</th><th>الحضور</th><th>الانصراف</th><th>ساعات العمل</th><th>التأخير</th><th>الحالة</th><th></th></tr></thead><tbody>
          ${rows.map(({ e, a }) => `<tr><td class="cell-main">${esc(e.name)}</td><td class="small">${esc(A.deptName(e.dept))}</td>
            <td class="ltr" style="text-align:right">${a.in || '—'}</td><td class="ltr" style="text-align:right">${a.out || (a.in ? '<span class="muted">لم ينصرف</span>' : '—')}</td>
            <td>${a.hours || '—'}</td><td>${a.late ? a.late + ' دقيقة' : '—'}</td><td>${A.badge(a.status, a.tone)}</td>
            <td>${a.status === 'غائب' || a.status === 'متأخر' ? `<button class="btn sm" data-viol="${e.id}" data-k="${a.status === 'غائب' ? 'absent1' : a.late > 15 ? 'late30' : 'late15'}">تسجيل مخالفة</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>
        <div class="note mt">${A.icon('info')}<div>في النسخة النهائية تُسحب البيانات آلياً من أجهزة البصمة أو تطبيق الجوال بالموقع الجغرافي.</div></div>`,
      mount(root) {
        root.querySelector('#day').addEventListener('change', (e) => A.go('#/hr/attendance?d=' + e.target.value));
        root.querySelector('#exp').addEventListener('click', () => A.download('الحضور-' + day + '.csv', [['الموظف', 'الحضور', 'الانصراف', 'الحالة'], ...rows.map(({ e, a }) => [e.name, a.in || '', a.out || '', a.status])].map((r) => r.join(',')).join('\n')));
        root.querySelectorAll('[data-viol]').forEach((b) => b.addEventListener('click', () => violationDialog(b.dataset.viol, b.dataset.k, day)));
      },
    };
  });

  // ───── مسير الرواتب ─────
  A.route('/hr/payroll', (p, q) => {
    const ym = q.m || A.todayISO().slice(0, 7);
    const status = A.state.payroll[ym] || 'draft';
    const rows = A.state.employees.filter((e) => e.hireDate <= ym + '-31').map((e) => {
      const g = A.gosi(e), gross = A.wage(e), abs = A.absences(e, ym), absDed = (abs * gross) / 30;
      const adv = A.state.requests.some((r) => r.empId === e.id && r.type === 'سلفة على الراتب' && r.status === 'approved') ? 1000 : 0;
      return { e, g, gross, abs, absDed, adv, net: gross - g.employee - absDed - adv };
    });
    const sum = (k) => rows.reduce((s, r) => s + (typeof k === 'function' ? k(r) : r[k]), 0);
    const ST = { draft: ['مسودة', 'gray'], approved: ['معتمد', 'blue'], paid: ['مُرسل للبنك', 'green'] };
    const monthLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { month: 'long', year: 'numeric' }).format(new Date(ym + '-15T12:00:00'));
    return {
      title: 'مسير الرواتب', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>مسير رواتب ${esc(monthLabel)}</h1><p>الأجور تُصرف عبر نظام حماية الأجور (مدد) — الاستقطاعات وفق نظام التأمينات الاجتماعية.</p></div>
          <div class="row"><input class="input" type="month" id="m" value="${ym}" style="width:auto">${A.badge(ST[status][0], ST[status][1])}</div></div>
        <div class="grid g4 mb">
          ${A.kpi({ label: 'إجمالي الرواتب', value: A.num(sum('gross')), sub: rows.length + ' موظفاً' })}
          ${A.kpi({ label: 'استقطاعات التأمينات (الموظفون)', value: A.num(sum((r) => r.g.employee)) })}
          ${A.kpi({ label: 'حصة المنشأة في التأمينات', value: A.num(sum((r) => r.g.employer)) })}
          ${A.kpi({ label: 'صافي المسير', value: A.num(sum('net')), tone: 'good' })}
        </div>
        <div class="card">
          <div class="card-head"><h2>تفاصيل المسير</h2><span class="spacer"></span>
            ${status === 'draft' ? `<button class="btn primary" data-st="approved">${A.icon('check')}اعتماد المسير</button>` : ''}
            ${status === 'approved' ? `<button class="btn primary" data-st="paid">${A.icon('send')}تأكيد الإرسال للبنك</button>` : ''}
            <button class="btn" id="wps">${A.icon('download')}ملف حماية الأجور (WPS)</button>
          </div>
          <div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th class="num">الأساسي</th><th class="num">السكن</th><th class="num">النقل وأخرى</th><th class="num">الإجمالي</th><th class="num">التأمينات</th><th class="num">غياب</th><th class="num">سلف</th><th class="num">الصافي</th></tr></thead><tbody>
            ${rows.map((r) => `<tr><td><div class="cell-main">${esc(r.e.name)}</div><div class="cell-sub">${esc(r.e.saudi ? 'سعودي — ' + A.state.settings.gosi.saudiEmployee + '%' : 'غير سعودي — بلا استقطاع')}</div></td>
              <td class="num">${A.num(r.e.basic)}</td><td class="num">${A.num(r.e.housing)}</td><td class="num">${A.num(r.e.transport + r.e.other)}</td><td class="num bold">${A.num(r.gross)}</td>
              <td class="num">${r.g.employee ? '− ' + A.num(r.g.employee) : '—'}</td><td class="num">${r.abs ? '− ' + A.num(r.absDed) + `<div class="cell-sub" dir="rtl">${r.abs} يوم</div>` : '—'}</td><td class="num">${r.adv ? '− ' + A.num(r.adv) : '—'}</td><td class="num bold">${A.num(r.net)}</td></tr>`).join('')}
          </tbody><tfoot><tr><td>الإجمالي</td><td class="num">${A.num(sum((r) => r.e.basic))}</td><td class="num">${A.num(sum((r) => r.e.housing))}</td><td class="num">${A.num(sum((r) => r.e.transport + r.e.other))}</td><td class="num">${A.num(sum('gross'))}</td><td class="num">${A.num(sum((r) => r.g.employee))}</td><td class="num">${A.num(sum('absDed'))}</td><td class="num">${A.num(sum('adv'))}</td><td class="num">${A.num(sum('net'))}</td></tr></tfoot></table></div>
        </div>
        <div class="note mt">${A.icon('info')}<div>نسب التأمينات الحالية: السعودي ${A.state.settings.gosi.saudiEmployee}% على الموظف و${A.state.settings.gosi.saudiEmployer}% على المنشأة (معاشات + ساند + أخطار مهنية)، وغير السعودي ${A.state.settings.gosi.nonSaudiEmployer}% أخطار مهنية على المنشأة، والحد الأعلى للأجر الخاضع ${A.num(A.state.settings.gosi.cap)} ريال. نسب المشتركين الجدد بعد يوليو 2024 تتدرّج وفق نظام التأمينات الجديد — تُضبط لاحقاً لكل موظف. حسم الغياب = (الأجر ÷ 30) × أيام الغياب.</div></div>`,
      mount(root) {
        root.querySelector('#m').addEventListener('change', (e) => A.go('#/hr/payroll?m=' + e.target.value));
        root.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => { A.state.payroll[ym] = b.dataset.st; A.save(); A.toast(b.dataset.st === 'approved' ? 'اعتُمد المسير' : 'سُجّل الإرسال للبنك'); A.render(); }));
        root.querySelector('#wps').addEventListener('click', () => {
          const head = ['الرقم الوظيفي', 'الاسم', 'رقم الهوية/الإقامة', 'الآيبان', 'الأساسي', 'السكن', 'بدلات أخرى', 'الحسومات', 'الصافي'];
          const body = rows.map((r) => [r.e.id, r.e.name, r.e.idNo, r.e.iban, r.e.basic, r.e.housing, r.e.transport + r.e.other, (r.g.employee + r.absDed + r.adv).toFixed(2), r.net.toFixed(2)]);
          A.download('WPS-' + ym + '.csv', [head, ...body].map((x) => x.join(',')).join('\n'));
          A.toast('نُزّل ملف حماية الأجور', 'download');
        });
      },
    };
  });

  // ───── العقود والوثائق ─────
  A.route('/hr/contracts', () => {
    const emps = A.state.employees;
    const d = (v, warn, bad) => { if (!v) return '<span class="muted">—</span>'; const n = A.daysLeft(v); return `${A.gdate(v)}<div class="cell-sub">${n < 0 ? A.badge('منتهي', 'red') : n <= bad ? A.badge('متبقي ' + n + ' يوماً', 'red') : n <= warn ? A.badge('متبقي ' + n + ' يوماً', 'amber') : 'متبقي ' + n + ' يوماً'}</div>`; };
    return {
      title: 'العقود والوثائق', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>العقود والوثائق</h1><p>متابعة انتهاء العقود والإقامات وفترات التجربة قبل وقتها.</p></div></div>
        <div class="grid g3 mb">
          <div class="law"><div class="art">المادة 53 (معدّلة)</div><h3>فترة التجربة</h3><p>لا تزيد على 180 يوماً، ولا يجوز وضع العامل تحت التجربة أكثر من مرة لدى صاحب العمل نفسه إلا باتفاق مكتوب في مهنة مختلفة.</p></div>
          <div class="law"><div class="art">المادة 75 (معدّلة)</div><h3>الإشعار في العقد غير محدد المدة</h3><p>60 يوماً على الأقل إذا كان الإنهاء من صاحب العمل، و30 يوماً إذا كان من العامل.</p></div>
          <div class="law"><div class="art">العقد محدد المدة</div><h3>التجديد</h3><p>يُستحسن إشعار العامل بقرار التجديد أو عدمه قبل انتهاء العقد، وتوثيق التجديد في منصة قوى.</p></div>
        </div>
        <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>نوع العقد</th><th>نهاية العقد</th><th>نهاية التجربة</th><th>انتهاء الإقامة</th><th></th></tr></thead><tbody>
          ${emps.slice().sort((a, b) => Math.min(A.daysLeft(a.contractEnd) ?? 1e4, A.daysLeft(a.iqamaExpiry) ?? 1e4) - Math.min(A.daysLeft(b.contractEnd) ?? 1e4, A.daysLeft(b.iqamaExpiry) ?? 1e4)).map((e) => `<tr>
            <td><a class="cell-main" href="#/hr/employee/${e.id}" style="color:inherit">${esc(e.name)}</a><div class="cell-sub">${esc(e.nationality)} — ${esc(e.job)}</div></td>
            <td>${esc(e.contractType)}</td><td>${d(e.contractEnd, 90, 30)}</td><td>${e.probationEnd > A.todayISO() ? d(e.probationEnd, 60, 14) : '<span class="muted">انتهت</span>'}</td><td>${e.saudi ? '<span class="muted">—</span>' : d(e.iqamaExpiry, 90, 30)}</td>
            <td style="white-space:nowrap">${e.contractEnd && A.daysLeft(e.contractEnd) <= 90 ? `<button class="btn sm" data-renew="${e.id}">${A.icon('file')}خطاب تجديد</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`,
      mount(root) {
        root.querySelectorAll('[data-renew]').forEach((b) => b.addEventListener('click', () => {
          const e = A.emp(b.dataset.renew);
          const l = A.newDraft({ type: 'decision', subject: 'قرار تجديد عقد عمل — ' + e.name, toDepts: ['HR', e.dept], body: `أولاً: يُجدَّد عقد عمل السيد/ ${e.name}، بوظيفة (${e.job})، لمدة سنة اعتباراً من ${A.gdate(A.addDays(1, e.contractEnd))}م، بنفس الشروط والمزايا الواردة في العقد الحالي.\n\nثانياً: على إدارة الموارد البشرية توثيق التجديد في منصة قوى.\n\nثالثاً: يُبلّغ هذا القرار لمن يلزم لاعتماده والعمل بموجبه.` });
          A.toast('أُنشئت مسودة قرار التجديد'); A.go('#/corr/edit/' + l.id);
        }));
      },
    };
  });

  // ───── طلبات الموظفين ─────
  A.route('/hr/requests', () => {
    const R = A.state.requests;
    return {
      title: 'طلبات الموظفين', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>طلبات الموظفين</h1><p>الخدمة الذاتية: خطابات التعريف، الشهادات، السلف، وتحديث البيانات. الخطابات تُنشأ مباشرة في المراسلات وتمر برحلة الاعتماد.</p></div>
          <button class="btn primary" id="new">${A.icon('plus')}طلب جديد</button></div>
        <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>نوع الطلب</th><th>التفاصيل</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
          ${R.map((r) => `<tr><td class="cell-main">${esc(A.empName(r.empId))}</td><td>${esc(r.type)}</td><td class="small muted">${esc(r.details)}</td><td class="small">${A.gdate(r.createdAt)}</td><td>${reqBadge(r.status)}</td>
            <td style="white-space:nowrap">${r.status === 'pending' ? (['خطاب تعريف بالراتب', 'شهادة خبرة'].includes(r.type) ? `<button class="btn sm primary" data-letter="${r.id}">${A.icon('file')}إصدار الخطاب</button> ` : `<button class="btn sm primary" data-ok="${r.id}">اعتماد</button> `) + `<button class="btn sm" data-no="${r.id}">رفض</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`,
      mount(root) {
        root.addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-ok],[data-no],[data-letter]'); if (!b) return;
          const r = R.find((x) => x.id === (b.dataset.ok || b.dataset.no || b.dataset.letter));
          if (b.dataset.letter) {
            r.status = 'approved'; A.save();
            salaryLetter(A.emp(r.empId), (r.details.match(/موجّه إلى:\s*(.+)/) || [])[1] || 'إلى من يهمه الأمر', r.type === 'شهادة خبرة');
            return;
          }
          r.status = b.dataset.ok ? 'approved' : 'rejected';
          A.save(); A.toast(b.dataset.ok ? 'اعتُمد الطلب' : 'رُفض الطلب'); A.render();
        });
        root.querySelector('#new').addEventListener('click', () => A.modal({
          title: 'طلب جديد',
          body: `<div class="form-grid"><div class="field"><label>الموظف</label><select class="input" name="emp">${A.options(A.state.employees.map((e) => [e.id, e.name]), A.state.currentUserId)}</select></div>
            <div class="field"><label>نوع الطلب</label><select class="input" name="type">${A.options(A.REQUEST_TYPES)}</select></div>
            <div class="field full"><label>التفاصيل</label><input class="input" name="details" placeholder="مثال: موجّه إلى: بنك الرياض"></div></div>`,
          actions: [{ label: 'تقديم', kind: 'primary', onClick: (b) => {
            const f = (n) => b.querySelector(`[name=${n}]`).value;
            R.unshift({ id: A.uid('R'), empId: f('emp'), type: f('type'), details: f('details'), status: 'pending', createdAt: new Date().toISOString() });
            A.save(); A.toast('قُدّم الطلب'); A.render();
          } }, { label: 'إلغاء' }],
        }));
      },
    };
  });

  // ───── المخالفات والجزاءات ─────
  function violationDialog(empId, vkey, date) {
    A.modal({
      title: 'تسجيل مخالفة', wide: true,
      body: `<div class="form-grid">
        <div class="field"><label>الموظف</label><select class="input" name="emp">${A.options(A.state.employees.map((e) => [e.id, e.name]), empId)}</select></div>
        <div class="field"><label>تاريخ المخالفة</label><input class="input" type="date" name="date" value="${date || A.todayISO()}"></div>
        <div class="field full"><label>المخالفة</label><select class="input" name="v">${A.options(A.VIOLATIONS.map((v) => [v.key, v.label]), vkey)}</select></div>
      </div><div class="note info mt" id="pen"></div>
      <div class="note warn mt">${A.icon('alert')}<div>لا يجوز توقيع الجزاء إلا بعد إبلاغ العامل كتابياً بما نُسب إليه والتحقيق معه وسماع أقواله، ولا يجوز اتهامه بمخالفة مضى على كشفها أكثر من 30 يوماً، ولا يزيد الحسم عن أجر 5 أيام في الشهر الواحد.</div></div>`,
      onMount: (b) => {
        const upd = () => {
          const e = b.querySelector('[name=emp]').value, k = b.querySelector('[name=v]').value;
          const occ = A.state.violations.filter((x) => x.empId === e && x.vkey === k).length + 1;
          const v = A.VIOLATIONS.find((x) => x.key === k);
          b.querySelector('#pen').innerHTML = `${A.icon('book')}<div>التكرار رقم <b>${occ}</b> خلال 180 يوماً — الجزاء المقرر في اللائحة: <b>${esc(v.p[Math.min(occ, 4) - 1])}</b></div>`;
        };
        b.querySelectorAll('select').forEach((s) => s.addEventListener('change', upd)); upd();
      },
      actions: [{ label: 'تسجيل وإحالة للتحقيق', kind: 'primary', onClick: (b) => {
        const f = (n) => b.querySelector(`[name=${n}]`).value;
        const occ = A.state.violations.filter((x) => x.empId === f('emp') && x.vkey === f('v')).length + 1;
        A.state.violations.unshift({ id: A.uid('V'), empId: f('emp'), vkey: f('v'), occurrence: occ, date: f('date'), status: 'قيد التحقيق', investigated: false });
        A.save(); A.toast('سُجّلت المخالفة'); A.go('#/hr/violations');
      } }, { label: 'إلغاء' }],
    });
  }
  A.route('/hr/violations', () => {
    const V = A.state.violations;
    return {
      title: 'المخالفات والجزاءات', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>المخالفات والجزاءات</h1><p>وفق لائحة تنظيم العمل المعتمدة والمواد 66–72 من نظام العمل.</p></div><button class="btn primary" id="new">${A.icon('plus')}تسجيل مخالفة</button></div>
        <div class="card mb"><div class="table-wrap"><table class="t"><thead><tr><th>الموظف</th><th>المخالفة</th><th>التاريخ</th><th>التكرار</th><th>الجزاء</th><th>الحالة</th><th></th></tr></thead><tbody>
          ${V.length ? V.map((v) => { const t = A.VIOLATIONS.find((x) => x.key === v.vkey); return `<tr><td class="cell-main">${esc(A.empName(v.empId))}</td><td class="small">${esc(t.label)}</td><td class="small">${A.gdate(v.date)}</td><td>${v.occurrence}</td><td class="small bold">${esc(t.p[Math.min(v.occurrence, 4) - 1])}</td><td>${A.badge(v.status, v.status === 'مُبلّغ' ? 'green' : 'amber')}</td>
            <td>${v.status === 'قيد التحقيق' ? `<button class="btn sm" data-inv="${v.id}">إنهاء التحقيق وإبلاغ</button>` : ''}</td></tr>`; }).join('') : `<tr><td colspan="7">${A.empty('لا توجد مخالفات')}</td></tr>`}
        </tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>جدول الجزاءات (مثال من اللائحة الداخلية)</h2></div><div class="table-wrap"><table class="t"><thead><tr><th>المخالفة</th><th>أول مرة</th><th>ثاني مرة</th><th>ثالث مرة</th><th>رابع مرة</th></tr></thead><tbody>
          ${A.VIOLATIONS.map((v) => `<tr><td class="small bold">${esc(v.label)}</td>${v.p.map((x) => `<td class="small">${esc(x)}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div></div>`,
      mount(root) {
        root.querySelector('#new').addEventListener('click', () => violationDialog());
        root.querySelectorAll('[data-inv]').forEach((b) => b.addEventListener('click', () => {
          const v = V.find((x) => x.id === b.dataset.inv); v.status = 'مُبلّغ'; v.investigated = true; A.save(); A.toast('أُبلغ الموظف بالجزاء'); A.render();
        }));
      },
    };
  });

  // ───── مكافأة نهاية الخدمة ─────
  A.route('/hr/eos', (p, q) => {
    const e = A.emp(q.emp) || A.state.employees[1];
    return {
      title: 'مكافأة نهاية الخدمة', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>حاسبة مكافأة نهاية الخدمة</h1><p>وفق المواد 84 و85 و87 من نظام العمل — تُحسب على أساس آخر أجر فعلي (الأساسي والبدلات الثابتة).</p></div></div>
        <div class="split-wide">
          <div class="card"><div class="card-body"><div class="form-grid">
            <div class="field full"><label>الموظف</label><select class="input" id="e">${A.options(A.state.employees.map((x) => [x.id, x.name]), e.id)}</select></div>
            <div class="field"><label>تاريخ المباشرة</label><input class="input" type="date" id="s"></div>
            <div class="field"><label>تاريخ انتهاء العلاقة</label><input class="input" type="date" id="t" value="${A.todayISO()}"></div>
            <div class="field"><label>آخر أجر شهري</label><input class="input" type="number" id="w"></div>
            <div class="field"><label>رصيد الإجازات غير المستخدمة (يوم)</label><input class="input" type="number" id="lv"></div>
            <div class="field full"><label>سبب انتهاء العلاقة التعاقدية</label><select class="input" id="r">${A.options(A.EOS_REASONS.map((x) => [x.key, x.label + ' — ' + x.art]))}</select></div>
          </div></div></div>
          <div class="card"><div class="card-head"><h2>النتيجة</h2></div><div class="card-body" id="out"></div></div>
        </div>`,
      mount(root) {
        const $ = (s) => root.querySelector(s);
        const fill = () => { const x = A.emp($('#e').value); $('#s').value = x.hireDate; $('#w').value = A.wage(x); $('#lv').value = A.annualBalance(x); calc(); };
        const calc = () => {
          const r = A.eos({ start: $('#s').value, end: $('#t').value, wage: +$('#w').value || 0, reason: $('#r').value });
          const lv = ((+$('#lv').value || 0) * (+$('#w').value || 0)) / 30;
          $('#out').innerHTML = `
            <div class="kpi" style="padding:0 0 12px"><div class="lbl">إجمالي المستحق</div><div class="val" style="color:var(--accent)">${A.money(r.award + lv)}</div></div>
            <table class="t"><tbody>
              <tr><td>مدة الخدمة</td><td style="text-align:left">${r.years.toFixed(2)} سنة (${r.days} يوماً)</td></tr>
              <tr><td>السنوات الخمس الأولى × نصف شهر</td><td class="num">${A.num((r.first * (+$('#w').value || 0)) / 2)}</td></tr>
              <tr><td>ما زاد على 5 سنوات × شهر كامل</td><td class="num">${A.num(r.rest * (+$('#w').value || 0))}</td></tr>
              <tr><td>المكافأة الكاملة</td><td class="num">${A.num(r.full)}</td></tr>
              <tr><td>نسبة الاستحقاق حسب السبب</td><td class="num">${Math.round(r.factor * 100)}%</td></tr>
              <tr><td class="bold">مكافأة نهاية الخدمة</td><td class="num bold">${A.num(r.award)}</td></tr>
              <tr><td>تعويض رصيد الإجازات</td><td class="num">${A.num(lv)}</td></tr>
            </tbody></table>
            <div class="note info mt">${A.icon('book')}<div>${esc(r.rule)}</div></div>
            <div class="note mt">${A.icon('info')}<div>تُصرف المستحقات خلال أسبوع من انتهاء العلاقة إن كان الإنهاء من صاحب العمل، وخلال أسبوعين إن كان العامل هو من أنهى العقد (المادة 88).</div></div>`;
        };
        $('#e').addEventListener('change', fill);
        ['#s', '#t', '#w', '#lv', '#r'].forEach((s) => $(s).addEventListener('input', calc));
        fill();
      },
    };
  });

  // ───── التوطين ─────
  A.route('/hr/saudization', () => {
    const emps = A.state.employees, S = emps.filter((e) => e.saudi).length, pct = (S / emps.length) * 100;
    const band = pct >= 40 ? ['بلاتيني', 'green'] : pct >= 30 ? ['أخضر مرتفع', 'green'] : pct >= 20 ? ['أخضر متوسط', 'green'] : pct >= 10 ? ['أخضر منخفض', 'amber'] : ['أحمر', 'red'];
    return {
      title: 'التوطين (نطاقات)', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>التوطين — نطاقات</h1><p>تقدير داخلي لمتابعة نسبة التوطين. النطاق الرسمي يُحتسب في منصة قوى حسب النشاط وحجم المنشأة.</p></div></div>
        <div class="grid g4 mb">
          ${A.kpi({ label: 'نسبة التوطين', value: pct.toFixed(1) + '%', tone: 'good' })}
          ${A.kpi({ label: 'الموظفون السعوديون', value: S })}
          ${A.kpi({ label: 'غير السعوديين', value: emps.length - S })}
          ${A.kpi({ label: 'النطاق التقديري', value: A.badge(band[0], band[1]), sub: 'الحدود الفعلية تختلف حسب النشاط' })}
        </div>
        <div class="card"><div class="card-head"><h2>حسب الإدارة</h2></div><div class="table-wrap"><table class="t"><thead><tr><th>الإدارة</th><th>الإجمالي</th><th>سعودي</th><th>غير سعودي</th><th style="width:35%">نسبة التوطين</th></tr></thead><tbody>
          ${A.state.departments.map((d) => { const all = emps.filter((e) => e.dept === d.id), s = all.filter((e) => e.saudi).length, p2 = all.length ? (s / all.length) * 100 : 0; return `<tr><td class="cell-main">${esc(d.name)}</td><td>${all.length}</td><td>${s}</td><td>${all.length - s}</td><td><div class="row" style="flex-wrap:nowrap"><div class="bar" style="flex:1"><i style="width:${p2}%"></i></div><span class="small bold" style="width:44px">${Math.round(p2)}%</span></div></td></tr>`; }).join('')}
        </tbody></table></div></div>
        <div class="note mt">${A.icon('info')}<div>يُحتسب العامل السعودي في نطاقات بشرط تسجيله في التأمينات بأجر لا يقل عن الحد الأدنى المعتمد. سيتم لاحقاً الربط مع منصات قوى ومقيم ومدد عبر واجهاتها البرمجية المعتمدة.</div></div>`,
    };
  });

  // ───── مرجع نظام العمل ─────
  A.route('/hr/policy', () => {
    const L = [
      ['المادة 98', 'ساعات العمل', ['8 ساعات يومياً أو 48 ساعة أسبوعياً بحد أقصى.', '6 ساعات يومياً أو 36 أسبوعياً للعاملين المسلمين في رمضان.', 'لا يعمل العامل أكثر من 5 ساعات متتالية دون فترة راحة.']],
      ['المادة 107', 'العمل الإضافي', ['يُدفع عن ساعة العمل الإضافية أجر يعادل أجر الساعة مضافاً إليه 50% من الأجر الأساسي.']],
      ['المادة 104', 'الراحة الأسبوعية', ['يوم الجمعة يوم الراحة الأسبوعية، ويجوز استبداله بأي يوم آخر بعد إبلاغ مكتب العمل، ولا تقل عن 24 ساعة متتالية.']],
      ['المادة 109', 'الإجازة السنوية', ['21 يوماً، تزيد إلى 30 يوماً بعد 5 سنوات متصلة.', 'لا يجوز النزول عنها أو تقاضي بدل نقدي عنها أثناء الخدمة.']],
      ['المادة 117', 'الإجازة المرضية', ['30 يوماً بأجر كامل، 60 يوماً بثلاثة أرباع الأجر، 30 يوماً بدون أجر — خلال السنة.']],
      ['المادة 151 (معدّلة)', 'إجازة الوضع', ['12 أسبوعاً بأجر كامل.', 'إجازة إضافية شهراً بدون أجر لرعاية مولود مريض أو ذي إعاقة.']],
      ['المادة 53 (معدّلة)', 'فترة التجربة', ['لا تزيد على 180 يوماً، ولا تدخل فيها إجازتا العيدين والإجازة المرضية.']],
      ['المادة 75 (معدّلة)', 'الإشعار بإنهاء العقد', ['غير محدد المدة: 60 يوماً من صاحب العمل، 30 يوماً من العامل.']],
      ['المادة 84', 'مكافأة نهاية الخدمة', ['نصف أجر شهر عن كل سنة من الخمس الأولى، وأجر شهر عن كل سنة بعدها.']],
      ['المادة 85', 'المكافأة عند الاستقالة', ['ثلث المكافأة بعد سنتين وأقل من 5، الثلثان من 5 إلى أقل من 10، كاملة بعد 10 سنوات.']],
      ['المادة 80', 'الفسخ دون مكافأة', ['حالات محددة حصراً منها: الاعتداء، عدم أداء الالتزامات الجوهرية، الغياب دون سبب مشروع للمدد المحددة نظاماً بعد الإنذار الكتابي.']],
      ['المادة 90', 'أداء الأجور', ['تُدفع الأجور بالعملة الرسمية عبر الحسابات البنكية ونظام حماية الأجور، في موعد استحقاقها.']],
      ['المواد 66–72', 'الجزاءات التأديبية', ['الإنذار، الغرامة، الحسم بما لا يزيد عن أجر 5 أيام شهرياً، الحرمان من العلاوة أو الترقية، الإيقاف، الفصل في الحالات المقررة.', 'لا يُوقّع جزاء بعد 30 يوماً من كشف المخالفة، ولا بعد التحقيق الكتابي مع العامل.']],
      ['نظام التأمينات', 'الاشتراكات', ['السعودي: معاشات 9% + 9%، ساند 0.75% + 0.75%، أخطار مهنية 2% على المنشأة.', 'غير السعودي: أخطار مهنية 2% على المنشأة.']],
    ];
    return {
      title: 'مرجع نظام العمل', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>مرجع نظام العمل السعودي</h1><p>ملخص المواد التي تعتمد عليها إجراءات التطبيق، محدّث وفق التعديلات النافذة من 19 فبراير 2025م.</p></div></div>
        <div class="note warn mb">${A.icon('alert')}<div>ملخص استرشادي لأغراض التصميم. يُراجع مع المستشار القانوني قبل الاعتماد، ويُحدّث مع كل تعديل يصدر عن وزارة الموارد البشرية والتنمية الاجتماعية.</div></div>
        <div class="grid g2">${L.map(([a, t, items]) => `<div class="law"><div class="art">${esc(a)}</div><h3>${esc(t)}</h3><ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}</div>`,
    };
  });
})(window.APP);
