// بيانات تجريبية للنموذج الأولي — كل الأسماء والجهات وهمية.
// التواريخ تُحسب نسبةً إلى اليوم حتى تبقى التنبيهات (انتهاء العقود والإقامات) حيّة.
window.APP = window.APP || {};

(function (A) {
  const iso = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const addDays = (n, from) => {
    const d = from ? new Date(from + 'T12:00:00') : new Date();
    d.setDate(d.getDate() + n);
    return iso(d);
  };
  const stamp = (daysAgo, hh = 10, mm = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };
  A.iso = iso;
  A.addDays = addDays;
  A.todayISO = () => iso(new Date());

  // أنواع المعاملات وبادئة الترقيم
  A.LT = {
    external: { label: 'خطاب خارجي', prefix: 'ص', icon: 'send' },
    internal: { label: 'مذكرة داخلية', prefix: 'م', icon: 'mail' },
    decision: { label: 'قرار إداري', prefix: 'ق', icon: 'award' },
    circular: { label: 'تعميم', prefix: 'ت', icon: 'flag' },
    report:   { label: 'تقرير', prefix: 'ر', icon: 'chart' },
    incoming: { label: 'وارد خارجي', prefix: 'و', icon: 'inbox' },
  };

  A.STATUS = {
    draft:    ['مسودة', 'gray'],
    review:   ['قيد الاعتماد', 'amber'],
    returned: ['معادة للتعديل', 'red'],
    rejected: ['مرفوضة', 'red'],
    issued:   ['صادرة — لم تُرسل', 'blue'],
    sent:     ['مُرسلة', 'green'],
    incoming: ['واردة', 'blue'],
    archived: ['مؤرشفة', 'gray'],
  };

  A.CLASSIFICATION = ['عادي', 'سري', 'سري للغاية'];
  A.PRIORITY = ['عادي', 'عاجل', 'عاجل جداً'];

  // أنواع الإجازات وفق نظام العمل السعودي (بتعديلاته النافذة من فبراير 2025)
  A.LEAVE_TYPES = [
    { key: 'annual', label: 'إجازة سنوية', art: 'المادة 109', paid: 'بأجر كامل', note: '21 يوماً في السنة، وتصبح 30 يوماً متى أمضى العامل 5 سنوات متصلة. يُصرف أجرها مقدماً.' },
    { key: 'sick', label: 'إجازة مرضية', art: 'المادة 117', paid: 'متدرّج', note: 'خلال السنة الواحدة: 30 يوماً بأجر كامل، ثم 60 يوماً بثلاثة أرباع الأجر، ثم 30 يوماً بدون أجر. تُثبت بتقرير طبي معتمد (منصة صحتي).' },
    { key: 'maternity', label: 'إجازة وضع', art: 'المادة 151', days: 84, female: true, paid: 'بأجر كامل', note: '12 أسبوعاً بأجر كامل، توزّعها العاملة كيف تشاء بحد أقصى 4 أسابيع قبل التاريخ المرجّح للوضع، والـ 6 أسابيع التالية للوضع إلزامية.' },
    { key: 'paternity', label: 'إجازة مولود', art: 'المادة 113', days: 3, paid: 'بأجر كامل', note: '3 أيام بأجر كامل عند ولادة مولود للعامل.' },
    { key: 'marriage', label: 'إجازة زواج', art: 'المادة 113', days: 5, paid: 'بأجر كامل', note: '5 أيام بأجر كامل.' },
    { key: 'death1', label: 'إجازة وفاة (زوج / أصول / فروع)', art: 'المادة 113', days: 5, paid: 'بأجر كامل', note: '5 أيام بأجر كامل عند وفاة زوج العامل أو أحد أصوله أو فروعه.' },
    { key: 'death2', label: 'إجازة وفاة (أخ / أخت)', art: 'المادة 113', days: 3, paid: 'بأجر كامل', note: '3 أيام بأجر كامل عند وفاة أخ أو أخت العامل.' },
    { key: 'hajj', label: 'إجازة حج', art: 'المادة 114', min: 10, max: 15, minYears: 2, paid: 'بأجر كامل', note: 'مرة واحدة طوال الخدمة، لا تقل عن 10 أيام ولا تزيد على 15 يوماً شاملة إجازة عيد الأضحى، بشرط إمضاء سنتين متصلتين على الأقل.' },
    { key: 'exam', label: 'إجازة امتحان', art: 'المادة 115', paid: 'بأجر كامل', note: 'بأجر كامل لأيام الامتحان الفعلية للعامل المنتسب لمؤسسة تعليمية، بشرط ألا يكون الامتحان معاداً.' },
    { key: 'iddah', label: 'إجازة عِدّة', art: 'المادة 160', days: 130, female: true, paid: 'بأجر كامل', note: 'للعاملة المسلمة المتوفى زوجها 4 أشهر و10 أيام بأجر كامل، ولغير المسلمة 15 يوماً.' },
    { key: 'unpaid', label: 'إجازة بدون أجر', art: 'المادة 116', paid: 'بدون أجر', note: 'باتفاق الطرفين، ويُعد العقد موقوفاً فيما زاد على 20 يوماً ما لم يُتفق على خلاف ذلك.' },
  ];

  A.REQUEST_TYPES = ['خطاب تعريف بالراتب', 'شهادة خبرة', 'سلفة على الراتب', 'تحديث بيانات', 'بدل سكن مقدّم', 'استقالة', 'تأشيرة خروج وعودة'];

  // مصفوفة جزاءات مثال من لائحة تنظيم العمل الداخلية (قابلة للتعديل)
  A.VIOLATIONS = [
    { key: 'late15', label: 'التأخر عن موعد بدء العمل حتى 15 دقيقة دون إذن أو عذر مقبول', p: ['إنذار كتابي', 'حسم 5% من الأجر اليومي', 'حسم 10% من الأجر اليومي', 'حسم 20% من الأجر اليومي'] },
    { key: 'late30', label: 'التأخر عن موعد بدء العمل أكثر من 15 دقيقة وحتى 30 دقيقة', p: ['حسم 10% من الأجر اليومي', 'حسم 15% من الأجر اليومي', 'حسم 25% من الأجر اليومي', 'حسم 50% من الأجر اليومي'] },
    { key: 'early', label: 'ترك العمل أو الانصراف قبل الموعد دون إذن', p: ['إنذار كتابي', 'حسم 10% من الأجر اليومي', 'حسم 25% من الأجر اليومي', 'حسم أجر يوم'] },
    { key: 'absent1', label: 'الغياب دون إذن كتابي أو عذر مقبول (يوم واحد)', p: ['حسم أجر يومين', 'حسم أجر 3 أيام', 'حسم أجر 4 أيام', 'الإيقاف عن العمل مع الحرمان من الأجر 5 أيام'] },
    { key: 'conduct', label: 'عدم اتباع التعليمات أو الإخلال بآداب السلوك في مكان العمل', p: ['إنذار كتابي', 'حسم أجر يوم', 'حسم أجر يومين', 'حسم أجر 3 أيام'] },
    { key: 'safety', label: 'مخالفة تعليمات السلامة والصحة المهنية', p: ['إنذار كتابي', 'حسم أجر يوم', 'حسم أجر 3 أيام', 'حسم أجر 5 أيام'] },
  ];

  A.EOS_REASONS = [
    { key: 'end', label: 'انتهاء مدة العقد المحدد', art: 'المادة 84' },
    { key: 'employer', label: 'إنهاء العقد من صاحب العمل (لغير الحالات الواردة في المادة 80)', art: 'المادة 84' },
    { key: 'resign', label: 'استقالة العامل (عقد غير محدد المدة)', art: 'المادة 85' },
    { key: 'art81', label: 'ترك العامل العمل لأحد الأسباب الواردة في المادة 81', art: 'المادة 81' },
    { key: 'force', label: 'ترك العمل لقوة قاهرة خارجة عن إرادة العامل', art: 'المادة 87' },
    { key: 'female', label: 'إنهاء العاملة العقد خلال 6 أشهر من الزواج أو 3 أشهر من الوضع', art: 'المادة 87' },
    { key: 'retire', label: 'بلوغ سن التقاعد النظامية', art: 'المادة 84' },
    { key: 'art80', label: 'فسخ العقد وفق المادة 80 (بدون مكافأة)', art: 'المادة 80' },
  ];

  A.seed = function () {
    const D = (id, name, manager) => ({ id, name, manager });
    const departments = [
      D('GM', 'الإدارة العامة', 'E1001'),
      D('ADM', 'الشؤون الإدارية', 'E1002'),
      D('HR', 'الموارد البشرية', 'E1003'),
      D('LEG', 'الشؤون القانونية', 'E1004'),
      D('FIN', 'الإدارة المالية', 'E1005'),
      D('IT', 'تقنية المعلومات', 'E1008'),
      D('PRJ', 'إدارة المشاريع', 'E1010'),
      D('SAL', 'المبيعات', 'E1015'),
    ];

    const E = (id, name, gender, nationality, job, dept, hireDate, basic, housing, transport, other = 0, extra = {}) => ({
      id, name, gender, nationality, saudi: nationality === 'سعودي', job, dept, hireDate,
      basic, housing, transport, other,
      contractType: 'غير محدد المدة', contractEnd: null, probationEnd: addDays(180, hireDate), iqamaExpiry: null,
      annualTaken: 0, sickTaken: 0, hajjTaken: false,
      phone: '05' + id.slice(1) + '4321',
      email: id.toLowerCase() + '@company.example',
      idNo: (nationality === 'سعودي' ? '1' : '2') + '•••••••' + id.slice(-2),
      iban: 'SA•• •••• •••• •••• ' + id.slice(1),
      ...extra,
    });

    const employees = [
      E('E1001', 'فهد عبدالرحمن الشمري', 'ذكر', 'سعودي', 'المدير العام', 'GM', '2014-03-01', 30000, 7500, 1500, 3000, { annualTaken: 12 }),
      E('E1002', 'أحمد محمد العتيبي', 'ذكر', 'سعودي', 'مدير الشؤون الإدارية', 'ADM', '2017-06-11', 18000, 4500, 1000, 1000, { annualTaken: 18 }),
      E('E1003', 'سارة خالد القحطاني', 'أنثى', 'سعودي', 'مديرة الموارد البشرية', 'HR', '2019-01-20', 17000, 4250, 1000, 0, { annualTaken: 9 }),
      E('E1004', 'خالد سعد الدوسري', 'ذكر', 'سعودي', 'المستشار القانوني', 'LEG', '2020-09-01', 20000, 5000, 1000, 0, { annualTaken: 5 }),
      E('E1005', 'عبدالله علي الزهراني', 'ذكر', 'سعودي', 'المدير المالي', 'FIN', '2016-02-14', 19000, 4750, 1000, 0, { annualTaken: 22 }),
      E('E1006', 'نورة فيصل الحربي', 'أنثى', 'سعودي', 'أخصائية اتصالات إدارية', 'ADM', '2022-04-03', 9000, 2250, 800, 0, { annualTaken: 6 }),
      E('E1007', 'محمد إبراهيم عبدالفتاح', 'ذكر', 'مصري', 'محاسب أول', 'FIN', '2018-08-19', 8500, 2125, 700, 0, { contractType: 'محدد المدة', contractEnd: addDays(45), iqamaExpiry: addDays(70), annualTaken: 15 }),
      E('E1008', 'راجيش كومار', 'ذكر', 'هندي', 'مهندس شبكات', 'IT', '2021-11-07', 9500, 2375, 800, 0, { contractType: 'محدد المدة', contractEnd: addDays(210), iqamaExpiry: addDays(25), annualTaken: 10 }),
      E('E1009', 'ريم عبدالله السبيعي', 'أنثى', 'سعودي', 'أخصائية موارد بشرية', 'HR', '2023-02-12', 8000, 2000, 800, 0, { annualTaken: 4, sickTaken: 2 }),
      E('E1010', 'تركي ناصر المطيري', 'ذكر', 'سعودي', 'مدير المشاريع', 'PRJ', '2015-05-24', 21000, 5250, 1200, 1500, { annualTaken: 20 }),
      E('E1011', 'عمر يوسف الخطيب', 'ذكر', 'أردني', 'مهندس مدني', 'PRJ', '2020-01-05', 11000, 2750, 900, 0, { contractType: 'محدد المدة', contractEnd: addDays(300), iqamaExpiry: addDays(160), annualTaken: 7 }),
      E('E1012', 'لينا حسن الغامدي', 'أنثى', 'سعودي', 'مطوّرة برمجيات', 'IT', addDays(-70), 10000, 2500, 800, 0),
      E('E1013', 'جوزيف سانتوس', 'ذكر', 'فلبيني', 'فني صيانة', 'PRJ', '2019-07-14', 4500, 1125, 500, 0, { contractType: 'محدد المدة', contractEnd: addDays(20), iqamaExpiry: addDays(80), annualTaken: 21 }),
      E('E1014', 'بندر سلطان العنزي', 'ذكر', 'سعودي', 'مسؤول مبيعات', 'SAL', '2021-03-28', 7500, 1875, 700, 0, { annualTaken: 3 }),
      E('E1015', 'هيفاء مساعد الشهري', 'أنثى', 'سعودي', 'مديرة المبيعات', 'SAL', '2018-10-01', 16000, 4000, 1000, 0, { annualTaken: 11 }),
    ];

    // أصحاب الصلاحية في التطبيق (مرتبطون بسجل الموظف)
    const P_ALL = ['create', 'approve', 'send', 'hr', 'payroll', 'settings'];
    const users = [
      { empId: 'E1001', perms: P_ALL },
      { empId: 'E1002', perms: ['create', 'approve', 'send', 'settings'] },
      { empId: 'E1003', perms: ['create', 'approve', 'hr', 'payroll'] },
      { empId: 'E1004', perms: ['create', 'approve'] },
      { empId: 'E1005', perms: ['create', 'approve', 'payroll'] },
      { empId: 'E1006', perms: ['create', 'send'] },
      { empId: 'E1009', perms: ['create', 'hr'] },
      { empId: 'E1010', perms: ['create', 'approve'] },
    ];

    const workflows = {
      external: ['E1002', 'E1004', 'E1001'],
      internal: ['E1002'],
      decision: ['E1003', 'E1004', 'E1001'],
      circular: ['E1002', 'E1001'],
      report: ['E1002', 'E1001'],
    };

    const steps = (type, done = 0, extra = {}) =>
      workflows[type].map((userId, i) => ({
        userId,
        status: i < done ? 'approved' : 'pending',
        at: i < done ? stamp(3 - i, 9 + i, 15) : null,
        note: '',
        ...(extra[i] || {}),
      }));

    const letters = [
      {
        id: 'L1001', type: 'external', status: 'review',
        subject: 'طلب تزويدنا بعروض أسعار لتوريد أجهزة حاسب آلي',
        recipientKind: 'external', toEntity: 'شركة التقنية المتقدمة', toEmail: 'sales@advtech.example', toDepts: [],
        fromDept: 'ADM', classification: 'عادي', priority: 'عاجل', attachments: ['المواصفات الفنية.pdf'],
        body: 'نفيدكم برغبة الشركة في توريد عدد (40) جهاز حاسب آلي محمول وفق المواصفات الفنية المرفقة، وعليه نأمل منكم التكرم بتزويدنا بعرض سعر شامل للتوريد والتركيب والضمان لمدة لا تقل عن ثلاث سنوات، على أن يصلنا العرض في موعد أقصاه عشرة أيام عمل من تاريخه.\n\nشاكرين لكم حسن تعاونكم.',
        createdBy: 'E1006', createdAt: stamp(1, 11, 20), steps: steps('external', 0), number: null, issuedAt: null, sentLog: [],
        history: [{ at: stamp(1, 11, 20), by: 'E1006', text: 'أنشأت المسودة' }, { at: stamp(1, 11, 45), by: 'E1006', text: 'أرسلت المسودة للاعتماد' }],
      },
      {
        id: 'L1002', type: 'decision', status: 'review',
        subject: 'قرار تكليف بمهام مدير إدارة المشاريع بالإنابة',
        recipientKind: 'internal', toDepts: ['PRJ', 'HR'], toEntity: '', toEmail: '',
        fromDept: 'HR', classification: 'عادي', priority: 'عادي', attachments: [],
        body: 'أولاً: يُكلّف المهندس/ عمر يوسف الخطيب بمهام مدير إدارة المشاريع بالإنابة، اعتباراً من تاريخه ولمدة شهر، وذلك خلال فترة إجازة مدير الإدارة.\n\nثانياً: يُمنح المكلّف كامل الصلاحيات الإدارية والمالية المخولة لمدير الإدارة خلال فترة التكليف.\n\nثالثاً: يُبلّغ هذا القرار لمن يلزم لاعتماده والعمل بموجبه.',
        createdBy: 'E1009', createdAt: stamp(3, 9, 0), steps: steps('decision', 2), number: null, issuedAt: null, sentLog: [],
        history: [{ at: stamp(3, 9, 0), by: 'E1009', text: 'أنشأت المسودة' }],
      },
      {
        id: 'L1003', type: 'circular', status: 'issued',
        subject: 'تعميم بشأن مواعيد الدوام الرسمي',
        recipientKind: 'internal', toDepts: departments.map((d) => d.id), toEntity: '', toEmail: '',
        fromDept: 'ADM', classification: 'عادي', priority: 'عادي', attachments: [],
        body: 'نود إحاطة جميع منسوبي الشركة بأن مواعيد الدوام الرسمي اعتباراً من يوم الأحد القادم ستكون من الساعة 8:00 صباحاً وحتى الساعة 4:00 مساءً، من الأحد إلى الخميس، مع ساعة استراحة للصلاة والطعام لا تدخل ضمن ساعات العمل.\n\nونأمل من الجميع الالتزام بإثبات الحضور والانصراف عبر نظام البصمة.',
        createdBy: 'E1006', createdAt: stamp(6, 10, 0), steps: steps('circular', 2), number: 'ت/1448/00012', issuedAt: stamp(1, 14, 10), sentLog: [],
        history: [{ at: stamp(6, 10, 0), by: 'E1006', text: 'أنشأت المسودة' }, { at: stamp(1, 14, 10), by: 'E1001', text: 'صدرت المعاملة برقم ت/1448/00012' }],
      },
      {
        id: 'L1004', type: 'external', status: 'sent',
        subject: 'طلب تصديق شهادة عضوية',
        recipientKind: 'external', toEntity: 'الغرفة التجارية الصناعية', toEmail: 'services@chamber.example', toDepts: [],
        fromDept: 'ADM', classification: 'عادي', priority: 'عادي', attachments: ['السجل التجاري.pdf'],
        body: 'نرفق لكم طيّه صورة السجل التجاري للشركة، ونأمل التكرم بتصديق شهادة العضوية لعام 2026م، وذلك لاستكمال متطلبات التسجيل في المنافسات الحكومية.',
        createdBy: 'E1006', createdAt: stamp(9, 10, 0), steps: steps('external', 3), number: 'ص/1448/00151', issuedAt: stamp(5, 13, 0),
        sentLog: [{ at: stamp(5, 13, 20), by: 'E1006', channel: 'email', to: 'services@chamber.example' }],
        history: [{ at: stamp(9, 10, 0), by: 'E1006', text: 'أنشأت المسودة' }, { at: stamp(5, 13, 0), by: 'E1001', text: 'صدرت المعاملة برقم ص/1448/00151' }, { at: stamp(5, 13, 20), by: 'E1006', text: 'أُرسلت بالبريد الإلكتروني إلى services@chamber.example' }],
      },
      {
        id: 'L1005', type: 'internal', status: 'draft',
        subject: 'طلب صرف مستحقات مورد الأثاث المكتبي',
        recipientKind: 'internal', toDepts: ['FIN'], toEntity: '', toEmail: '',
        fromDept: 'ADM', classification: 'عادي', priority: 'عادي', attachments: ['فاتورة رقم 2219.pdf'],
        body: 'نأمل التكرم بصرف مستحقات مؤسسة الأثاث الحديث بمبلغ (48,300) ريال شاملة ضريبة القيمة المضافة، مقابل توريد الأثاث المكتبي للدور الثالث، علماً بأنه تم الاستلام وفق محضر الاستلام المرفق.',
        createdBy: 'E1002', createdAt: stamp(0, 9, 30), steps: [], number: null, issuedAt: null, sentLog: [],
        history: [{ at: stamp(0, 9, 30), by: 'E1002', text: 'أنشأت المسودة' }],
      },
      {
        id: 'L1006', type: 'report', status: 'returned',
        subject: 'التقرير الشهري لأداء الشؤون الإدارية — سبتمبر',
        recipientKind: 'internal', toDepts: ['GM'], toEntity: '', toEmail: '',
        fromDept: 'ADM', classification: 'سري', priority: 'عادي', attachments: [],
        body: 'يسرّنا أن نرفع لسعادتكم التقرير الشهري لأداء إدارة الشؤون الإدارية لشهر سبتمبر، والذي يتضمن:\n\n1. إنجاز 132 معاملة صادرة و 87 معاملة واردة.\n2. متوسط زمن اعتماد المعاملة: 1.6 يوم عمل.\n3. إنجاز 94% من طلبات الصيانة خلال المدة المحددة.',
        createdBy: 'E1006', createdAt: stamp(4, 12, 0),
        steps: steps('report', 0, { 0: { status: 'returned', at: stamp(2, 10, 5), note: 'نأمل إضافة مقارنة بأداء شهر أغسطس، وإرفاق جدول المعاملات المتأخرة.' } }),
        number: null, issuedAt: null, sentLog: [],
        history: [{ at: stamp(4, 12, 0), by: 'E1006', text: 'أنشأت المسودة' }, { at: stamp(2, 10, 5), by: 'E1002', text: 'أعاد المعاملة للتعديل' }],
      },
      {
        id: 'L1007', type: 'incoming', status: 'incoming',
        subject: 'إشعار بقرب انتهاء اشتراك العضوية السنوية',
        fromEntity: 'الغرفة التجارية الصناعية', externalRef: '47/8812', assignedDept: 'ADM', receivedAt: stamp(0, 8, 40),
        recipientKind: 'external', toDepts: [], toEntity: '', toEmail: '', classification: 'عادي', priority: 'عادي', attachments: ['الإشعار.pdf'],
        body: 'نحيطكم علماً بأن اشتراك منشأتكم في عضوية الغرفة سينتهي بنهاية الشهر الجاري، ونأمل المبادرة بالتجديد عبر البوابة الإلكترونية تفادياً لإيقاف الخدمات.',
        createdBy: 'E1006', createdAt: stamp(0, 8, 40), steps: [], number: 'و/1448/00089', issuedAt: stamp(0, 8, 40), sentLog: [], readBy: [],
        history: [{ at: stamp(0, 8, 40), by: 'E1006', text: 'سجّلت الوارد وأحالته إلى الشؤون الإدارية' }],
      },
      {
        id: 'L1008', type: 'internal', status: 'sent',
        subject: 'مذكرة بشأن تحديث بيانات الموظفين في نظام الموارد البشرية',
        recipientKind: 'internal', toDepts: ['ADM', 'FIN', 'IT', 'PRJ', 'SAL'], toEntity: '', toEmail: '',
        fromDept: 'HR', classification: 'عادي', priority: 'عاجل', attachments: [],
        body: 'نأمل من مدراء الإدارات التكرم بالتوجيه لمنسوبي إداراتهم بتحديث بياناتهم الشخصية والعائلية في نظام الموارد البشرية، وذلك في موعد أقصاه نهاية الشهر الجاري، لأهمية ذلك في تحديث بيانات التأمين الطبي.',
        createdBy: 'E1003', createdAt: stamp(2, 9, 0), steps: [{ userId: 'E1002', status: 'approved', at: stamp(2, 11, 0), note: '' }], number: 'م/1448/00077', issuedAt: stamp(2, 11, 0),
        sentLog: [{ at: stamp(2, 11, 5), by: 'E1003', channel: 'internal', to: 'ADM, FIN, IT, PRJ, SAL' }], readBy: [],
        history: [{ at: stamp(2, 9, 0), by: 'E1003', text: 'أنشأت المسودة' }, { at: stamp(2, 11, 0), by: 'E1002', text: 'صدرت المعاملة برقم م/1448/00077' }],
      },
      {
        id: 'L1009', type: 'external', status: 'review',
        subject: 'إشعار بترسية مشروع صيانة المبنى الرئيسي',
        recipientKind: 'external', toEntity: 'مؤسسة البناء المتين للمقاولات', toEmail: 'info@solidbuild.example', toDepts: [],
        fromDept: 'PRJ', classification: 'عادي', priority: 'عادي', attachments: ['محضر الترسية.pdf'],
        body: 'إشارة إلى عرضكم المقدّم لمشروع صيانة المبنى الرئيسي، يسرّنا إشعاركم بترسية المشروع على مؤسستكم بقيمة إجمالية قدرها (1,250,000) ريال شاملة ضريبة القيمة المضافة، ونأمل مراجعة الإدارة القانونية لتوقيع العقد خلال أسبوع من تاريخه.',
        createdBy: 'E1010', createdAt: stamp(2, 13, 0), steps: steps('external', 1), number: null, issuedAt: null, sentLog: [],
        history: [{ at: stamp(2, 13, 0), by: 'E1010', text: 'أنشأت المسودة' }],
      },
    ];

    const leaves = [
      { id: 'LV1', empId: 'E1014', type: 'annual', from: addDays(-3), to: addDays(8), status: 'approved', note: '', createdAt: stamp(10) },
      { id: 'LV2', empId: 'E1011', type: 'annual', from: addDays(10), to: addDays(24), status: 'pending', note: 'سفر عائلي', createdAt: stamp(1) },
      { id: 'LV3', empId: 'E1009', type: 'sick', from: addDays(-1), to: addDays(1), status: 'approved', note: 'تقرير طبي من منصة صحتي', createdAt: stamp(1) },
      { id: 'LV4', empId: 'E1012', type: 'exam', from: addDays(14), to: addDays(15), status: 'pending', note: 'اختبارات نهائية — جامعة', createdAt: stamp(0) },
      { id: 'LV5', empId: 'E1006', type: 'marriage', from: addDays(20), to: addDays(24), status: 'pending', note: '', createdAt: stamp(2) },
      { id: 'LV6', empId: 'E1007', type: 'annual', from: addDays(-40), to: addDays(-26), status: 'approved', note: '', createdAt: stamp(50) },
    ];

    const requests = [
      { id: 'R1', empId: 'E1007', type: 'خطاب تعريف بالراتب', details: 'موجّه إلى: البنك الأهلي', status: 'pending', createdAt: stamp(0, 9) },
      { id: 'R2', empId: 'E1011', type: 'شهادة خبرة', details: 'باللغتين العربية والإنجليزية', status: 'pending', createdAt: stamp(1, 12) },
      { id: 'R3', empId: 'E1013', type: 'سلفة على الراتب', details: 'المبلغ 3,000 ريال — تُسدّد على 3 أشهر', status: 'pending', createdAt: stamp(2, 10) },
      { id: 'R4', empId: 'E1009', type: 'تحديث بيانات', details: 'إضافة مولود إلى التأمين الطبي', status: 'approved', createdAt: stamp(6, 11) },
      { id: 'R5', empId: 'E1008', type: 'تأشيرة خروج وعودة', details: 'مفردة — 60 يوماً', status: 'pending', createdAt: stamp(0, 13) },
    ];

    const violations = [
      { id: 'V1', empId: 'E1013', vkey: 'late30', occurrence: 2, date: addDays(-4), status: 'مُبلّغ', investigated: true },
      { id: 'V2', empId: 'E1008', vkey: 'absent1', occurrence: 1, date: addDays(-2), status: 'قيد التحقيق', investigated: false },
    ];

    return {
      version: 1,
      currentUserId: 'E1002',
      settings: {
        companyAr: 'شركة المثال للتجارة والمقاولات',
        companyEn: 'Example Trading & Contracting Co.',
        cr: '1010000000',
        vat: '300000000000003',
        address: 'الرياض — طريق الملك فهد — ص.ب 12345',
        phone: '011 000 0000',
        email: 'info@company.example',
        workStart: '08:00',
        workEnd: '16:00',
        gosi: { saudiEmployee: 9.75, saudiEmployer: 11.75, nonSaudiEmployer: 2, cap: 45000 },
      },
      departments, employees, users, workflows, letters, leaves, requests, violations,
      counters: { external: 152, internal: 77, decision: 41, circular: 12, report: 20, incoming: 89 },
      payroll: {},
      seq: 1100,
    };
  };
})(window.APP);
