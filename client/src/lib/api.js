/**
 * Small API transport shared by VIBE screens.
 * Keeps auth headers, timeouts, and server errors consistent.
 */
export function createApiClient({ baseUrl, getInitData = () => '' }) {
  const base = String(baseUrl || '').replace(/\/$/, '');

  return async function request(path, options = {}) {
    if (!base) {
      throw new Error('Сервер VIBE не настроен: проверь VITE_API_URL в Render.');
    }

    const initData = getInitData() || '';
    let token = '';
    if (!initData) {
      try {
        token = localStorage.getItem('vibe-session') || '';
      } catch {
        // Storage may be disabled; anonymous requests can still be attempted.
      }
    }

    const requestTimeout = path === '/api/stories' || path === '/api/listings'
      ? 60000
      : 30000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeout);
    let response;

    try {
      response = await fetch(base + path, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(options.headers || {}),
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(
          requestTimeout === 60000
            ? 'Сервер VIBE не ответил за 60 секунд. Возможно, он запускается после сна — попробуй ещё раз.'
            : 'Сервер VIBE не ответил вовремя. Возможно, он запускается после сна — попробуй ещё раз.',
        );
      }
      throw new Error('Не удалось подключиться к серверу VIBE. Проверь интернет и попробуй ещё раз.');
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Ошибка сервера (' + response.status + ')');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  };
}
