// نظام إدارة الموظفين (وكلاء ذكاء اصطناعي)
import { el, qs, toast } from './ui.js';
import * as vault from '../core/vault.js';
import { on } from '../core/util.js';

const AGENTS = [
  {
    id: 'marketing',
    name: 'مدير التسويق',
    icon: '◎',
    role: 'السوق والحملات والجمهور',
  },
  {
    id: 'content',
    name: 'مدير المحتوى',
    icon: '✎',
    role: 'الكتابة والمحتوى والنشر',
  },
  {
    id: 'operations',
    name: 'مدير العمليات',
    icon: '⚙',
    role: 'الأتمتة والمسارات والعمليات',
  },
];

// ================= شاشة القفل =================

async function showLock() {
  const app = qs('#app');
  app.innerHTML = '';
  const initialized = await vault.isInitialized();

  const pass = el('input', {
    type: 'password', placeholder: 'عبارة المرور', autocomplete: 'current-password',
  });
  const passToggle = el('button', {
    type: 'button',
    class: 'password-toggle',
    text: '👁',
    title: 'عرض/إخفاء المرور',
    onclick: () => {
      const isPassword = pass.type === 'password';
      pass.type = isPassword ? 'text' : 'password';
      passToggle.classList.toggle('visible');
    },
  });

  const confirm = el('input', {
    type: 'password', placeholder: 'تأكيد عبارة المرور', autocomplete: 'new-password',
  });
  const confirmToggle = el('button', {
    type: 'button',
    class: 'password-toggle',
    text: '👁',
    title: 'عرض/إخفاء المرور',
    onclick: () => {
      const isPassword = confirm.type === 'password';
      confirm.type = isPassword ? 'text' : 'password';
      confirmToggle.classList.toggle('visible');
    },
  });

  const err = el('p', { class: 'error' });

  async function submit() {
    err.textContent = '';
    const p = pass.value;
    if (!p) { err.textContent = 'أدخل عبارة المرور.'; return; }
    try {
      if (initialized) {
        await vault.unlock(p);
      } else {
        if (p.length < 10) { err.textContent = 'اجعلها ١٠ أحرف على الأقل. لا يمكن استرجاعها إن نُسيت.'; return; }
        if (p !== confirm.value) { err.textContent = 'العبارتان غير متطابقتين.'; return; }
        await vault.initVault(p);
      }
      pass.value = confirm.value = '';
      await boot();
    } catch (e) {
      err.textContent = e.message;
    }
  }

  const formChildren = [
    el('h1', { text: initialized ? 'افتح نظامك' : 'أنشئ خزنتك' }),
    el('p', {
      class: 'muted',
      text: initialized
        ? 'عبارة مرورك تفتح التشفير. لا نسخة منها في أي مكان.'
        : 'عبارة المرور هي مفتاح التشفير الوحيد. إن نسيتها لا يمكن استرجاع بياناتك — ولا نحن نستطيع.',
    }),
    el('div', { class: 'password-field' }, pass, passToggle),
  ];

  if (!initialized) {
    formChildren.push(el('div', { class: 'password-field' }, confirm, confirmToggle));
  }

  formChildren.push(err);
  formChildren.push(el('button', { class: 'btn primary block', text: initialized ? 'فتح' : 'إنشاء الخزنة', onclick: submit }));
  formChildren.push(el('div', { class: 'lock-facts' },
    el('span', { text: 'AES-256-GCM' }),
    el('span', { text: 'Local First' }),
    el('span', { text: 'Zero Knowledge' }),
    el('span', { text: 'بلا سيرفر' }),
  ));

  const form = el('div', { class: 'lock-form' }, ...formChildren);

  [pass, confirm].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));

  app.append(el('div', { class: 'lock' },
    el('div', { class: 'brand-mark' },
      el('span', { class: 'mark', text: '◈' }),
      el('span', { class: 'brand-name', text: 'نظام الموظفين الذكيين' }),
    ),
    form,
  ));
  setTimeout(() => pass.focus(), 60);
}

// ================= الصفحة الرئيسية =================

