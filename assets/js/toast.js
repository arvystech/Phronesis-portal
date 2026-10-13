// admin/js/toast.js
// Vanilla replacement for react-hot-toast (top-right, rounded-xl, 3500ms duration)

(function () {
  let container = null;

  function ensureContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'info') {
    const parent = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold shadow-lg transition-all duration-300 transform translate-y-[-10px] opacity-0 max-w-sm border`;

    let icon = 'ℹ';
    if (type === 'success') {
      icon = '✓';
      toast.classList.add('bg-white', 'text-emerald-800', 'border-emerald-200');
    } else if (type === 'error') {
      icon = '✕';
      toast.classList.add('bg-white', 'text-red-700', 'border-red-200');
    } else {
      toast.classList.add('bg-white', 'text-text-dark', 'border-border');
    }

    const iconSpan = document.createElement('span');
    iconSpan.className = `w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
      type === 'success'
        ? 'bg-emerald-100 text-emerald-700'
        : type === 'error'
        ? 'bg-red-100 text-red-600'
        : 'bg-royal-light text-royal'
    }`;
    iconSpan.textContent = icon;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'flex-1 leading-snug';
    msgSpan.textContent = message;

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    parent.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-10px]', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-[-10px]', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 3500);
  }

  window.toast = {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
  };
})();
