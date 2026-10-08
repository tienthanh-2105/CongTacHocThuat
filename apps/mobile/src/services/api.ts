import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001/api/v1' : 'http://localhost:3001/api/v1')).replace(/\/$/, '');

export async function checkApi(): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
    if (!response.ok) throw new Error('API chưa sẵn sàng');
    const data = await response.json() as { database?: string };
    return data.database === 'connected' ? 'Đã kết nối hệ thống' : 'Chưa kết nối được dữ liệu';
  } finally { clearTimeout(timeout); }
}
