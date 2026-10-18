// المراسلات: إعداد المسودة ← رحلة الاعتماد ← الإصدار برقم ← الإرسال داخلياً أو بالبريد الإلكتروني.
(function (A) {
  const esc = (s) => A.esc(s);

  // ───── منطق رحلة الاعتماد ─────
  A.currentStep = (l) => (l.steps || []).find((s) => s.status === 'pending');
  A.nextNumber = (type) => {
    A.state.counters[type] = (A.state.counters[type] || 0) + 1;
    return `${A.LT[type].prefix}/${A.hyear()}/${String(A.state.counters[type]).padStart(5, '0')}`;
  };
  const log = (l, text, by = A.state.currentUserId) => l.history.push({ at: new Date().toISOString(), by, text });

  A.submitLetter = (l) => {
    l.steps = (A.state.workflows[l.type] || []).map((userId) => ({ userId, status: 'pending', at: null, note: '' }));
    l.status = 'review';
    log(l, l.history.some((h) => h.text.includes('للاعتماد')) ? 'أعاد إرسال المسودة للاعتماد بعد التعديل' : 'أرسل المسودة للاعتماد');
    if (!l.steps.length) A.issueLetter(l);
  };
  A.issueLetter = (l) => {
    l.number = A.nextNumber(l.type);
    l.issuedAt = new Date().toISOString();
    l.status = 'issued';
    log(l, 'صدرت المعاملة برقم ' + l.number);
  };
  A.approveLetter = (l, note) => {
    const s = A.currentStep(l);
    Object.assign(s, { status: 'approved', at: new Date().toISOString(), note });
    log(l, 'اعتمد المعاملة' + (note ? ': ' + note : ''));
    if (!A.currentStep(l)) A.issueLetter(l);
  };
  A.returnLetter = (l, note) => {
    const s = A.currentStep(l);
    Object.assign(s, { status: 'returned', at: new Date().toISOString(), note });
    l.status = 'returned';
    log(l, 'أعاد المعاملة للتعديل: ' + note);
  };
  A.rejectLetter = (l, note) => {
    const s = A.currentStep(l);
    Object.assign(s, { status: 'rejected', at: new Date().toISOString(), note });
    l.status = 'rejected';
    log(l, 'رفض المعاملة: ' + note);
  };
  A.newDraft = (fields) => {
    const me = A.me();
    const l = {
      id: A.uid('L'), type: 'external', status: 'draft', subject: '', body: '',
      recipientKind: 'external', toEntity: '', toEmail: '', toDepts: [], ccDepts: [],
      fromDept: me.dept, classification: 'عادي', priority: 'عادي', attachments: [],
      createdBy: me.id, createdAt: new Date().toISOString(), steps: [], number: null, issuedAt: null, sentLog: [], history: [],
      ...fields,
    };
    l.recipientKind = l.type === 'external' ? 'external' : 'internal';
    log(l, 'أنشأ المسودة');
    A.state.letters.unshift(l);
    A.save();
    return l;
  };

  // ───── قوالب جاهزة ─────
  const TPL = {
    external: [
      ['', 'بدون قالب'],
      ['نفيدكم بأن ...\n\nوعليه نأمل منكم التكرم بـ ...\n\nشاكرين لكم حسن تعاونكم.', 'طلب تعاون'],
      ['نتقدم لكم بخالص الشكر والتقدير على ...، ونؤكد حرص الشركة على استمرار التعاون المثمر بيننا.', 'خطاب شكر'],
      ['نأمل منكم التكرم بتزويدنا بعرض سعر لـ ... وفق المواصفات المرفقة، على أن يشمل العرض مدة التوريد وشروط الدفع والضمان، ويصلنا في موعد أقصاه ... من تاريخه.', 'طلب عرض سعر'],
      ['تشهد الشركة بأن الموظف/ ... ، ويحمل هوية رقم ( ... )، يعمل لديها بوظيفة ( ... ) منذ تاريخ ... ، ويتقاضى راتباً شهرياً إجمالياً قدره ( ... ) ريال.\n\nوقد أُعطي هذا الخطاب بناءً على طلبه دون أدنى مسؤولية على الشركة.', 'خطاب تعريف بالراتب'],
    ],
    internal: [
      ['', 'بدون قالب'],
      ['نأمل التكرم بـ ...\n\nعلماً بأن ...', 'طلب إجراء'],
      ['إشارة إلى ... ، نفيدكم بأنه ...', 'إفادة'],
    ],
    decision: [
      ['', 'بدون قالب'],
      ['أولاً: يُعيّن السيد/ ... بوظيفة ( ... ) في إدارة ( ... )، اعتباراً من تاريخ مباشرته العمل، وبراتب أساسي قدره ( ... ) ريال، وفق عقد العمل الموثّق في منصة قوى.\n\nثانياً: يخضع المذكور لفترة تجربة مدتها ( 90 ) يوماً.\n\nثالثاً: يُبلّغ هذا القرار لمن يلزم لاعتماده والعمل بموجبه.', 'قرار تعيين'],
      ['أولاً: يُكلّف السيد/ ... بمهام ( ... ) بالإنابة، اعتباراً من ... ولمدة ( ... ).\n\nثانياً: يُبلّغ هذا القرار لمن يلزم لاعتماده والعمل بموجبه.', 'قرار تكليف'],
      ['أولاً: تُشكّل لجنة برئاسة ... وعضوية كل من:\n1. ...\n2. ...\n\nثانياً: تتولى اللجنة ... ، وترفع توصياتها خلال ( ... ) يوماً.\n\nثالثاً: يُبلّغ هذا القرار لمن يلزم لاعتماده والعمل بموجبه.', 'قرار تشكيل لجنة'],
    ],
    circular: [
      ['', 'بدون قالب'],
      ['نود إحاطة جميع منسوبي الشركة بأن ساعات العمل خلال شهر رمضان المبارك ستكون من الساعة ... وحتى الساعة ... ، بواقع 6 ساعات يومياً للعاملين المسلمين وفقاً للمادة (98) من نظام العمل.', 'دوام شهر رمضان'],
      ['بمناسبة إجازة ... ، نود إحاطة الجميع بأن الإجازة تبدأ من نهاية دوام يوم ... الموافق ... ، ويكون العودة للعمل يوم ... الموافق ... .\n\nكل عام وأنتم بخير.', 'إجازة رسمية'],
    ],
    report: [
      ['', 'بدون قالب'],
      ['يسرّنا أن نرفع لسعادتكم التقرير ... ، والذي يتضمن:\n\n1. ...\n2. ...\n3. ...\n\nالتوصيات:\n- ...', 'تقرير دوري'],
    ],
  };

  // ───── صفحات القوائم ─────
  const recipientText = (l) => {
    if (l.type === 'incoming') return 'من: ' + (l.fromEntity || '');
    if (l.recipientKind === 'external') return 'إلى: ' + (l.toEntity || '—');
    const d = l.toDepts || [];
    if (d.length === A.state.departments.length) return 'إلى: جميع الإدارات';
    return 'إلى: ' + (d.map(A.deptName).join('، ') || '—');
  };
  const stageText = (l) => {
    if (l.status === 'review') { const s = A.currentStep(l); return s ? 'لدى: ' + A.empName(s.userId) : ''; }
    if (l.status === 'returned') return 'لدى المُعِد للتعديل';
    if (l.type === 'incoming') return 'محالة إلى: ' + A.deptName(l.assignedDept);
    if (l.status === 'sent') return 'أُرسلت ' + A.gdate(l.sentLog.slice(-1)[0]?.at);
    return '';
  };
  const row = (l, inbox) => `<tr class="click" data-href="#/corr/view/${l.id}" data-type="${l.type}" data-text="${esc([l.number, l.subject, recipientText(l)].join(' ').toLowerCase())}">
      <td>${inbox && A.unread(l) ? '<b>' : ''}<span class="ltr">${esc(l.number || '—')}</span>${inbox && A.unread(l) ? '</b>' : ''}</td>
      <td style="min-width:260px"><div class="cell-main">${inbox && A.unread(l) ? '● ' : ''}${esc(l.subject)}</div><div class="cell-sub">${esc(recipientText(l))}</div></td>
      <td><span class="row" style="gap:6px">${A.icon(A.LT[l.type].icon)}${esc(A.LT[l.type].label)}</span></td>
      <td>${A.statusBadge(l.status)}${l.classification !== 'عادي' ? ' ' + A.badge(l.classification, 'red') : ''}</td>
      <td class="small muted">${esc(stageText(l))}</td>
      <td>${A.priorityBadge(l.priority)}</td>
      <td class="small muted" style="white-space:nowrap">${A.gdate(l.issuedAt || l.createdAt)}</td>
    </tr>`;

  function listPage({ title, desc, items, emptyText, head = '', inbox = false }) {
    const types = [...new Set(items.map((l) => l.type))];
    return {
      title, crumbs: ['المراسلات'],
      html: `
        <div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="row">${head}<a class="btn primary" href="#/corr/new">${A.icon('plus')}معاملة جديدة</a></div></div>
        <div class="card">
          <div class="card-head">
            <input class="input" id="flt-q" placeholder="تصفية بالرقم أو الموضوع أو الجهة…" style="max-width:320px">
            <select class="input" id="flt-t" style="max-width:180px"><option value="">كل الأنواع</option>${A.options(types.map((t) => [t, A.LT[t].label]))}</select>
            <span class="spacer"></span><span class="muted small" id="flt-n">${items.length} معاملة</span>
          </div>
          ${items.length ? `<div class="table-wrap"><table class="t">
            <thead><tr><th>الرقم</th><th>الموضوع</th><th>النوع</th><th>الحالة</th><th>المرحلة</th><th>الأولوية</th><th>التاريخ</th></tr></thead>
            <tbody>${items.map((l) => row(l, inbox)).join('')}</tbody></table></div>` : A.empty(emptyText)}
        </div>`,
      mount(root) {
        bindRows(root);
        const q = root.querySelector('#flt-q'), t = root.querySelector('#flt-t');
        const apply = () => {
          let n = 0;
          root.querySelectorAll('tbody tr').forEach((tr) => {
            const ok = (!t.value || tr.dataset.type === t.value) && tr.dataset.text.includes(q.value.trim().toLowerCase());
            tr.style.display = ok ? '' : 'none';
            n += ok;
          });
          root.querySelector('#flt-n').textContent = n + ' معاملة';
        };
        q.addEventListener('input', apply);
        t.addEventListener('change', apply);
        const reg = root.querySelector('#reg-incoming');
        if (reg) reg.addEventListener('click', registerIncoming);
      },
    };
  }
  const bindRows = (root) => root.querySelectorAll('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.href)));
  A.bindRows = bindRows;
  A.letterRow = row;

  const mine = (l) => l.createdBy === A.state.currentUserId;
  const byDate = (a, b) => new Date(b.issuedAt || b.createdAt) - new Date(a.issuedAt || a.createdAt);

  A.route('/corr/pending', () => listPage({
    title: 'بانتظار اعتمادي', desc: 'المعاملات التي وصلت في رحلتها إليك وتنتظر قرارك.',
    items: A.myPending().sort(byDate), emptyText: 'لا توجد معاملات بانتظار اعتمادك.',
  }));
  A.route('/corr/inbox', () => listPage({
    title: 'الوارد', desc: 'ما وصل إلى إدارتك من الإدارات الأخرى أو من جهات خارجية.',
    items: A.myInbox().sort(byDate), emptyText: 'لا يوجد وارد.', inbox: true,
    head: `<button class="btn" id="reg-incoming">${A.icon('inbox')}تسجيل وارد خارجي</button>`,
  }));
  A.route('/corr/drafts', () => listPage({
    title: 'مسوداتي', desc: 'المسودات التي أعددتها ولم تُرسل للاعتماد بعد، والمعاملات المعادة إليك للتعديل.',
    items: A.state.letters.filter((l) => mine(l) && ['draft', 'returned'].includes(l.status)).sort(byDate), emptyText: 'لا توجد مسودات.',
  }));
  A.route('/corr/tracking', () => listPage({
    title: 'متابعة الاعتماد', desc: 'كل المعاملات الجارية في رحلة الاعتماد ومن تقف لديه الآن.',
    items: A.state.letters.filter((l) => ['review', 'returned'].includes(l.status)).sort(byDate), emptyText: 'لا توجد معاملات قيد الاعتماد.',
  }));
  A.route('/corr/outgoing', () => listPage({
    title: 'الصادر', desc: 'المعاملات المعتمدة التي صدرت برقم — المرسلة والتي تنتظر الإرسال.',
    items: A.state.letters.filter((l) => ['issued', 'sent'].includes(l.status) && l.type !== 'incoming').sort(byDate), emptyText: 'لا يوجد صادر.',
  }));
  A.route('/corr/archive', () => listPage({
    title: 'الأرشيف', desc: 'سجل كامل بجميع المعاملات الصادرة والواردة.',
    items: A.state.letters.slice().sort(byDate), emptyText: 'الأرشيف فارغ.',
  }));

  function registerIncoming() {
    A.modal({
      title: 'تسجيل وارد خارجي',
      body: `<div class="form-grid">
        <div class="field full"><label>الجهة المرسلة</label><input class="input" name="from" placeholder="مثال: الغرفة التجارية"></div>
        <div class="field"><label>رقم خطاب الجهة</label><input class="input" name="ref"></div>
        <div class="field"><label>إحالة إلى</label><select class="input" name="dept">${A.options(A.state.departments.map((d) => [d.id, d.name]), A.me().dept)}</select></div>
        <div class="field full"><label>الموضوع</label><input class="input" name="subject"></div>
        <div class="field"><label>الأولوية</label><select class="input" name="priority">${A.options(A.PRIORITY)}</select></div>
        <div class="field"><label>السرية</label><select class="input" name="cls">${A.options(A.CLASSIFICATION)}</select></div>
        <div class="field full"><label>ملخص المحتوى</label><textarea class="input" name="body" style="min-height:90px"></textarea></div>
        <div class="field full"><label>صورة الخطاب</label><input type="file" class="input" name="file" accept=".pdf,image/*"></div>
      </div>`,
      actions: [{
        label: 'تسجيل وإحالة', kind: 'primary', icon: 'check', onClick: (b) => {
          const f = (n) => b.querySelector(`[name=${n}]`);
          if (!f('from').value.trim() || !f('subject').value.trim()) { A.toast('أدخل الجهة والموضوع', 'alert'); return false; }
          const l = {
            id: A.uid('L'), type: 'incoming', status: 'incoming', subject: f('subject').value.trim(), body: f('body').value.trim(),
            fromEntity: f('from').value.trim(), externalRef: f('ref').value.trim(), assignedDept: f('dept').value, receivedAt: new Date().toISOString(),
            recipientKind: 'external', toDepts: [], classification: f('cls').value, priority: f('priority').value,
            attachments: f('file').files[0] ? [f('file').files[0].name] : [], createdBy: A.state.currentUserId, createdAt: new Date().toISOString(),
            steps: [], number: A.nextNumber('incoming'), sentLog: [], readBy: [], history: [],
          };
          l.issuedAt = l.receivedAt;
          log(l, 'سجّل الوارد برقم ' + l.number + ' وأحاله إلى ' + A.deptName(l.assignedDept));
          A.state.letters.unshift(l);
          A.save();
          A.toast('سُجّل الوارد برقم ' + l.number);
          A.go('#/corr/view/' + l.id);
        },
      }, { label: 'إلغاء' }],
    });
  }

  // ───── إنشاء / تعديل معاملة ─────
  function composer(existing, query) {
    const me = A.me();
    const d = existing ? JSON.parse(JSON.stringify(existing)) : {
      type: A.LT[query.type] && query.type !== 'incoming' ? query.type : 'external', subject: '', body: '', toEntity: '', toEmail: '',
      toDepts: [], ccDepts: [], classification: 'عادي', priority: 'عادي', attachments: [], steps: [], number: null, fromDept: me.dept,
    };
    if (!d.ccDepts) d.ccDepts = [];
    const types = Object.entries(A.LT).filter(([k]) => k !== 'incoming');
    const returned = existing && existing.status === 'returned' ? existing.steps.find((s) => s.status === 'returned') : null;

    return {
      title: existing ? 'تعديل المعاملة' : 'إنشاء معاملة جديدة', crumbs: [['المراسلات', '#/corr/drafts']],
      html: `
        ${returned ? `<div class="note warn mb">${A.icon('back')}<div><b>أُعيدت للتعديل من ${esc(A.empName(returned.userId))}:</b> ${esc(returned.note)}</div></div>` : ''}
        <div class="split-wide">
          <div class="card"><div class="card-body">
            <div class="field mb"><span class="lbl">نوع المعاملة</span><div class="chips" id="c-type">${types.map(([k, t]) => `<button type="button" class="chip ${d.type === k ? 'on' : ''}" data-v="${k}">${esc(t.label)}</button>`).join('')}</div></div>
            <div class="form-grid">
              <div class="field full"><label for="f-tpl">قالب جاهز</label><select class="input" id="f-tpl"></select></div>
              <div class="field full"><label for="f-subject">الموضوع</label><input class="input" id="f-subject" value="${esc(d.subject)}" placeholder="موضوع المعاملة"></div>
              <div class="full" id="recipients"></div>
              <div class="field"><label for="f-cls">درجة السرية</label><select class="input" id="f-cls">${A.options(A.CLASSIFICATION, d.classification)}</select></div>
              <div class="field"><label for="f-pri">الأولوية</label><select class="input" id="f-pri">${A.options(A.PRIORITY, d.priority)}</select></div>
              <div class="field full"><label for="f-body">نص المعاملة</label><textarea class="input" id="f-body" style="min-height:240px" placeholder="اكتب نص المعاملة هنا. اترك سطراً فارغاً بين الفقرات.">${esc(d.body)}</textarea></div>
              <div class="field full"><span class="lbl">المرفقات</span>
                <div class="row"><label class="btn sm" style="cursor:pointer">${A.icon('clip')}إرفاق ملف<input type="file" id="f-files" multiple hidden></label><span class="chips" id="att-list"></span></div>
              </div>
            </div>
            <div class="mt" style="border-top:1px solid var(--line);padding-top:14px">
              <div class="lbl small bold mb" style="margin-bottom:8px">رحلة الاعتماد لهذا النوع</div>
              <div id="wf-preview"></div>
              <div class="help small muted mt-s">عند اكتمال اعتماد جميع أصحاب الصلاحية تصدر المعاملة برقم آلياً وتصبح جاهزة للإرسال. يمكن تعديل المسار من الإعدادات.</div>
            </div>
            <div class="row mt">
              <button class="btn primary" id="b-submit">${A.icon('send')}إرسال للاعتماد</button>
              <button class="btn" id="b-save">${A.icon('check')}حفظ كمسودة</button>
              <span class="spacer"></span>
              ${existing && existing.status === 'draft' ? `<button class="btn danger" id="b-del">${A.icon('trash')}حذف</button>` : ''}
            </div>
          </div></div>
          <div><div class="small muted mb" style="margin-bottom:8px">معاينة مباشرة على الترويسة الرسمية</div><div id="preview"></div></div>
        </div>`,
      mount(root) {
        const $ = (s) => root.querySelector(s);
        const preview = () => { $('#preview').innerHTML = A.paper({ ...d, number: null, steps: (A.state.workflows[d.type] || []).map((u) => ({ userId: u })) }); };
        const wf = () => {
          const ids = A.state.workflows[d.type] || [];
          $('#wf-preview').innerHTML = `<div class="flow-inline"><span class="pill">${esc(me.name)} (المُعِد)</span>${ids.map((u) => `<span class="arrow">←</span><span class="pill">${esc(A.emp(u).job)}</span>`).join('')}<span class="arrow">←</span><span class="pill" style="background:var(--accent-soft);border-color:var(--accent);color:var(--accent)">إصدار برقم ${esc(A.LT[d.type].prefix)}/${A.hyear()}/…</span></div>`;
        };
        const tpl = () => { $('#f-tpl').innerHTML = (TPL[d.type] || []).map((t, i) => `<option value="${i}">${esc(t[1])}</option>`).join(''); };
        const deptChips = (key, all) => `<div class="chips" data-key="${key}">${all ? `<button type="button" class="chip" data-all>الكل</button>` : ''}${A.state.departments.map((x) => `<button type="button" class="chip ${d[key].includes(x.id) ? 'on' : ''}" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>`;
        const recips = () => {
          let h = '';
          if (d.type === 'external') {
            h = `<div class="form-grid"><div class="field"><label>الجهة المرسل إليها</label><input class="input" id="f-entity" value="${esc(d.toEntity)}" placeholder="اسم الجهة"></div>
                 <div class="field"><label>البريد الإلكتروني للجهة</label><input class="input ltr" id="f-email" type="email" value="${esc(d.toEmail)}" placeholder="name@entity.sa" style="text-align:left"></div></div>`;
          } else {
            const lbl = { internal: 'الإدارات المرسل إليها', decision: 'يُبلَّغ القرار إلى', circular: 'نطاق التعميم', report: 'يُرفع التقرير إلى' }[d.type];
            h = `<div class="field"><span class="lbl">${lbl}</span>${deptChips('toDepts', d.type === 'circular')}</div>`;
          }
          if (d.type !== 'circular') h += `<div class="field mt-s"><span class="lbl">نسخة إلى (اختياري)</span>${deptChips('ccDepts')}</div>`;
          $('#recipients').innerHTML = h;
          const e = $('#f-entity'), m = $('#f-email');
          if (e) e.addEventListener('input', () => { d.toEntity = e.value; preview(); });
          if (m) m.addEventListener('input', () => { d.toEmail = m.value; });
          root.querySelectorAll('#recipients .chips').forEach((box) => box.addEventListener('click', (ev) => {
            const b = ev.target.closest('.chip'); if (!b) return;
            const key = box.dataset.key;
            if (b.hasAttribute('data-all')) d[key] = d[key].length === A.state.departments.length ? [] : A.state.departments.map((x) => x.id);
            else d[key] = d[key].includes(b.dataset.v) ? d[key].filter((x) => x !== b.dataset.v) : [...d[key], b.dataset.v];
            box.querySelectorAll('.chip[data-v]').forEach((c) => c.classList.toggle('on', d[key].includes(c.dataset.v)));
            preview();
          }));
        };
        const atts = () => {
          $('#att-list').innerHTML = d.attachments.map((a, i) => `<span class="chip">${esc(a)} <a href="javascript:void 0" data-rm="${i}" title="إزالة">✕</a></span>`).join('') || '<span class="muted small">لا توجد مرفقات</span>';
        };

        $('#c-type').addEventListener('click', (ev) => {
          const b = ev.target.closest('.chip'); if (!b) return;
          d.type = b.dataset.v;
          if (d.type === 'circular' && !d.toDepts.length) d.toDepts = A.state.departments.map((x) => x.id);
          root.querySelectorAll('#c-type .chip').forEach((c) => c.classList.toggle('on', c === b));
          tpl(); recips(); wf(); preview();
        });
        $('#f-tpl').addEventListener('change', (ev) => {
          const t = TPL[d.type][+ev.target.value];
          if (!t || !t[0]) return;
          if (d.body.trim() && !confirm('سيُستبدل النص الحالي بالقالب. متابعة؟')) return;
          d.body = t[0]; $('#f-body').value = t[0];
          if (!d.subject) { d.subject = t[1]; $('#f-subject').value = t[1]; }
          preview();
        });
        $('#f-subject').addEventListener('input', (e) => { d.subject = e.target.value; preview(); });
        $('#f-body').addEventListener('input', (e) => { d.body = e.target.value; preview(); });
        $('#f-cls').addEventListener('change', (e) => { d.classification = e.target.value; preview(); });
        $('#f-pri').addEventListener('change', (e) => { d.priority = e.target.value; preview(); });
        $('#f-files').addEventListener('change', (e) => { d.attachments.push(...[...e.target.files].map((f) => f.name)); e.target.value = ''; atts(); preview(); });
        $('#att-list').addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (r) { d.attachments.splice(+r.dataset.rm, 1); atts(); preview(); } });

        const persist = () => {
          const fields = { type: d.type, subject: d.subject.trim(), body: d.body, toEntity: d.toEntity, toEmail: d.toEmail, toDepts: d.toDepts, ccDepts: d.ccDepts, classification: d.classification, priority: d.priority, attachments: d.attachments };
          fields.recipientKind = d.type === 'external' ? 'external' : 'internal';
          if (existing) { Object.assign(existing, fields); return existing; }
          return A.newDraft(fields);
        };
        const validate = () => {
          if (!d.subject.trim()) return 'أدخل موضوع المعاملة';
          if (!d.body.trim()) return 'أدخل نص المعاملة';
          if (d.type === 'external' && !d.toEntity.trim()) return 'أدخل الجهة المرسل إليها';
          if (d.type === 'external' && d.toEmail && !/^\S+@\S+\.\S+$/.test(d.toEmail)) return 'البريد الإلكتروني غير صحيح';
          if (d.type !== 'external' && !d.toDepts.length) return 'اختر إدارة واحدة على الأقل';
          return '';
        };
        $('#b-save').addEventListener('click', () => {
          if (!d.subject.trim()) return A.toast('أدخل موضوع المعاملة على الأقل', 'alert');
          const l = persist();
          if (existing) { log(l, 'عدّل المسودة'); }
          A.save(); A.toast('حُفظت المسودة');
          A.go('#/corr/view/' + l.id);
        });
        $('#b-submit').addEventListener('click', () => {
          const err = validate(); if (err) return A.toast(err, 'alert');
          const l = persist();
          A.submitLetter(l);
          A.save();
          const s = A.currentStep(l);
          A.toast(s ? 'أُرسلت للاعتماد — لدى ' + A.empName(s.userId) : 'صدرت برقم ' + l.number, 'send');
          A.go('#/corr/view/' + l.id);
        });
        const del = $('#b-del');
        if (del) del.addEventListener('click', () => A.confirm('حذف المسودة', 'سيتم حذف هذه المسودة نهائياً.', 'حذف', () => {
          A.state.letters = A.state.letters.filter((x) => x !== existing); A.save(); A.toast('حُذفت المسودة'); A.go('#/corr/drafts');
        }, 'danger'));

        tpl(); recips(); wf(); atts(); preview();
      },
    };
  }
  A.route('/corr/new', (p, q) => composer(null, q));
  A.route('/corr/edit/:id', (p, q) => {
    const l = A.letter(p.id);
    if (!l || !['draft', 'returned'].includes(l.status)) return notFound();
    return composer(l, q);
  });

  const notFound = () => ({ title: 'غير موجود', html: A.empty('المعاملة غير موجودة أو لا يمكن تعديلها.') });

  // ───── عرض المعاملة ─────
  function timeline(l) {
    const items = [];
    items.push(`<li class="done"><span class="tl-dot">${A.icon('check')}</span><div class="tl-body"><div class="who">${esc(A.empName(l.createdBy))}</div><div class="role">المُعِد — ${esc(A.deptName(l.fromDept))}</div><div class="when">${A.dt(l.createdAt)}</div></div></li>`);
    let reachedCurrent = false;
    (l.steps || []).forEach((s, i) => {
      const e = A.emp(s.userId);
      let cls = '', dot = i + 1, when = '';
      if (s.status === 'approved') { cls = 'done'; dot = A.icon('check'); when = 'اعتمد ' + A.dt(s.at); }
      else if (s.status === 'returned' || s.status === 'rejected') { cls = 'back'; dot = A.icon(s.status === 'returned' ? 'back' : 'x'); when = (s.status === 'returned' ? 'أعاد للتعديل ' : 'رفض ') + A.dt(s.at); }
      else if (!reachedCurrent && l.status === 'review') { cls = 'current'; reachedCurrent = true; when = 'بانتظار الاعتماد'; }
      else when = 'لم تصل بعد';
      items.push(`<li class="${cls}"><span class="tl-dot">${dot}</span><div class="tl-body"><div class="who">${esc(e.name)}</div><div class="role">${esc(e.job)}</div><div class="when">${when}</div>${s.note ? `<div class="msg">${esc(s.note)}</div>` : ''}</div></li>`);
    });
    const issued = !!l.number;
    items.push(`<li class="${issued ? 'done' : ''}"><span class="tl-dot">${issued ? A.icon('check') : A.icon('file')}</span><div class="tl-body"><div class="who">الإصدار برقم</div><div class="when">${issued ? `<span class="ltr bold">${esc(l.number)}</span> — ${A.dt(l.issuedAt)}` : 'آلياً عند اكتمال الاعتماد'}</div></div></li>`);
    if (l.status === 'sent') {
      items.push(`<li class="done"><span class="tl-dot">${A.icon('send')}</span><div class="tl-body"><div class="who">الإرسال</div>${l.sentLog.map((s) => `<div class="when">${s.channel === 'email' ? 'بريد إلكتروني إلى ' : 'داخلياً إلى '}<span class="ltr">${esc(s.to)}</span> — ${A.dt(s.at)}</div>`).join('')}</div></li>`);
    }
    return `<ol class="timeline">${items.join('')}</ol>`;
  }

  function actionsCard(l) {
    const me = A.state.currentUserId;
    const step = A.currentStep(l);
    let h = '';
    if (l.status === 'review' && step && step.userId === me) {
      h = `<div class="note info mb">${A.icon('info')}<div>هذه المعاملة بانتظار اعتمادك بصفتك <b>${esc(A.emp(me).job)}</b>.</div></div>
        <div class="field"><label for="a-note">ملاحظة / توجيه (إلزامية عند الإعادة أو الرفض)</label><textarea class="input" id="a-note" style="min-height:80px"></textarea></div>
        <div class="row mt">
          <button class="btn primary" data-act="approve">${A.icon('check')}${A.state.workflows[l.type] && l.steps.filter((s) => s.status === 'pending').length === 1 ? 'اعتماد نهائي وإصدار' : 'اعتماد وتمرير'}</button>
          <button class="btn" data-act="return">${A.icon('back')}إعادة للتعديل</button>
          <button class="btn danger" data-act="reject">${A.icon('x')}رفض</button>
        </div>`;
    } else if (l.status === 'review') {
      h = `<div class="note">${A.icon('clock')}<div>بانتظار اعتماد <b>${esc(A.empName(step.userId))}</b> — ${esc(A.emp(step.userId).job)}.<div class="small muted mt-s">للتجربة: بدّل المستخدم من أسفل القائمة الجانبية.</div></div></div>`;
    } else if (['draft', 'returned'].includes(l.status)) {
      h = l.createdBy === me
        ? `<div class="row"><a class="btn primary" href="#/corr/edit/${l.id}">${A.icon('edit')}${l.status === 'returned' ? 'تعديل وإعادة الإرسال' : 'تعديل'}</a><button class="btn" data-act="submit">${A.icon('send')}إرسال للاعتماد</button></div>`
        : `<div class="note">${A.icon('edit')}<div>${l.status === 'returned' ? 'أُعيدت إلى المُعِد للتعديل' : 'مسودة لدى المُعِد'}: <b>${esc(A.empName(l.createdBy))}</b></div></div>`;
    } else if (l.status === 'issued') {
      h = `<div class="note good mb">${A.icon('check')}<div>اكتمل الاعتماد وصدرت برقم <b class="ltr">${esc(l.number)}</b>. المعاملة جاهزة للإرسال.</div></div>
        <div class="row"><button class="btn primary" data-act="send">${A.icon('send')}${l.recipientKind === 'external' ? 'إرسال بالبريد الإلكتروني' : 'إرسال للإدارات'}</button><button class="btn" data-act="print">${A.icon('print')}طباعة</button></div>`;
    } else if (l.status === 'sent') {
      h = `<div class="row"><button class="btn" data-act="send">${A.icon('send')}إعادة الإرسال</button><button class="btn" data-act="print">${A.icon('print')}طباعة</button>${l.recipientKind === 'internal' && (l.toDepts || []).includes(A.me().dept) && l.fromDept !== A.me().dept ? `<button class="btn" data-act="reply">${A.icon('reply')}رد</button>` : ''}</div>`;
    } else if (l.status === 'incoming') {
      h = `<div class="row"><button class="btn primary" data-act="reply">${A.icon('reply')}إنشاء رد</button><button class="btn" data-act="forward">${A.icon('send')}إحالة</button><button class="btn" data-act="archive">${A.icon('archive')}حفظ في الأرشيف</button><button class="btn" data-act="print">${A.icon('print')}طباعة</button></div>`;
    } else if (l.status === 'rejected') {
      h = `<div class="note warn">${A.icon('x')}<div>رُفضت هذه المعاملة وأُغلقت.</div></div>`;
    } else if (l.status === 'archived') {
      h = `<div class="row"><button class="btn" data-act="print">${A.icon('print')}طباعة</button></div>`;
    }
    return h;
  }

  function sendDialog(l) {
    if (l.recipientKind === 'external') {
      const s = A.state.settings;
      A.modal({
        title: 'إرسال بالبريد الإلكتروني', wide: true,
        body: `<div class="form-grid">
          <div class="field"><label>إلى</label><input class="input ltr" name="to" value="${esc(l.toEmail)}" style="text-align:left"></div>
          <div class="field"><label>نسخة (CC)</label><input class="input ltr" name="cc" style="text-align:left" placeholder="اختياري"></div>
          <div class="field full"><label>عنوان الرسالة</label><input class="input" name="subj" value="${esc('خطاب رقم ' + l.number + ' — ' + l.subject)}"></div>
          <div class="field full"><label>نص الرسالة</label><textarea class="input" name="msg" style="min-height:120px">السادة / ${esc(l.toEntity)} المحترمين،\n\nالسلام عليكم ورحمة الله وبركاته،\n\nتجدون مرفقاً خطابنا رقم ${esc(l.number)} بشأن: ${esc(l.subject)}.\n\nمع خالص التحية،\n${esc(s.companyAr)}</textarea></div>
          <div class="field full"><span class="lbl">المرفقات</span><div class="chips"><span class="chip on">${A.icon('file')} ${esc(l.number.replace(/\//g, '-'))}.pdf</span>${(l.attachments || []).map((a) => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>
        </div>
        <div class="note mt">${A.icon('info')}<div>في النموذج الأولي يُسجَّل الإرسال فقط. في النسخة النهائية يُرسل عبر خادم بريد الشركة مع نسخة PDF موقّعة ورمز تحقق.</div></div>`,
        actions: [{
          label: 'إرسال', kind: 'primary', icon: 'send', onClick: (b) => {
            const to = b.querySelector('[name=to]').value.trim();
            if (!/^\S+@\S+\.\S+$/.test(to)) { A.toast('أدخل بريداً إلكترونياً صحيحاً', 'alert'); return false; }
            const cc = b.querySelector('[name=cc]').value.trim();
            l.toEmail = to;
            l.sentLog.push({ at: new Date().toISOString(), by: A.state.currentUserId, channel: 'email', to: to + (cc ? ', ' + cc : '') });
            l.status = 'sent';
            log(l, 'أرسلها بالبريد الإلكتروني إلى ' + to);
            A.save(); A.toast('أُرسل الخطاب إلى ' + to, 'send'); A.render();
          },
        }, { label: 'إلغاء' }],
      });
    } else {
      const sel = new Set([...(l.toDepts || []), ...(l.ccDepts || [])]);
      A.modal({
        title: 'إرسال داخلي',
        body: `<p class="muted mb">ستظهر المعاملة في صندوق الوارد لدى الإدارات المحددة داخل التطبيق.</p>
          <div class="chips" id="sd">${A.state.departments.filter((d) => d.id !== l.fromDept).map((d) => `<button type="button" class="chip ${sel.has(d.id) ? 'on' : ''}" data-v="${d.id}">${esc(d.name)}</button>`).join('')}</div>`,
        onMount: (b) => b.querySelector('#sd').addEventListener('click', (e) => {
          const c = e.target.closest('.chip'); if (!c) return;
          if (sel.has(c.dataset.v)) sel.delete(c.dataset.v); else sel.add(c.dataset.v);
          c.classList.toggle('on');
        }),
        actions: [{
          label: 'إرسال', kind: 'primary', icon: 'send', onClick: () => {
            if (!sel.size) { A.toast('اختر إدارة واحدة على الأقل', 'alert'); return false; }
            l.toDepts = [...new Set([...(l.toDepts || []), ...sel])];
            l.readBy = [];
            l.sentLog.push({ at: new Date().toISOString(), by: A.state.currentUserId, channel: 'internal', to: [...sel].map(A.deptName).join('، ') });
            l.status = 'sent';
            log(l, 'أرسلها داخلياً إلى ' + [...sel].map(A.deptName).join('، '));
            A.save(); A.toast('أُرسلت إلى ' + sel.size + ' إدارة', 'send'); A.render();
          },
        }, { label: 'إلغاء' }],
      });
    }
  }

  A.route('/corr/view/:id', (p) => {
    const l = A.letter(p.id);
    if (!l) return notFound();
    if (A.myInbox().includes(l) && A.unread(l)) { (l.readBy = l.readBy || []).push(A.state.currentUserId); A.save(); }
    return {
      title: l.subject, crumbs: [['المراسلات', '#/corr/archive'], A.LT[l.type].label],
      html: `
        <div class="page-head no-print">
          <div><div class="row">${A.statusBadge(l.status)}${l.number ? `<span class="badge gray ltr">${esc(l.number)}</span>` : ''}${l.classification !== 'عادي' ? A.badge(l.classification, 'red') : ''}${l.priority !== 'عادي' ? A.badge(l.priority, 'amber') : ''}</div>
          <h1 class="mt-s">${esc(l.subject)}</h1><p>${esc(A.LT[l.type].label)} — ${esc(recipientText(l))}</p></div>
        </div>
        <div class="split">
          <div class="paper-wrap">${A.paper(l)}</div>
          <div class="grid no-print">
            <div class="card"><div class="card-head"><h2>الإجراء</h2></div><div class="card-body" id="actions">${actionsCard(l)}</div></div>
            ${l.type !== 'incoming' ? `<div class="card"><div class="card-head"><h2>رحلة الاعتماد</h2></div><div class="card-body">${timeline(l)}</div></div>` : ''}
            <div class="card"><div class="card-head"><h2>بيانات المعاملة</h2></div><div class="card-body"><dl class="dl">
              <dt>النوع</dt><dd>${esc(A.LT[l.type].label)}</dd>
              <dt>الرقم</dt><dd class="ltr" style="text-align:right">${esc(l.number || '—')}</dd>
              ${l.type === 'incoming' ? `<dt>الجهة المرسلة</dt><dd>${esc(l.fromEntity)}</dd><dt>رقم الجهة</dt><dd>${esc(l.externalRef || '—')}</dd><dt>محالة إلى</dt><dd>${esc(A.deptName(l.assignedDept))}</dd>`
                : `<dt>الإدارة المُصدِرة</dt><dd>${esc(A.deptName(l.fromDept))}</dd><dt>المُعِد</dt><dd>${esc(A.empName(l.createdBy))}</dd>`}
              ${l.recipientKind === 'external' && l.type !== 'incoming' ? `<dt>البريد</dt><dd class="ltr" style="text-align:right">${esc(l.toEmail || '—')}</dd>` : ''}
              <dt>المرفقات</dt><dd>${(l.attachments || []).length ? l.attachments.map((a) => `<div class="row" style="gap:4px">${A.icon('clip')}${esc(a)}</div>`).join('') : 'لا يوجد'}</dd>
              <dt>تاريخ الإنشاء</dt><dd>${A.dt(l.createdAt)}</dd>
            </dl></div></div>
            <div class="card"><div class="card-head"><h2>سجل الإجراءات</h2></div><div class="card-body flush"><ul class="list">
              ${l.history.slice().reverse().map((h) => `<li>${A.avatar(A.empName(h.by))}<div><div class="small"><b>${esc(A.empName(h.by))}</b> ${esc(h.text)}</div><div class="meta">${A.dt(h.at)}</div></div></li>`).join('')}
            </ul></div></div>
          </div>
        </div>`,
      mount(root) {
        root.querySelector('#actions').addEventListener('click', (e) => {
          const b = e.target.closest('[data-act]'); if (!b) return;
          const act = b.dataset.act;
          const note = (root.querySelector('#a-note') || {}).value?.trim() || '';
          if (act === 'approve') {
            A.approveLetter(l, note); A.save();
            A.toast(l.number ? 'اعتُمدت نهائياً وصدرت برقم ' + l.number : 'اعتُمدت ومُرّرت إلى ' + A.empName(A.currentStep(l).userId));
            A.render();
          } else if (act === 'return' || act === 'reject') {
            if (!note) return A.toast('اكتب سبب ' + (act === 'return' ? 'الإعادة' : 'الرفض') + ' في خانة الملاحظة', 'alert');
            if (act === 'return') A.returnLetter(l, note); else A.rejectLetter(l, note);
            A.save(); A.toast(act === 'return' ? 'أُعيدت إلى المُعِد للتعديل' : 'رُفضت المعاملة'); A.render();
          } else if (act === 'submit') {
            A.submitLetter(l); A.save(); A.toast('أُرسلت للاعتماد', 'send'); A.render();
          } else if (act === 'send') sendDialog(l);
          else if (act === 'print') window.print();
          else if (act === 'archive') { l.status = 'archived'; log(l, 'حفظها في الأرشيف'); A.save(); A.toast('حُفظت في الأرشيف'); A.render(); }
          else if (act === 'forward') {
            A.modal({
              title: 'إحالة المعاملة',
              body: `<div class="field"><label>إحالة إلى</label><select class="input" name="d">${A.options(A.state.departments.map((d) => [d.id, d.name]), l.assignedDept)}</select></div><div class="field mt"><label>توجيه</label><textarea class="input" name="n" style="min-height:80px" placeholder="مثال: للاطلاع والإفادة"></textarea></div>`,
              actions: [{ label: 'إحالة', kind: 'primary', onClick: (bd) => {
                l.assignedDept = bd.querySelector('[name=d]').value; l.readBy = [];
                const n = bd.querySelector('[name=n]').value.trim();
                log(l, 'أحالها إلى ' + A.deptName(l.assignedDept) + (n ? ' — ' + n : ''));
                A.save(); A.toast('أُحيلت إلى ' + A.deptName(l.assignedDept)); A.render();
              } }, { label: 'إلغاء' }],
            });
          } else if (act === 'reply') {
            const ext = l.type === 'incoming';
            const draft = A.newDraft(ext
              ? { type: 'external', subject: 'رد على: ' + l.subject, toEntity: l.fromEntity, body: `إشارة إلى خطابكم رقم (${l.externalRef || '...'}) بشأن ${l.subject}، نفيدكم بأن ...` }
              : { type: 'internal', subject: 'رد على: ' + l.subject, toDepts: [l.fromDept], body: `إشارة إلى مذكرتكم رقم (${l.number}) بشأن ${l.subject}، نفيدكم بأن ...` });
            log(l, 'أنشأ مسودة رد');
            A.save(); A.go('#/corr/edit/' + draft.id);
          }
        });
      },
    };
  });
})(window.APP);
