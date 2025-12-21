import { API_URL } from '../config';
const DEFAULT_TIMEOUT = 15000;

function logRequest(method: string, url: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Request: ${method} ${url}`, data ? { ...data as object, password: '***' } : '');
}

function logResponse(method: string, url: string, status: number, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Response: ${method} ${url} Status: ${status}`, data);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export const api = {
  get: async (endpoint: string, token?: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_URL}${endpoint}`;
    logRequest('GET', fullUrl);
    
    const response = await fetchWithTimeout(fullUrl, {
      method: 'GET',
      headers,
    });
    return handleResponse(response, 'GET', fullUrl);
  },
  post: async (endpoint: string, data: unknown, token?: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_URL}${endpoint}`;
    logRequest('POST', fullUrl, data);

    const response = await fetchWithTimeout(fullUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response, 'POST', fullUrl);
  },
  put: async (endpoint: string, data: unknown, token?: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_URL}${endpoint}`;
    logRequest('PUT', fullUrl, data);

    const response = await fetchWithTimeout(fullUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response, 'PUT', fullUrl);
  },
  patch: async (endpoint: string, data: unknown, token?: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_URL}${endpoint}`;
    logRequest('PATCH', fullUrl, data);

    const response = await fetchWithTimeout(fullUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    });
    return handleResponse(response, 'PATCH', fullUrl);
  },
  postForm: async (endpoint: string, formData: FormData, token?: string) => {
     const headers: HeadersInit = {};
     if (token) {
       headers['Authorization'] = `Bearer ${token}`;
     }
     const fullUrl = `${API_URL}${endpoint}`;
     logRequest('POST (Form)', fullUrl, { fileName: (formData.get('file') as File)?.name, size: (formData.get('file') as File)?.size });

     // Do not set Content-Type for FormData, browser sets it with boundary
     const response = await fetchWithTimeout(fullUrl, {
       method: 'POST',
       headers,
       body: formData,
     });
     return handleResponse(response, 'POST', fullUrl);
  },
  delete: async (endpoint: string, token?: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const fullUrl = `${API_URL}${endpoint}`;
    logRequest('DELETE', fullUrl);

    const response = await fetchWithTimeout(fullUrl, {
      method: 'DELETE',
      headers,
    });
    if (response.status === 204) {
        logResponse('DELETE', fullUrl, 204);
        return null;
    }
    return handleResponse(response, 'DELETE', fullUrl);
  }
};

async function handleResponse(response: Response, method: string, url: string) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    logResponse(method, url, response.status, errorData);
    throw new Error(errorData.detail || response.statusText);
  }
  const data = await response.json();
  logResponse(method, url, response.status, data);
  return data;
}
