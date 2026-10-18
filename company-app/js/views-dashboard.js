// الرئيسية: ملخص المراسلات وشؤون الموظفين لما يخص المستخدم الحالي.
(function (A) {
  const esc = (s) => A.esc(s);

  A.route('/dashboard', () => {
    const me = A.me();
    const S = A.state;
    const pending = A.myPending();
    const inbox = A.myInbox();
    const drafts = S.letters.filter((l) => l.createdBy === me.id && ['draft', 'returned'].includes(l.status));
    const month = A.todayISO().slice(0, 7);
    const issuedMonth = S.letters.filter((l) => l.type !== 'incoming' && l.issuedAt && A.iso(new Date(l.issuedAt)).slice(0, 7) === month);
    const toSend = S.letters.filter((l) => l.status === 'issued');
    const inReview = S.letters.filter((l) => l.status === 'review');
    const leavesPending = S.leaves.filter((x) => x.status === 'pending');
    const onLeave = S.employees.filter((e) => A.leaveOn(e.id));
    const expiring = S.employees.filter((e) => (e.iqamaExpiry && A.daysLeft(e.iqamaExpiry) <= 30) || (e.contractEnd && A.daysLeft(e.contractEnd) <= 30));
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'صباح الخير' : 'مساء الخير';
    const li = (l) => `<li><span class="ico-box ${l.priority !== 'عادي' ? 'amber' : ''}">${A.icon(A.LT[l.type].icon)}</span>
      <a class="fill" href="#/corr/view/${l.id}"><div class="ttl">${esc(l.subject)}</div><div class="meta">${esc(A.LT[l.type].label)} — من ${esc(A.empName(l.createdBy))} — ${A.gdate(l.createdAt)}</div></a>${A.priorityBadge(l.priority)}</li>`;

    return {
      title: 'الرئيسية',
      html: `
        <div class="page-head"><div><h1>${greet}، ${esc(me.name.split(' ')[0])}</h1><p>${A.hdate(new Date())} — ${A.gdate(new Date())}م</p></div>
          <div class="row"><a class="btn" href="#/hr/leaves?new=1">${A.icon('calendar')}طلب إجازة</a><a class="btn primary" href="#/corr/new">${A.icon('plus')}معاملة جديدة</a></div></div>

        <div class="grid g4">
          ${A.kpi({ label: 'بانتظار اعتمادي', value: pending.length, href: '#/corr/pending', icon: 'clock', tone: pending.length ? 'warn' : '' })}
          ${A.kpi({ label: 'وارد غير مقروء', value: inbox.filter(A.unread).length, sub: inbox.length + ' في صندوق إدارتك', href: '#/corr/inbox', icon: 'inbox' })}
          ${A.kpi({ label: 'مسوداتي والمعادة لي', value: drafts.length, href: '#/corr/drafts', icon: 'edit', tone: drafts.some((d) => d.status === 'returned') ? 'bad' : '' })}
          ${A.kpi({ label: 'صادر هذا الشهر', value: issuedMonth.length, sub: toSend.length + ' صادرة لم تُرسل بعد', href: '#/corr/outgoing', icon: 'send' })}
        </div>

        <div class="split mt">
          <div class="grid">
            <div class="card"><div class="card-head"><h2>بانتظار اعتمادك</h2><span class="spacer"></span><a class="more" href="#/corr/pending">عرض الكل</a></div>
              <div class="card-body flush">${pending.length ? `<ul class="list">${pending.slice(0, 5).map(li).join('')}</ul>` : A.empty('لا شيء بانتظارك. أحسنت!')}</div></div>
            <div class="card"><div class="card-head"><h2>معاملات في رحلة الاعتماد</h2><span class="spacer"></span><a class="more" href="#/corr/tracking">متابعة</a></div>
              <div class="card-body flush">${inReview.length ? `<div class="table-wrap"><table class="t"><tbody>${inReview.slice(0, 6).map((l) => {
                const done = l.steps.filter((s) => s.status === 'approved').length;
                return `<tr class="click" data-href="#/corr/view/${l.id}"><td><div class="cell-main">${esc(l.subject)}</div><div class="cell-sub">لدى: ${esc(A.empName(A.currentStep(l).userId))}</div></td>
                  <td style="width:160px"><div class="bar"><i style="width:${(done / l.steps.length) * 100}%"></i></div><div class="cell-sub mt-s">${done} من ${l.steps.length} اعتمادات</div></td></tr>`;
              }).join('')}</tbody></table></div>` : A.empty('لا توجد معاملات قيد الاعتماد')}</div></div>
          </div>
          <div class="grid">
            <div class="card"><div class="card-head"><h2>شؤون الموظفين اليوم</h2><span class="spacer"></span><a class="more" href="#/hr">اللوحة</a></div>
              <div class="card-body flush"><ul class="list">
                <li><span class="ico-box blue">${A.icon('users')}</span><a class="fill" href="#/hr/employees"><div class="ttl">${S.employees.length} موظفاً</div><div class="meta">${onLeave.length} في إجازة اليوم</div></a></li>
                <li><span class="ico-box ${leavesPending.length ? 'amber' : ''}">${A.icon('calendar')}</span><a class="fill" href="#/hr/leaves"><div class="ttl">${leavesPending.length} طلبات إجازة</div><div class="meta">بانتظار الاعتماد</div></a></li>
                <li><span class="ico-box">${A.icon('inbox')}</span><a class="fill" href="#/hr/requests"><div class="ttl">${S.requests.filter((r) => r.status === 'pending').length} طلبات موظفين</div><div class="meta">خطابات تعريف، سلف، تأشيرات</div></a></li>
                ${expiring.map((e) => `<li><span class="ico-box red">${A.icon('alert')}</span><a class="fill" href="#/hr/employee/${e.id}"><div class="ttl">${esc(e.name)}</div><div class="meta">${e.iqamaExpiry && A.daysLeft(e.iqamaExpiry) <= 30 ? 'تنتهي الإقامة خلال ' + A.daysLeft(e.iqamaExpiry) + ' يوماً' : 'ينتهي العقد خلال ' + A.daysLeft(e.contractEnd) + ' يوماً'}</div></a></li>`).join('')}
              </ul></div></div>
            <div class="card"><div class="card-head"><h2>آخر الوارد</h2><span class="spacer"></span><a class="more" href="#/corr/inbox">الوارد</a></div>
              <div class="card-body flush">${inbox.length ? `<ul class="list">${inbox.slice(0, 4).map((l) => `<li><span class="ico-box">${A.icon(A.LT[l.type].icon)}</span><a class="fill" href="#/corr/view/${l.id}"><div class="ttl">${A.unread(l) ? '● ' : ''}${esc(l.subject)}</div><div class="meta">${esc(l.type === 'incoming' ? l.fromEntity : A.deptName(l.fromDept))} — <span class="ltr">${esc(l.number)}</span></div></a></li>`).join('')}</ul>` : A.empty('لا يوجد وارد')}</div></div>
          </div>
        </div>`,
      mount(root) { A.bindRows(root); },
    };
  });
})(window.APP);
