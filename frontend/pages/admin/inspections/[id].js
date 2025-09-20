import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
const API = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AdminInspectionDetail(){
  const router = useRouter();
  const { id } = router.query;
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);

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
      setStatus(data.status);
    })();
  }, [id]);

  async function updateStatus(){
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/api/admin/inspections/${id}/status`, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { alert('Ошибка обновления статуса'); return; }
    const data = await res.json(); setItem(data); alert('Статус обновлён');
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
    const data = await res.json(); setItem(data.order); alert('PDF загружен');
  }

  if (!item) return <div className="container" style={{maxWidth:900,padding:16}}>Загрузка…</div>;

  return (
    <div className="container" style={{maxWidth:900,padding:16}}>
      <h1>Осмотр #{item.id}</h1>
      <div style={{marginTop:8}}>
        <div><b>Пользователь:</b> {item.user_name || item.user_phone}</div>
        <div><b>Подписка:</b> {item.subscription_status}</div>
        <div><b>Объявление:</b> <a href={`/trades/${item.listing_id}`} target="_blank" rel="noreferrer">{item.listing_title || item.listing_id}</a></div>
        <div style={{marginTop:12}}><b>Статус:</b></div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <select value={status} onChange={e=>setStatus(e.target.value)}>
            <option>Идет модерация</option>
            <option>Выполняется осмотр машины</option>
            <option>Завершен</option>
          </select>
          <button onClick={updateStatus}>Сохранить</button>
        </div>
        <div style={{marginTop:16}}>
          <div><b>Отчёт (PDF):</b> {item.report_pdf_url ? <a href={item.report_pdf_url} target="_blank" rel="noreferrer">Открыть</a> : <span>не загружен</span>}</div>
          <input type="file" accept="application/pdf" onChange={uploadPdf} disabled={uploading}/>
        </div>
      </div>
    </div>
  );
}
