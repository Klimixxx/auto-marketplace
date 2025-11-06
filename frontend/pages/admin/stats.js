import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
const API = process.env.NEXT_PUBLIC_API_BASE;

export default function AdminStats() {
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { location.href = '/login'; return; }
    fetch(`${API}/api/me`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => { if (d.role !== 'admin') { location.href = '/'; return; } setMe(d); })
      .catch(() => location.href = '/');
  }, []);

  useEffect(() => {
    if (!me) return;
    const token = localStorage.getItem('token');
    fetch(`${API}/api/admin/stats`, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setStats).catch(()=>{});
  }, [me]);

  const userStats = stats?.usersStats || {};
  const listingStats = stats?.listingsStats || {};
  const financeStats = stats?.finance || {};
  const balanceTopups = financeStats.balanceTopups || {};
  const totalUsers = userStats.total ?? stats?.users ?? 0;

  return (
    <AdminLayout me={me} title="Статистика">
      {!stats && <div>Загрузка…</div>}
      {stats && (
        <>
          <section style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
            <h2 style={sectionTitle}>Пользователи</h2>
            <div style={cardRow}>
              <Stat title="Кол-во пользователей" value={totalUsers} />
              <Stat title="Новых за 30 дней" value={userStats.new30Days ?? 0} />
              <Stat title="Активных за 30 дней" value={userStats.active30Days ?? 0} />
              <Stat title="С положительным балансом" value={userStats.positiveBalance ?? 0} />
            </div>
          </section>

          <section style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
            <h2 style={sectionTitle}>Объявления</h2>
            <div style={cardRow}>
              <Stat title="Кол-во публичных предложений" value={listingStats.publicOffers ?? 0} />
              <Stat title="Кол-во открытых аукционов" value={listingStats.openAuctions ?? 0} />
              <Stat title="Кол-во объявлений" value={listingStats.totalListings ?? stats?.listings?.published ?? 0} />
              <Stat title="Кол-во объявлений со статусом «Торги завершены»" value={listingStats.finished ?? 0} />
              <Stat title="Общая стоимость объявлений" value={listingStats.totalValue ?? 0} isCurrency />
            </div>
          </section>

          <section style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
            <h2 style={sectionTitle}>Финансы</h2>
            <div style={cardRow}>
              <Stat title="Кол-во заявок торги" value={financeStats.tradeOrders ?? 0} />
              <Stat title="Кол-во заявок автотеки" value={financeStats.autotekaOrders ?? 0} />
              <Stat title="Кол-во заявок осмотров" value={financeStats.inspectionOrders ?? stats?.inspections?.total ?? 0} />
              <Stat title="Пополнения за месяц" value={balanceTopups.month ?? 0} isCurrency />
              <Stat title="Пополнения за полгода" value={balanceTopups.halfYear ?? 0} isCurrency />
              <Stat title="Пополнения за год" value={balanceTopups.year ?? 0} isCurrency />
            </div>
          </section>

          <VisitsChart data={stats.visits || []} />
        </>
      )}
    </AdminLayout>
  );
}

function Stat({ title, value, isCurrency = false }) {
  const displayValue = formatStatValue(value, isCurrency);
  return (
    <div style={{
      background:'rgba(255,255,255,0.03)',
      border:'1px solid rgba(255,255,255,0.08)',
      borderRadius:12, padding:'12px 14px', minWidth:220
    }}>
      <div style={{ fontSize:12, opacity:.8 }}>{title}</div>
      <div style={{ fontSize:24, fontWeight:800 }}>{displayValue}</div>
    </div>
  );
}

function formatStatValue(value, isCurrency) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (isCurrency) {
    const amount = Number.isFinite(numeric) ? numeric : 0;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(amount);
  }
  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString('ru-RU');
  }
  return String(value ?? '0');
}

const sectionTitle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
};

const cardRow = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 20,
};

function VisitsChart({ data }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data.map(d=>d.cnt), 1);
  const w = 800, h = 200, pad = 22;
  const bar = (w - pad*2) / data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} aria-label="Визиты за 30 дней">
      <rect x="0" y="0" width={w} height={h} fill="transparent" />
      {data.map((d,i) => {
        const x = pad + i*bar + 2;
        const bh = Math.round((d.cnt / max) * (h - pad*2));
        const y = h - pad - bh;
        return <rect key={d.day} x={x} y={y} width={bar-4} height={bh} rx="3" fill="rgba(34,197,94,0.6)" />;
      })}
      <text x={w-pad} y={h-6} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.6)">
        последние 30 дней
      </text>
    </svg>
  );
}