function renderDashboard() {
  const app = qs('#app');
  app.innerHTML = '';

  const cardElements = AGENTS.map((agent) => {
    const card = el('div', { class: 'agent-card' },
      el('div', { class: 'agent-icon', text: agent.icon }),
      el('h3', { text: agent.name }),
      el('p', { class: 'muted', text: agent.role }),
      el('div', { class: 'agent-tools', text: '📌 إضافة أدوات...' }),
    );
    card.onclick = () => openAgentTools(agent);
    return card;
  });

  app.append(
    el('div', { class: 'dashboard' },
      el('div', { class: 'page-head' },
        el('h1', { text: 'الموظفين' }),
        el('p', { text: 'إدارة الوكلاء والأدوات' }),
      ),
      el('div', { class: 'agents-grid' }, ...cardElements),
      el('div', { class: 'page-head', style: 'margin-top: 2rem' },
        el('button', { class: 'btn danger', text: '⚿ اقفل', onclick: () => vault.lock() }),
      ),
    ),
  );
}

function openAgentTools(agent) {
  let toolsList = JSON.parse(localStorage.getItem(`agent_${agent.id}_tools`) || '[]');

  const toolInput = el('input', {
    type: 'text',
    placeholder: 'اسم الأداة (Google Sheets, Slack, إلخ)',
    class: 'tool-input',
  });
  const urlInput = el('input', {
    type: 'url',
    placeholder: 'رابط الأداة (API key أو رابط)',
    class: 'tool-input',
  });

  const toolsList_div = el('div', { class: 'tools-list' });

  function renderTools() {
    toolsList_div.innerHTML = '';
    if (toolsList.length === 0) {
      toolsList_div.append(el('p', { class: 'muted', style: 'font-size: 0.8rem', text: 'لا توجد أدوات مضافة بعد' }));
      return;
    }
    toolsList.forEach((tool, idx) => {
      toolsList_div.append(
        el('div', { class: 'tool-item' },
          el('div', { class: 'tool-info' },
            el('strong', { text: tool.name, style: 'font-size: 0.85rem' }),
            el('small', { text: tool.url, style: 'color: var(--fg-3); font-size: 0.75rem; display: block; margin-top: 0.2rem' }),
          ),
          el('button', {
            class: 'tool-delete',
            text: '✕',
            onclick: () => {
              toolsList.splice(idx, 1);
              localStorage.setItem(`agent_${agent.id}_tools`, JSON.stringify(toolsList));
              renderTools();
            }
          }),
        )
      );
    });
  }

  const addBtn = el('button', {
    class: 'btn primary',
    text: '➕ أضف أداة',
    style: 'font-size: 0.85rem; padding: 0.4rem 0.75rem',
    onclick: () => {
      const name = toolInput.value.trim();
      const url = urlInput.value.trim();
      if (!name || !url) {
        toast('أدخل اسم الأداة والرابط', 'warn');
        return;
      }
      toolsList.push({ name, url });
      localStorage.setItem(`agent_${agent.id}_tools`, JSON.stringify(toolsList));
      toolInput.value = urlInput.value = '';
      renderTools();
      toast(`تم إضافة: ${name}`, 'ok');
    }
  });

  renderTools();

  const modal = el('div', { class: 'modal-overlay', onclick: (e) => e.target === modal && modal.remove() },
    el('div', { class: 'modal-content' },
      el('div', { class: 'modal-head' },
        el('h2', { text: `${agent.name} - الأدوات`, style: 'font-size: 1rem' }),
        el('button', { class: 'modal-close', text: '✕', onclick: () => modal.remove() }),
      ),
      el('div', { class: 'modal-body', style: 'font-size: 0.8rem' },
        toolInput,
        urlInput,
        addBtn,
        el('div', { style: 'margin-top: 1rem' },
          el('p', { style: 'font-size: 0.75rem; color: var(--fg-3); margin-bottom: 0.5rem', text: 'الأدوات المضافة:' }),
          toolsList_div,
        ),
      ),
    ),
  );
  document.body.append(modal);
}

// ================= الإقلاع =================

async function boot() {
  renderDashboard();
}

on('vault:locked', () => { showLock(); });

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

boot().catch((e) => {
  console.error(e);
  qs('#app').innerHTML = `<p class="error">تعذّر تشغيل النظام: ${e.message}</p>`;
});

// تسجيل عامل الخدمة للعمل بلا اتصال
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* اختياري */ });
  });
}

export { toast };
