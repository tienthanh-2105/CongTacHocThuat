import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkApi } from '../services/api';

export default function HomeScreen() {
  const [status, setStatus] = useState('Chưa kiểm tra kết nối');
  const [loading, setLoading] = useState(false);
  async function checkConnection() {
    setLoading(true);
    try { setStatus(await checkApi()); }
    catch { setStatus('Không thể kết nối. Vui lòng thử lại sau.'); }
    finally { setLoading(false); }
  }
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.label}>KHOA CÔNG NGHỆ THÔNG TIN</Text>
      <Text style={styles.title}>Công tác học thuật</Text>
      <Text style={styles.description}>Theo dõi và tham gia các hoạt động học thuật của khoa.</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Không gian sinh viên</Text>
        <Text style={styles.description}>Các chức năng đăng ký, điểm danh và lịch sử tham gia sẽ được phát triển tại đây.</Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
      <Pressable accessibilityRole="button" disabled={loading} onPress={checkConnection} style={[styles.button, loading && styles.disabled]}>
        <Text style={styles.buttonText}>{loading ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}</Text>
      </Pressable>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 28, paddingTop: 80, paddingBottom: 48, backgroundColor: '#f5f7fc', justifyContent: 'center' },
  label: { color: '#365acb', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { fontSize: 42, fontWeight: '800', color: '#17264b', marginTop: 20, marginBottom: 16 },
  description: { fontSize: 16, lineHeight: 26, color: '#596780' },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 24, marginVertical: 32, borderWidth: 1, borderColor: '#e0e6f0' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#17264b', marginBottom: 12 },
  status: { color: '#596780', marginBottom: 16 },
  button: { backgroundColor: '#365acb', borderRadius: 14, padding: 18, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
