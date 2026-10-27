/**
 * Global Network Logger for React Native
 * Intercepts all global fetch requests across the app and outputs
 * structured, collapsible console groups in Chrome DevTools / Metro.
 */

let _reqCounter = 0;

function safeParseJson(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

function parseHeaders(headers) {
  if (!headers) return {};
  if (typeof headers.forEach === 'function') {
    const result = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
  return headers;
}

function parseBody(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    return safeParseJson(body);
  }
  // React Native FormData representation
  if (body?._parts && Array.isArray(body._parts)) {
    return body._parts.reduce((acc, [key, val]) => {
      acc[key] = val && typeof val === 'object' && val.name ? `[File: ${val.name}]` : val;
      return acc;
    }, {});
  }
  return body;
}

function shouldIgnoreUrl(url) {
  if (!url || typeof url !== 'string') return true;
  // Ignore Metro bundler, symbols, hot reloading, and dev server sockets
  return (
    url.includes(':8081') ||
    url.includes(':8082') ||
    url.includes('/symbolicate') ||
    url.includes('/hot-update') ||
    url.includes('/message?role=debugger') ||
    url.includes('/logs')
  );
}

function logGrouped({ id, method, url, status, headers, reqBody, resData, durationMs, error }) {
  const isOk = typeof status === 'number' && status >= 200 && status < 300;
  const icon = isOk ? '✅' : '❌';

  // Format clean endpoint display
  let endpoint = url;
  try {
    const parsed = new URL(url);
    endpoint = parsed.pathname + parsed.search;
  } catch {
    // If not standard URL format, fallback to raw url
  }

  const title = `${icon} [#${id}] ${method} ${endpoint} [${status}] (${durationMs}ms)`;

  if (console.groupCollapsed) {
    console.groupCollapsed(title);
    console.log('🌐 Full URL:', url);
    console.log('📤 Request:', {
      headers: parseHeaders(headers),
      body: parseBody(reqBody),
    });
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('📥 Response:', resData ?? '');
    }
    console.groupEnd();
  } else {
    console.log(title, {
      url,
      req: { headers: parseHeaders(headers), body: parseBody(reqBody) },
      res: resData || error,
    });
  }
}

export function initGlobalNetworkLogger(enabled = __DEV__) {
  if (!enabled) return;
  if (global.__NETWORK_LOGGER_INITIALIZED__) return;
  global.__NETWORK_LOGGER_INITIALIZED__ = true;

  const originalFetch = global.fetch;
  if (typeof originalFetch !== 'function') return;

  global.fetch = async (...args) => {
    const [resource, config] = args;
    const url = typeof resource === 'string' ? resource : resource?.url;

    if (shouldIgnoreUrl(url)) {
      return originalFetch(...args);
    }

    const id = ++_reqCounter;
    const startTime = Date.now();
    const method = (config?.method || 'GET').toUpperCase();
    const headers = config?.headers || {};
    const reqBody = config?.body;

    try {
      const response = await originalFetch(...args);
      const durationMs = Date.now() - startTime;

      let resData = '';
      try {
        const clone = response.clone();
        try {
          resData = await clone.json();
        } catch {
          resData = await clone.text().catch(() => '');
        }
      } catch {
        resData = '[Stream / Binary response]';
      }

      logGrouped({
        id,
        method,
        url,
        status: response.status,
        headers,
        reqBody,
        resData,
        durationMs,
      });

      return response;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      logGrouped({
        id,
        method,
        url,
        status: 'NET_ERR',
        headers,
        reqBody,
        durationMs,
        error: err.message || err,
      });
      throw err;
    }
  };
}
