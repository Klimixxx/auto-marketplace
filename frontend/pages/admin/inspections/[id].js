import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
const API = process.env.NEXT_PUBLIC_API_BASE || '';
const STATUS_FLOW = [
  'Оплачен/Ожидание модерации',
  'Заказ принят, Приступаем к Осмотру',
  'Производится осмотр',
  'Осмотр завершен'
];

export default function AdminInspectionDetail(){
  const router = useRouter();
  const { id } = router.query;
  const [item, setItem] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const token = localStorage.getItem('token');
      if (!token) { router.push('/login'); return; }

      const me = await fetch(`${API}/api/me`, { headers:{ Authorization:'Bearer '+token } });
      const user = await me.json();
      if (user?.role !== 'admin') { router.push('/'); return; }

      const res = await fetch(`${API}/api/admin/inspections/${id}`, { headers:{ Authorization:'Bearer '+token } });
      if (!res.ok) { alert('Не найдено или нет доступа'); router.push('/admin/inspections'); return; }
      const data = await res.json();
      setItem(data);
    })();
  }, [id]);

  async function updateOrderStatus(nextStatus){
    if (!item || item.status === nextStatus) return;
    const token = localStorage.getItem('token');
    setUpdatingStatus(true);
    const res = await fetch(`${API}/api/admin/inspections/${id}/status`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ status: nextStatus })
    });
    setUpdatingStatus(false);
    if (!res.ok) { alert('Ошибка обновления статуса'); return; }
    const data = await res.json();
    setItem(prev => ({ ...(prev || {}), ...data }));
    alert('Статус обновлён');
  }

  async function uploadPdf(e){
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const token = localStorage.getItem('token');
    const form = new FormData(); form.append('report_pdf', file);
    const res = await fetch(`${API}/api/admin/inspections/${id}/upload`, {
      method:'POST', headers:{ Authorization:'Bearer '+token }, body: form
    });
    setUploading(false);
    if (!res.ok) { alert('Ошибка загрузки PDF'); return; }
    const data = await res.json();
    setItem(prev => ({ ...(prev || {}), ...data.order }));
    alert('PDF загружен');
  }

  if (!item) return <div className="container" style={{maxWidth:900,padding:16}}>Загрузка…</div>;

  return (
    <div className="container" style={{maxWidth:900,padding:16}}>
      <h1>Осмотр #{item.id}</h1>
      <div style={{marginTop:8}}>
        <div><b>Пользователь:</b> {item.user_name || item.user_phone}</div>
        <div><b>Подписка:</b> {item.subscription_status}</div>
        <div><b>Объявление:</b> <a href={`/trades/${item.listing_id}`} target="_blank" rel="noreferrer">{item.listing_title || item.listing_id}</a></div>
        <div style={{marginTop:12}}><b>Текущий статус:</b> {item.status}</div>
        <div style={{marginTop:8}}><b>Управление статусами:</b></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {STATUS_FLOW.map(st => {
            const isActive = item.status === st;
            return (
              <button
                key={st}
                onClick={() => updateOrderStatus(st)}
                disabled={isActive || updatingStatus}
                style={{
                  padding:'8px 12px',
                  borderRadius:8,
                  border:isActive ? '1px solid #1E90FF' : '1px solid #d0d0d0',
                  background:isActive ? '#1E90FF' : '#fff',
                  color:isActive ? '#fff' : '#111',
                  cursor:(isActive || updatingStatus) ? 'default' : 'pointer'
                }}
              >
                {st}
              </button>
            );
          })}
        </div>
        <div style={{marginTop:16}}>
          <div><b>Отчёт (PDF):</b> {item.report_pdf_url ? <a href={item.report_pdf_url} target="_blank" rel="noreferrer">Открыть</a> : <span>не загружен</span>}</div>
          <input type="file" accept="application/pdf" onChange={uploadPdf} disabled={uploading}/>
        </div>
      </div>
    </div>
  );
}
