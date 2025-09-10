// frontend/components/Header.jsx
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';

const MAXW = 1100;

const UI = {
  topBg: '#1A1C20',
  topText: '#E6EDF3',
  topMuted: 'rgba(230,237,243,0.75)',
  border: 'rgba(255,255,255,0.10)',
  baseBg: 'transparent',
  inputBg: '#0B1220',
  inputText: '#E6EDF3',
  inputBorder: 'rgba(255,255,255,0.14)',
  pillBg: 'rgba(255,255,255,0.06)',
  blue: '#1E90FF',
  blueHover: '#1683ea',
  red: '#FF4D4F',
  yellow: '#FACC15',
};

export default function Header({ user }) {
  const router = useRouter();

  const [q, setQ] = useState('');
  const [notif, setNotif] = useState(0); // по умолчанию 0
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [width, setWidth] = useState(0);

  const acctRef = useRef(null);
  const notifRef = useRef(null);
  const moreRef = useRef(null);

  const displayName =
    (user?.fullName || user?.name || user?.username || user?.email || 'Профиль').toString();
  const initials = displayName.trim()[0]?.toUpperCase() || 'U';

  useEffect(() => {
    const update = () => setWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (acctRef.current && !acctRef.current.contains(e.target)) setAcctOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (moreRef.current && !moreRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function go(path) {
    router.push(path);
  }

  function submit(e) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/trades?q=${encodeURIComponent(query)}` : '/trades');
  }

  const isNarrow = width && width < 980;

  return (
    <header style={{ width: '100%' }}>
      {/* Верхняя шапка */}
      <div style={{ width: '100%', background: UI.topBg, borderBottom: `1px solid ${UI.border}` }}>
        <div
          style={{
            maxWidth: MAXW,
            margin: '0 auto',
            height: 44,
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            alignItems: 'center',
            gap: 12,
            padding: '0 12px',
          }}
        >
          <TopLeftNav
            isNarrow={isNarrow}
            onGo={go}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            moreRef={moreRef}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BalancePill onClick={() => go('/balance')} />

            <div ref={notifRef} style={{ position: 'relative' }}>
              <IconButton
                ariaLabel="Уведомления"
                onClick={() => setNotifOpen((o) => !o)}
                badge={notif}
              >
                <BellIcon />
              </IconButton>
              {notifOpen && (
                <Dropdown style={{ right: 0, minWidth: 280 }}>
                  <DropdownHeader title="Уведомления" />
                  <DropdownItem onClick={() => go('/notifications')}>
                    Новых уведомлений нет
                  </DropdownItem>
                </Dropdown>
              )}
            </div>

            <div ref={acctRef} style={{ position: 'relative' }}>
              <AccountButton
                onClick={() => setAcctOpen((o) => !o)}
                initials={initials}
                name={displayName}
              />
              {acctOpen && (
                <Dropdown style={{ right: 0, minWidth: 220 }}>
                  <DropdownHeader title={displayName} />
                  <DropdownItem onClick={() => go('/account')}>Личный кабинет</DropdownItem>
                  <DropdownItem onClick={() => go('/inspections')}>Мои осмотры</DropdownItem>
                  <DropdownItem onClick={() => go('/favorites')}>Избранное</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={() => go('/admin')}>Админ-панель</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={() => go('/logout')}>Выйти</DropdownItem>
                </Dropdown>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Нижняя шапка */}
      <div style={{ width: '100%', background: UI.baseBg }}>
        <div
          style={{
            maxWidth: MAXW,
            margin: '0 auto',
            height: 64,
            display: 'grid',
            gridTemplateColumns: 'auto 1fr', // убрали третью колонку
            alignItems: 'center',
            gap: 16,
            padding: '0 12px',
          }}
        >
          <Logo onClick={() => go('/')} />

          <form
            onSubmit={submit}
            style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10 }}
          >
            <button
              type="button"
              onClick={() => go('/trades')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 44,
                padding: '0 12px',
                borderRadius: 10,
                background: UI.pillBg,
                border: `1px solid ${UI.inputBorder}`,
                color: UI.topText,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <SearchSmallIcon />
              Все категории
              <ChevronDownIcon />
            </button>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по объявлениям"
              style={{
                height: 44,
                borderRadius: 10,
                padding: '0 12px',
                background: UI.inputBg,
                border: `1px solid ${UI.inputBorder}`,
                color: UI.inputText,
                minWidth: 200,
              }}
            />

            <button
              type="submit"
              style={{
                height: 44,
                padding: '0 16px',
                borderRadius: 10,
                background: UI.blue,
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = UI.blueHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = UI.blue)}
            >
              Найти
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

/* ─────────────── Остальные компоненты без изменений ─────────────── */

function TopLeftNav({ isNarrow, onGo, menuOpen, setMenuOpen, moreRef }) {
  const links = [
    { label: 'Админ-панель', href: '/admin' },
    { label: 'Торги', href: '/trades' },
    { label: 'Помощь', href: '/help' },
    { label: 'Мои осмотры', href: '/inspections' },
  ];

  const visible = isNarrow ? links.slice(0, 2) : links;
  const hidden = isNarrow ? links.slice(2) : [];

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 18, color: UI.topMuted, fontSize: 14 }}>
      {visible.map((l) => (
        <a key={l.href} onClick={() => onGo(l.href)} style={{ cursor: 'pointer' }}>
          {l.label}
        </a>
      ))}
      {hidden.length > 0 && (
        <div ref={moreRef} style={{ position: 'relative' }}>
          <a
            onClick={() => setMenuOpen((o) => !o)}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Ещё <ChevronDownIcon />
          </a>
          {menuOpen && (
            <Dropdown style={{ left: 0, minWidth: 180 }}>
              {hidden.map((l) => (
                <DropdownItem key={l.href} onClick={() => onGo(l.href)}>
                  {l.label}
                </DropdownItem>
              ))}
            </Dropdown>
          )}
        </div>
      )}
    </nav>
  );
}

function BalancePill({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: 10,
        background: UI.pillBg,
        border: `1px solid ${UI.border}`,
        color: UI.topText,
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Баланс: 0 ₽
    </button>
  );
}

function IconButton({ ariaLabel, onClick, children, badge }) {
  return (
    <button
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        position: 'relative',
        width: 34,
        height: 34,
        borderRadius: 10,
        background: UI.pillBg,
        border: `1px solid ${UI.border}`,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
      }}
    >
      {children}
      {badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            background: UI.red,
            color: '#fff',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 800,
            display: 'grid',
            placeItems: 'center',
            border: '2px solid ' + UI.topBg,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AccountButton({ onClick, initials, name }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: UI.pillBg,
        border: `1px solid ${UI.border}`,
        borderRadius: 999,
        padding: '4px 8px',
        color: UI.topText,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: UI.yellow,
          display: 'grid',
          placeItems: 'center',
          color: '#111',
          fontWeight: 800,
        }}
      >
        {initials}
      </span>
      <span
        style={{
          fontSize: 13,
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <ChevronDownIcon />
    </button>
  );
}

/* Dropdown, DropdownHeader, DropdownItem, DropdownDivider, Logo, Icons оставляем как в твоём файле */
