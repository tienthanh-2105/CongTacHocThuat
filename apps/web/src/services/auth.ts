import { API_URL } from "./api";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  roles: string[];
  department?: string;
  position?: string;
};
async function authRequest(path: string, body: object) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error("Không thể kết nối máy chủ. Vui lòng thử lại sau.");
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    throw new Error(
      response.status === 401
        ? "Tên đăng nhập hoặc mật khẩu không đúng."
        : response.status === 429
          ? "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút."
          : typeof data?.message === "string"
            ? data.message
            : "Yêu cầu không hợp lệ. Vui lòng kiểm tra thông tin.",
    );
  }
  return response;
}
export async function login(
  username: string,
  password: string,
): Promise<{ user: AuthUser; expiresAt: string }> {
  const response = await authRequest("login", { username, password });
  return response.json();
}
export async function logout(): Promise<void> {
  await authRequest("logout", {});
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("Không thể tải thông tin tài khoản.");
  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await authRequest("change-password", { currentPassword, newPassword });
}
