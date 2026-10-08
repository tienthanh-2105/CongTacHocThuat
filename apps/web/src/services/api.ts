export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1').replace(/\/$/, '');

export async function checkApi(): Promise<string> {
  const response = await fetch(`${API_URL}/health`, { credentials: 'include', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error('API chưa sẵn sàng');
  const data = await response.json() as { database?: string };
  return data.database === 'connected' ? 'Đã kết nối hệ thống' : 'Chưa kết nối được dữ liệu';
}
