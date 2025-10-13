const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export const NETWORK_ERROR_MESSAGE = "Chờ cô 1 tí cô đang mở máy để hỗ trợ tụi con đây \n (server free lâu dô là nó tắt :> )";

async function request(path, options = {}) {
  const isFormData = options?.body instanceof FormData;
  const headers = { ...(options.headers || {}) };

  if (!isFormData && options?.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (networkError) {
    const error = new Error(NETWORK_ERROR_MESSAGE);
    error.cause = networkError;
    throw error;
  }

  if (!response.ok) {
    let errorMessage = "Yêu cầu thất bại";

    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch {
      // Không có nội dung JSON trả về.
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function sendChatMessage({
  message,
  history,
  sb3Report,
  attachments = [],
  preferences,
  profile,
  sessionId
}) {
  const formData = new FormData();
  formData.append("message", message);
  formData.append("history", JSON.stringify(history));

  if (sessionId) {
    formData.append("sessionId", sessionId);
  }

  if (sb3Report) {
    formData.append("sb3Report", sb3Report);
  }

  if (preferences) {
    formData.append("preferences", JSON.stringify(preferences));
  }

  if (profile) {
    formData.append("profile", JSON.stringify(profile));
  }

  attachments.forEach((file) => {
    formData.append("attachments", file);
  });

  return request("/api/chat", {
    method: "POST",
    body: formData
  });
}

export async function uploadSb3(file) {
  const formData = new FormData();
  formData.append("file", file);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      body: formData
    });
  } catch (networkError) {
    const error = new Error(NETWORK_ERROR_MESSAGE);
    error.cause = networkError;
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Không thể tải tệp");
  }

  return response.json();
}

export async function exportSb3FromChat(content) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/export-sb3`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
  } catch (networkError) {
    const error = new Error(NETWORK_ERROR_MESSAGE);
    error.cause = networkError;
    throw error;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Không thể xuất file .sb3");
  }

  return response.blob();
}

export async function checkServerHealth() {
  return request("/api/health");
}

export async function loginAdmin({ username, password }) {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export async function fetchAdminAnalytics(token) {
  return request("/api/admin/analytics", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function logoutAdmin(token) {
  return request("/api/admin/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
