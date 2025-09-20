// frontend/components/InspectionModal.jsx
import { useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_BASE || '';

export default function InspectionModal({ listingId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (!isOpen) return null;

  async function order() {
    setLoading(true); setErr('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        const next = `/trades/${listingId}`;
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
        return;
      }
      const res = await fetch(`${API}/api/inspections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ listingId })
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) setErr(data?.message || 'Недостаточно средств, пополните счет');
        else setErr(data?.error || 'Ошибка. Повторите позже.');
        return;
      }
      // успех: ведём в «Мои осмотры»
      window.location.href = '/inspections';
    } catch (e) {
      setErr('Сеть недоступна. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.backdrop}>
      <div style={S.modal}>
        <div style={S.header}>
          <h3 style={{margin:0}}>Заказать отчет по осмотру данной машины</h3>
          <button onClick={onClose} style={S.close}>×</button>
        </div>

        <div style={{marginTop:12}}>
          <b>Стоимость услуги:</b> 12 000 ₽
          <div style={{color:'#666'}}>С подпиской <b>PRO</b> действует <b>50%</b> скидка на любой осмотр</div>
        </div>

        <div style={{marginTop:12}}>
          <b>Пример отчета по машине</b><br/>
          <a href="/reports/example_car_report.pdf" target="_blank" rel="noreferrer" style={S.link}>
            Открыть пример (PDF)
          </a>
        </div>

        <div style={{marginTop:12}}>
          <b>Минимальное содержание Отчета:</b>
          <ul style={{marginTop:6, marginBottom:0}}>
            <li>не менее 10 фотографий автомобиля снаружи;</li>
            <li>не менее 2 фото салона автомобиля;</li>
            <li>4 фото колёс с видимыми арками;</li>
            <li>карта лакокрасочного покрытия автомобиля;</li>
            <li>видеоматериалы;</li>
          </ul>
        </div>

        {err && <div style={{color:'#b00020', marginTop:8}}>{err}</div>}

        <div style={{marginTop:14, display:'flex', justifyContent:'flex-end', gap:8}}>
          <button onClick={order} disabled={loading} style={S.primary}>
            {loading ? 'Оформляем…' : 'Заказать отчет'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  backdrop:{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},
  modal:{background:'#fff',borderRadius:12,padding:16,width:'min(720px,92vw)',boxShadow:'0 10px 30px rgba(0,0,0,.2)'},
  header:{display:'flex',alignItems:'center',justifyContent:'space-between'},
  close:{fontSize:22,background:'transparent',border:'none',cursor:'pointer',lineHeight:1},
  link:{display:'inline-block',border:'1px solid #ddd',padding:'6px 10px',borderRadius:8,textDecoration:'none'},
  primary:{background:'#111',color:'#fff',border:'none',borderRadius:8,padding:'10px 16px',cursor:'pointer'}
};
