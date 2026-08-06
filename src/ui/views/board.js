// مجلس الإدارة — الوكلاء ومؤشراتهم ومحادثتهم
import { el, pageHeader, section, toast, spinner } from '../ui.js';
import { AGENTS } from '../../ai/agents.js';
import { agentKPIs, askAgent, buildContext } from '../../ai/council.js';
import { aiReady } from '../../ai/provider.js';
import { T, list, settings } from '../../core/store.js';
import { mdLite, money, fmtRelative, num } from '../../core/util.js';

export function renderBoard(root) {
  let active = AGENTS[0].id;
  let running = false;

  async function ask(prompt) {
    if (!prompt.trim()) return;
    if (!aiReady()) {
      toast('فعّل طبقة الذكاء وأضف مفتاح API من الإعدادات', 'warn');
      location.hash = '#/settings';
      return;
    }
    if (running) return;
    running = true;
    const out = root.querySelector('.agent-output');
    out.innerHTML = '';
    out.append(spinner('الوكيل يعمل…'));
    try {
      const res = await askAgent(active, prompt);
      out.innerHTML = mdLite(res.text);
      if (res.usage) {
        out.append(el('p', {
          class: 'usage',
          text: `الرموز: مُدخلة ${num(res.usage.input_tokens || 0)} · مُخرجة ${num(res.usage.output_tokens || 0)}`,
        }));
      }
      drawHistory();
    } catch (e) {
      out.innerHTML = '';
      out.append(el('p', { class: 'error', text: e.message }));
    } finally {
      running = false;
    }
  }

  function drawHistory() {
    const host = root.querySelector('.agent-history');
    if (!host) return;
    host.innerHTML = '';
    const runs = list(T.AGENTRUN, (r) => r.agentId === active).slice(0, 8);
    if (!runs.length) {
      host.append(el('p', { class: 'muted', text: 'لا سجلّ بعد لهذا الوكيل.' }));
      return;
    }
    for (const r of runs) {
      const details = el('details', { class: 'run' },
        el('summary', { text: `${r.prompt.slice(0, 90)} · ${fmtRelative(r.updatedAt)}` }),
        el('div', { class: 'run-body', html: mdLite(r.output || '') }),
      );
      host.append(details);
    }
  }

  const SUGGESTIONS = {
    ceo: ['ما الذي يجب أن أركّز عليه هذا الأسبوع؟', 'ما القرار الذي أؤجّله وأنا أعرف أنه يكلّفني؟'],
    marketing: ['أين الفجوة التي يمكنني احتلالها؟', 'أي قناة تستحق مضاعفة الجهد؟'],
    content: ['اكتب لي ثلاث مسودات جاهزة للنشر', 'ما الأفكار الضعيفة التي يجب حذفها؟'],
    finance: ['كم شهرًا يكفي نقدي الحالي؟', 'ما أكبر بند يمكن قصّه دون ضرر؟'],
    research: ['لخّص لي أهم ما في مصادري', 'ما الذي تعلّمته ولم أطبّقه بعد؟'],
    learning: ['ابنِ لي خطة تعلّم لهذا الشهر', 'ما المهارة التي تعيق مشروعي الحالي؟'],
    legal: ['راجع عقودي وأبرز البنود الخطرة', 'أين أنا معرّض للمخاطرة في الدفع؟'],
    security: ['ما أكبر خطر مفتوح عليّ الآن؟', 'أين أعتمد على طرف واحد بشكل خطر؟'],
    operations: ['ما الذي أكرّره ويستحق الأتمتة؟', 'رتّب لي مهام اليوم حسب الأثر'],
  };

  function draw() {
    root.innerHTML = '';
    root.append(pageHeader(
      'مجلس الإدارة',
      'تسعة وكلاء، لكل واحد دور ومؤشر أداء. يقترحون ولا يفرضون.',
    ));

    if (!aiReady()) {
      root.append(section(null, el('p', { class: 'notice' },
        'طبقة الذكاء غير مُفعّلة. ',
        el('a', { href: '#/settings', text: 'أضف مفتاح API' }),
        ' لتشغيل المجلس. بقية النظام يعمل بدونه بالكامل.',
      )));
    }

    // مؤشرات الوكلاء
    const cur = settings().currency;
    const kpis = agentKPIs();
    root.append(el('div', { class: 'agent-grid' },
      ...kpis.map((a) => el('button', {
        class: `agent-card${a.id === active ? ' active' : ''}`,
        onclick: () => { active = a.id; draw(); },
      },
      el('span', { class: 'agent-icon', text: a.icon }),
      el('span', { class: 'agent-name', text: a.name }),
      el('span', { class: 'agent-role', text: a.role }),
      el('span', { class: 'agent-kpi' },
        el('em', { text: a.kpiLabel }),
        el('strong', { text: a.kpiFormat === 'money' ? money(a.kpiValue, cur) : num(a.kpiValue) }),
      ),
      )),
    ));

    const agent = AGENTS.find((a) => a.id === active);
    const input = el('textarea', {
      class: 'agent-input',
      rows: 3,
      placeholder: `اسأل ${agent.name}…`,
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { ask(input.value); }
    });

    const suggestions = el('div', { class: 'chips' },
      ...(SUGGESTIONS[active] || []).map((s) => el('button', {
        class: 'chip', text: s,
        onclick: () => { input.value = s; ask(s); },
      })),
    );

    root.append(section(`${agent.icon} ${agent.name}`,
      el('p', { class: 'muted', text: agent.role }),
      suggestions,
      input,
      el('div', { class: 'row-actions' },
        el('button', { class: 'btn primary', text: 'اسأل', onclick: () => ask(input.value) }),
        el('button', {
          class: 'btn', text: 'ما الذي يراه؟',
          onclick: () => {
            const ctx = buildContext(agent.scopes);
            const out = root.querySelector('.agent-output');
            out.innerHTML = '';
            out.append(
              el('p', { class: 'muted', text: 'هذا هو السياق الكامل الذي يُرسل إلى النموذج — لا شيء غيره:' }),
              el('pre', { class: 'context', text: ctx }),
            );
          },
        }),
      ),
      el('div', { class: 'agent-output' }),
    ));

    root.append(section('السجل', el('div', { class: 'agent-history' })));
    drawHistory();
  }

  draw();
}
