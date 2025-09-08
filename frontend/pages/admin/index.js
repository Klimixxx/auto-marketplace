import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminHome() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => location.href = '/');
  }, []);

  return (
    <AdminLayout me={me} title="Админ Панель">
      <p style={{ marginTop: 0 }}>
        Добро пожаловать. Выберите раздел в меню слева:
      </p>
      <ul>
        <li>«Дешборд» — статистика по платформе (посещения, число пользователей).</li>
        <li>«Администраторы» — управление правами, добавление админов по 6-значному ID.</li>
      </ul>
    </AdminLayout>
  );
}
