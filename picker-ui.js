// RodaPay 9.4.6 — aparência compacta dos seletores nativos.
// O input original continua no formulário e recebe os eventos normalmente.
// Não há calendário customizado: iOS/Android ainda abrem seu seletor acessível.
export function compactPickerValue(type, value) {
  if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  }
  if (type === 'month' && /^\d{4}-\d{2}$/.test(value || '')) {
    return `${value.slice(5, 7)}/${value.slice(0, 4)}`;
  }
  if (type === 'time' && /^\d{2}:\d{2}/.test(value || '')) return value.slice(0, 5);
  if (type === 'datetime-local' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value || '')) {
    return `${compactPickerValue('date', value.slice(0, 10))} ${value.slice(11, 16)}`;
  }
  return type === 'time' ? 'Selecionar hora' : type === 'month' ? 'Selecionar mês' : 'Selecionar data';
}

const inputTypes = 'input[type="date"],input[type="month"],input[type="time"],input[type="datetime-local"]';

export function enhancePicker(input) {
  if (!input || !input.isConnected || input.closest('.rp-picker-ui,.history-date-input')) return false;
  if (input.matches('.native-date-picker,[type="hidden"]') || input.disabled) return false;
  const wrapper = document.createElement('span');
  wrapper.className = 'rp-picker-ui';
  const display = document.createElement('span');
  display.className = 'rp-picker-value';
  display.setAttribute('aria-hidden', 'true');
  const icon = document.createElement('span');
  icon.className = 'rp-picker-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = input.type === 'time'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.append(display, icon, input);
  const refresh = () => { display.textContent = compactPickerValue(input.type, input.value); };
  input.addEventListener('input', refresh);
  input.addEventListener('change', refresh);
  refresh();
  return true;
}

export function enhancePickers(root = document) {
  root.querySelectorAll(inputTypes).forEach(enhancePicker);
  if (root.matches?.(inputTypes)) enhancePicker(root);
}

if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
  const setup = () => {
    enhancePickers();
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (node.matches?.(inputTypes) || node.querySelector?.(inputTypes))) {
          enhancePickers(node);
        }
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
}
