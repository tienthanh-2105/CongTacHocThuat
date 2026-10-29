import { API_URL } from "./api";

export async function workflowRequest<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const attempts = method === "GET" ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        credentials: "include",
        cache: "no-store",
        headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      if (attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      throw error;
    }

    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status >= 500 && attempt + 1 < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const message = payload && typeof payload === "object" && "message" in payload
        ? (payload as { message?: unknown }).message
        : null;
      throw new Error(typeof message === "string" ? message : `Yêu cầu thất bại (${response.status})`);
    }
    return payload as T;
  }
  throw new Error("Không thể tải dữ liệu.");
}
