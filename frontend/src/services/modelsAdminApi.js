const ADMIN_MODELS_API_BASE_URL = 'http://localhost:2233/admin/models';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function fetchAdminModels() {
  return requestJson(ADMIN_MODELS_API_BASE_URL);
}

export function createAdminModel(body) {
  return requestJson(ADMIN_MODELS_API_BASE_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function cloneAdminModel(modelId, body) {
  return requestJson(`${ADMIN_MODELS_API_BASE_URL}/${encodeURIComponent(modelId)}/clone`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function updateAdminModel(modelId, body) {
  return requestJson(`${ADMIN_MODELS_API_BASE_URL}/${encodeURIComponent(modelId)}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  });
}

export function deleteAdminModel(modelId) {
  return requestJson(`${ADMIN_MODELS_API_BASE_URL}/${encodeURIComponent(modelId)}`, {
    method: 'DELETE'
  });
}
