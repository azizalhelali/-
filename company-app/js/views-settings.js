// الإعدادات: مسارات الاعتماد، الصلاحيات، الهيكل التنظيمي، الترويسة والترقيم.
(function (A) {
  const esc = (s) => A.esc(s);
  const CR = ['الإعدادات'];
  const PERMS = [['create', 'إعداد المسودات'], ['approve', 'اعتماد المعاملات'], ['send', 'الإصدار والإرسال'], ['hr', 'شؤون الموظفين'], ['payroll', 'الرواتب'], ['settings', 'الإعدادات']];
  const guard = () => (A.can('settings') ? '' : `<div class="note warn mb">${A.icon('shield')}<div>لا تملك صلاحية تعديل الإعدادات. يمكنك الاطلاع فقط — بدّل المستخدم إلى المدير العام أو مدير الشؤون الإدارية للتعديل.</div></div>`);

  A.route('/settings/workflows', () => {
    const W = A.state.workflows;
    const approvers = A.state.users.filter((u) => u.perms.includes('approve')).map((u) => [u.empId, A.empName(u.empId) + ' — ' + A.emp(u.empId).job]);
    return {
      title: 'مسارات الاعتماد', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>مسارات الاعتماد</h1><p>رحلة كل نوع من المعاملات: من يعتمد وبأي ترتيب. عند اكتمال آخر اعتماد تصدر المعاملة برقم آلياً.</p></div></div>
        ${guard()}
        <div class="grid g2">
          ${Object.keys(W).map((t) => `<div class="card" data-type="${t}"><div class="card-head">${A.icon(A.LT[t].icon)}<h2>${esc(A.LT[t].label)}</h2><span class="spacer"></span><span class="badge gray ltr">${esc(A.LT[t].prefix)}/${A.hyear()}/00001</span></div>
            <div class="card-body">
              <div class="wf-step"><span class="n">${A.icon('edit')}</span><span class="muted">المُعِد (أي مستخدم لديه صلاحية إعداد المسودات)</span></div>
              ${W[t].map((u, i) => `<div class="wf-step"><span class="n">${i + 1}</span>
                <select class="input" data-i="${i}" ${A.can('settings') ? '' : 'disabled'}>${A.options(approvers, u)}</select>
                <button class="btn sm ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} title="أعلى">${A.icon('up')}</button>
                <button class="btn sm ghost" data-down="${i}" ${i === W[t].length - 1 ? 'disabled' : ''} title="أسفل">${A.icon('down')}</button>
                <button class="btn sm ghost danger" data-rm="${i}" title="حذف">${A.icon('trash')}</button></div>`).join('')}
              <div class="wf-step"><span class="n">${A.icon('check')}</span><span class="muted">الإصدار برقم والإرسال</span></div>
              ${A.can('settings') ? `<button class="btn sm mt-s" data-add>${A.icon('plus')}إضافة مرحلة اعتماد</button>` : ''}
            </div></div>`).join('')}
        </div>
        <div class="note mt">${A.icon('info')}<div>لاحقاً: مسارات مشروطة (مثلاً: إضافة المدير المالي تلقائياً إذا تضمنت المعاملة التزاماً مالياً يتجاوز حداً معيناً)، والتفويض أثناء الإجازات.</div></div>`,
      mount(root) {
        if (!A.can('settings')) return;
        root.querySelectorAll('[data-type]').forEach((card) => {
          const t = card.dataset.type, list = W[t];
          const done = (msg) => { A.save(); A.toast(msg || 'حُفظ المسار'); A.render(); };
          card.addEventListener('change', (e) => { const s = e.target.closest('select[data-i]'); if (s) { list[+s.dataset.i] = s.value; done(); } });
          card.addEventListener('click', (e) => {
            const b = e.target.closest('button'); if (!b || b.disabled) return;
            if (b.dataset.up) { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; done(); }
            else if (b.dataset.down) { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; done(); }
            else if (b.dataset.rm) { if (list.length === 1) return A.toast('يلزم صاحب صلاحية واحد على الأقل', 'alert'); list.splice(+b.dataset.rm, 1); done('حُذفت المرحلة'); }
            else if (b.hasAttribute('data-add')) { list.push(approvers.find(([id]) => !list.includes(id))?.[0] || approvers[0][0]); done('أُضيفت مرحلة'); }
          });
        });
      },
    };
  });

  A.route('/settings/users', () => ({
    title: 'المستخدمون والصلاحيات', crumbs: CR,
    html: `
      <div class="page-head"><div><h1>المستخدمون والصلاحيات</h1><p>كل مستخدم مرتبط بسجله الوظيفي. الصلاحيات تحدد ما يظهر له وما يمكنه فعله.</p></div>
        ${A.can('settings') ? `<button class="btn primary" id="add">${A.icon('plus')}إضافة مستخدم</button>` : ''}</div>
      ${guard()}
      <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>المستخدم</th><th>الإدارة</th>${PERMS.map(([, t]) => `<th style="text-align:center">${t}</th>`).join('')}<th>التوقيع</th></tr></thead><tbody>
        ${A.state.users.map((u) => { const e = A.emp(u.empId); return `<tr><td><div class="row" style="flex-wrap:nowrap">${A.avatar(e.name)}<div><div class="cell-main">${esc(e.name)}</div><div class="cell-sub">${esc(e.job)}</div></div></div></td><td class="small">${esc(A.deptName(e.dept))}</td>
          ${PERMS.map(([k]) => `<td style="text-align:center"><input type="checkbox" data-u="${u.empId}" data-p="${k}" ${u.perms.includes(k) ? 'checked' : ''} ${A.can('settings') ? '' : 'disabled'}></td>`).join('')}
          <td><div class="row" style="flex-wrap:nowrap;gap:6px"><span class="sig-thumb">${A.signatureHtml(u.empId)}</span>${A.can('settings') || u.empId === A.state.currentUserId ? `<label class="btn sm" style="cursor:pointer">${u.signature ? 'تغيير' : 'رفع'}<input type="file" accept="image/*" data-sig="${u.empId}" hidden></label>${u.signature ? `<button class="btn sm ghost danger" data-sig-rm="${u.empId}" title="حذف">${A.icon('trash')}</button>` : ''}` : ''}</div></td></tr>`; }).join('')}
      </tbody></table></div></div>
      <div class="note mt">${A.icon('edit')}<div>التوقيع يظهر على الخطاب مع ختم الشركة فقط عند اكتمال الاعتماد. ارفع صورة التوقيع بخلفية بيضاء أو شفافة (PNG). إن لم يُرفع توقيع يظهر توقيع تجريبي.</div></div>
      <div class="note mt">${A.icon('shield')}<div>في النسخة النهائية: الدخول الموحّد (SSO) أو نفاذ، المصادقة الثنائية، وسجل تدقيق لكل عملية.</div></div>`,
    mount(root) {
      root.querySelectorAll('[data-u]').forEach((c) => c.addEventListener('change', () => {
        const u = A.user(c.dataset.u);
        u.perms = c.checked ? [...u.perms, c.dataset.p] : u.perms.filter((p) => p !== c.dataset.p);
        A.save(); A.toast('حُدّثت الصلاحيات');
      }));
      root.querySelectorAll('[data-sig]').forEach((i) => i.addEventListener('change', () => {
        A.readImage(i.files[0], 500).then((url) => { A.user(i.dataset.sig).signature = url; A.save(); A.toast('حُفظ التوقيع'); A.render(); })
          .catch(() => A.toast('اختر ملف صورة صالحاً', 'alert'));
      }));
      root.querySelectorAll('[data-sig-rm]').forEach((b) => b.addEventListener('click', () => { delete A.user(b.dataset.sigRm).signature; A.save(); A.toast('حُذف التوقيع'); A.render(); }));
      const add = root.querySelector('#add');
      if (add) add.addEventListener('click', () => {
        const free = A.state.employees.filter((e) => !A.user(e.id));
        if (!free.length) return A.toast('جميع الموظفين لديهم حسابات', 'info');
        A.modal({
          title: 'إضافة مستخدم',
          body: `<div class="field"><label>الموظف</label><select class="input" name="e">${A.options(free.map((e) => [e.id, e.name + ' — ' + e.job]))}</select></div>`,
          actions: [{ label: 'إضافة', kind: 'primary', onClick: (b) => { A.state.users.push({ empId: b.querySelector('[name=e]').value, perms: ['create'] }); A.save(); A.toast('أُضيف المستخدم'); A.render(); } }, { label: 'إلغاء' }],
        });
      });
    },
  }));

  A.route('/settings/org', () => ({
    title: 'الهيكل التنظيمي', crumbs: CR,
    html: `
      <div class="page-head"><div><h1>الهيكل التنظيمي</h1><p>الإدارات ومدراؤها — تُستخدم في توجيه المراسلات الداخلية وتحديد المدير المباشر.</p></div>
        ${A.can('settings') ? `<button class="btn primary" id="add">${A.icon('plus')}إضافة إدارة</button>` : ''}</div>
      ${guard()}
      <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>الإدارة</th><th>الرمز</th><th>المدير</th><th>عدد الموظفين</th></tr></thead><tbody>
        ${A.state.departments.map((d) => `<tr><td class="cell-main">${esc(d.name)}</td><td class="ltr" style="text-align:right">${esc(d.id)}</td>
          <td><select class="input" data-d="${d.id}" style="max-width:280px" ${A.can('settings') ? '' : 'disabled'}>${A.options(A.state.employees.map((e) => [e.id, e.name]), d.manager)}</select></td>
          <td>${A.state.employees.filter((e) => e.dept === d.id).length}</td></tr>`).join('')}
      </tbody></table></div></div>`,
    mount(root) {
      root.querySelectorAll('[data-d]').forEach((s) => s.addEventListener('change', () => { A.dept(s.dataset.d).manager = s.value; A.save(); A.toast('حُدّث مدير الإدارة'); }));
      const add = root.querySelector('#add');
      if (add) add.addEventListener('click', () => A.modal({
        title: 'إضافة إدارة',
        body: `<div class="form-grid"><div class="field"><label>اسم الإدارة</label><input class="input" name="n"></div><div class="field"><label>الرمز (بالإنجليزية)</label><input class="input ltr" name="c" style="text-align:left"></div>
          <div class="field full"><label>المدير</label><select class="input" name="m">${A.options(A.state.employees.map((e) => [e.id, e.name]))}</select></div></div>`,
        actions: [{ label: 'إضافة', kind: 'primary', onClick: (b) => {
          const f = (n) => b.querySelector(`[name=${n}]`).value.trim();
          const id = f('c').toUpperCase();
          if (!f('n') || !id) { A.toast('أكمل الاسم والرمز', 'alert'); return false; }
          if (A.dept(id)) { A.toast('الرمز مستخدم', 'alert'); return false; }
          A.state.departments.push({ id, name: f('n'), manager: f('m') }); A.save(); A.toast('أُضيفت الإدارة'); A.render();
        } }, { label: 'إلغاء' }],
      }));
    },
  }));

  A.route('/settings/letterhead', () => {
    const s = A.state.settings;
    const F = [['companyAr', 'اسم الشركة'], ['cr', 'رقم السجل التجاري'], ['vat', 'الرقم الضريبي'], ['address', 'العنوان'], ['phone', 'الهاتف'], ['email', 'البريد الرسمي']];
    const sample = { type: 'external', subject: 'نموذج للمعاينة', toEntity: 'اسم الجهة', body: 'هذا نص تجريبي لمعاينة شكل الترويسة الرسمية على الخطابات الصادرة.', attachments: [], steps: [{ userId: 'E1001' }], classification: 'عادي', priority: 'عادي', number: 'ص/' + A.hyear() + '/00000', issuedAt: new Date().toISOString() };
    const img = (key, label, help) => `<div class="field"><span class="lbl">${label}</span>
      <div class="img-slot">${key === 'logo' ? A.logoHtml() : A.sealHtml()}</div>
      ${A.can('settings') ? `<div class="row"><label class="btn sm" style="cursor:pointer">${A.icon('download')}${s[key] ? 'تغيير' : 'رفع صورة'}<input type="file" accept="image/*" data-img="${key}" hidden></label>${s[key] ? `<button class="btn sm ghost danger" data-img-rm="${key}">${A.icon('trash')}إزالة</button>` : ''}</div>` : ''}
      <span class="help">${help}</span></div>`;
    return {
      title: 'الترويسة والترقيم', crumbs: CR,
      html: `
        <div class="page-head"><div><h1>الترويسة والترقيم</h1><p>بيانات الترويسة الرسمية والشعار والختم وصيغة أرقام المعاملات.</p></div></div>
        ${guard()}
        <div class="split-wide">
          <div class="grid">
            <div class="card"><div class="card-head"><h2>بيانات الترويسة</h2></div><div class="card-body"><div class="form-grid">
              ${F.map(([k, t]) => `<div class="field ${k === 'address' ? 'full' : ''}"><label>${t}</label><input class="input" data-k="${k}" value="${esc(s[k])}" ${A.can('settings') ? '' : 'disabled'}></div>`).join('')}
            </div></div></div>
            <div class="card"><div class="card-head"><h2>الشعار والختم</h2></div><div class="card-body"><div class="form-grid">
              ${img('logo', 'شعار الشركة', 'يظهر في وسط الترويسة. PNG بخلفية شفافة.')}
              ${img('seal', 'ختم الشركة', 'يظهر بجانب توقيع المعتمد عند الإصدار. إن لم يُرفع يُستخدم ختم مولّد من بيانات الشركة.')}
            </div></div></div>
            <div class="card"><div class="card-head"><h2>صيغة الترقيم</h2></div><div class="card-body flush"><table class="t"><thead><tr><th>النوع</th><th>البادئة</th><th>آخر رقم</th><th>الرقم التالي</th></tr></thead><tbody>
              ${Object.entries(A.LT).map(([k, t]) => `<tr><td>${esc(t.label)}</td><td class="bold">${esc(t.prefix)}</td><td>${A.state.counters[k] || 0}</td><td class="ltr" style="text-align:right">${esc(t.prefix)}/${A.hyear()}/${String((A.state.counters[k] || 0) + 1).padStart(5, '0')}</td></tr>`).join('')}
            </tbody></table></div></div>
            <div class="card"><div class="card-head"><h2>البيانات التجريبية</h2></div><div class="card-body row"><span class="muted small" style="flex:1">تُحفظ البيانات في متصفحك فقط. يمكنك إعادتها لحالتها الأولى.</span><button class="btn danger" id="reset">${A.icon('back')}إعادة ضبط البيانات</button></div></div>
          </div>
          <div id="pv">${A.paper(sample)}</div>
        </div>`,
      mount(root) {
        root.querySelectorAll('[data-k]').forEach((i) => i.addEventListener('input', () => { s[i.dataset.k] = i.value; A.save(); root.querySelector('#pv').innerHTML = A.paper(sample); }));
        root.querySelectorAll('[data-img]').forEach((i) => i.addEventListener('change', () => {
          A.readImage(i.files[0], i.dataset.img === 'logo' ? 400 : 360).then((url) => { s[i.dataset.img] = url; A.save(); A.toast('حُفظت الصورة'); A.render(); })
            .catch(() => A.toast('اختر ملف صورة صالحاً', 'alert'));
        }));
        root.querySelectorAll('[data-img-rm]').forEach((b) => b.addEventListener('click', () => { delete s[b.dataset.imgRm]; A.save(); A.toast('أُزيلت الصورة'); A.render(); }));
        root.querySelector('#reset').addEventListener('click', () => A.confirm('إعادة ضبط البيانات', 'ستُحذف كل التعديلات وتعود البيانات التجريبية لحالتها الأولى.', 'إعادة الضبط', A.resetData, 'danger'));
      },
    };
  });
})(window.APP);
