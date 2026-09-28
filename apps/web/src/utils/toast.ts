// 全局輕提示（toast）：成功／資訊類訊息用，冒出後自動消失，唔阻塞用戶操作
// 用法：import { toast } from '../utils/toast'; toast.success('已儲存');
// 需要用戶修正嘅錯誤／校驗訊息繼續用 alert()，唔好改用 toast

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (container && document.body.contains(container)) return container;
  if (!document.getElementById('toast-global-style')) {
    const style = document.createElement('style');
    style.id = 'toast-global-style';
    style.textContent = `
      @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
      @keyframes toast-out { from { opacity: 1; } to { opacity: 0; transform: translate(-50%, 8px); } }
      .toast-item { animation: toast-in 0.25s ease-out; }
      .toast-item.toast-leaving { animation: toast-out 0.3s ease-in forwards; }
    `;
    document.head.appendChild(style);
  }
  container = document.createElement('div');
  container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none';
  document.body.appendChild(container);
  return container;
}

export function showToast(message: string, type: 'success' | 'info' = 'success'): void {
  if (typeof document === 'undefined' || !message) return;
  const root = ensureContainer();
  const el = document.createElement('div');
  el.className =
    'toast-item max-w-[80vw] rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg whitespace-pre-wrap ' +
    (type === 'success' ? 'bg-green-600' : 'bg-gray-700');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('toast-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, 2200);
}

export const toast = {
  success: (message: string) => showToast(message, 'success'),
  info: (message: string) => showToast(message, 'info'),
};
