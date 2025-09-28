// frontend/components/AdminLayout.jsx
import { useRouter } from 'next/router';

export default function AdminLayout({ me, title, children }) {
  const router = useRouter();

  // Используем токены из globals.css
  const UI = {
    pageBg: 'var(--bg)',                 // молочный фон страницы
    cardBg: 'var(--surface-1)',         // фон карточек/контента
    text: 'var(--text)',                // основной текст
    muted: 'var(--text-muted)',         // вторичный текст
    border: 'var(--border)',            // бордеры
    link: 'var(--blue)',                // синий акцент ссылок
    linkHover: '#1e53d6',               // hover для ссылок (слегка темнее)
    menuBg: 'var(--surface-1)',         // фон левой панели
    menuBorder: 'var(--border-strong)', // бордер левой панели
    activeBg: 'var(--accent-50)',       // фон активного пункта
    activeBorder: 'var(--accent-100)',  // рамка активного пункта
    shadow: 'var(--shadow-sm)',         // лёгкая тень карточек
    radius: 'var(--radius-lg)',         // скругление
  };

  const MAXW = 1200;

  const links = [
    { href: '/admin', label: 'Дэшборд', icon: <IconHome /> },
    { href: '/admin/listings', label: 'Объявления', icon: <IconCards /> },
    { href: '/admin/inspections', label: 'Осмотры', icon: <IconCheck /> },
    { href: '/admin/users', label: 'Пользователи', icon: <IconUsers /> },
    { href: '/admin/admins', label: 'Администраторы', icon: <IconShield /> },
    { href: '/admin/notify', label: 'Уведомления', icon: <IconBell /> },
    { href: '/admin/stats', label: 'Статистика', icon: <IconChart /> },
  ];

  function isActive(href) {
    // Подсветка активного пункта: точное совпадение или родитель
    if (router.pathname === href) return true;
    if (href !== '/admin' && router.pathname.startsWith(href)) return true;
    if (href === '/admin' && router.pathname === '/admin/index') return true;
    return false;
  }

  return (
    <div style={{ background: UI.pageBg, minHeight: '100vh' }}>
      <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            gap: 16,
          }}
        >
          {/* Sidebar */}
          <aside
            style={{
              background: UI.menuBg,
              border: `1px solid ${UI.menuBorder}`,
              borderRadius: UI.radius,
              boxShadow: UI.shadow,
              padding: 14,
              height: 'fit-content',
              position: 'sticky',
              top: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${UI.border}`,
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-hidden
              >
                <IconShield size={18} />
              </div>
              <div style={{ fontWeight: 700 }}>Админ-панель</div>
            </div>

            <nav style={{ display: 'grid', gap: 6 }}>
              {links.map((l) => {
                const active = isActive(l.href);
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 12,
                      textDecoration: 'none',
                      color: UI.text,
                      border: `1px solid ${active ? UI.activeBorder : 'transparent'}`,
                      background: active ? UI.activeBg : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = UI.link)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = UI.text)}
                  >
                    <span aria-hidden>{l.icon}</span>
                    <span style={{ fontWeight: active ? 700 : 500 }}>{l.label}</span>
                  </a>
                );
              })}
            </nav>

            <div style={{ marginTop: 16, borderTop: `1px solid ${UI.border}`, paddingTop: 12, color: UI.muted, fontSize: 13 }}>
              {me ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconUser />
                  <span>{me.name || 'Администратор'}</span>
                </div>
              ) : (
                <div>Загрузка…</div>
              )}
            </div>
          </aside>

          {/* Content */}
          <main
            style={{
              background: UI.cardBg,
              border: `1px solid ${UI.border}`,
              borderRadius: UI.radius,
              boxShadow: UI.shadow,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                paddingBottom: 10,
                borderBottom: `1px solid ${UI.border}`,
              }}
            >
              <h1 style={{ margin: 0, fontSize: 20, lineHeight: '24px', color: UI.text }}>{title || 'Админ-панель'}</h1>
              <a
                href="/"
                style={{
                  fontSize: 14,
                  textDecoration: 'none',
                  color: UI.link,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = UI.linkHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = UI.link)}
              >
                ← На сайт
              </a>
            </div>

            <div style={{ color: UI.text }}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

/* ===== Иконки (минималистичные, под текущую палитру) ===== */
function IconHome({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 10L12 3l9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2v-9Z" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconCards({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke={color} strokeWidth="1.5" />
      <path d="M7 20h10" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconCheck({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 7 9 18l-5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M17 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-12 9c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconShield({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3 5 6v6c0 5 3.5 7.5 7 9 3.5-1.5 7-4 7-9V6l-7-3Z" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconBell({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" stroke={color} strokeWidth="1.5" />
      <path d="M10 21h4" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconChart({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V4M20 20H4M8 16v-6M12 20V8M16 20v-9" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
function IconUser({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" />
      <path d="M4 20c2-4 16-4 16 0" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
