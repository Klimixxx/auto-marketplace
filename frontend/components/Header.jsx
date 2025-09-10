// frontend/components/Header.jsx
// Двухэтажная шапка "в стиле Авито": верхний чёрный бар + нижний с логотипом и поиском.
// Контент аккуратно центрирован по maxWidth, симметрия сохранена.
// Адаптив: на узких экранах сворачиваем левое меню ("Для бизнеса" и т.п.) под "Ещё".
// Никаких внешних библиотек — чистый React + inline-стили. Работает в Next (pages/).

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';

const MAXW = 1100;

const UI = {
  // Верхняя панель
  topBg: '#1A1C20',        // мягкий чёрный
  topText: '#E6EDF3',
  topMuted: 'rgba(230,237,243,0.75)',
  border: 'rgba(255,255,255,0.10)',

  // Нижняя панель / элементы
  baseBg: 'transparent',
  inputBg: '#0B1220',
  inputText: '#E6EDF3',
  inputBorder: 'rgba(255,255,255,0.14)',
  pillBg: 'rgba(255,255,255,0.06)',

  // Акценты
  blue: '#1E90FF',
  blueHover: '#1683ea',
  red: '#FF4D4F',
  yellow: '#FACC15',
};

export default function Header() {
  const router = useRouter();

  // state
  const [q, setQ] = useState('');
  const [notif, setNotif] = useState(5);   // заглушка количества уведомлений
  const [menuOpen, setMenuOpen] = useState(false); // раскрытие "Ещё" на верхнем баре
  const [acctOpen, setAcctOpen] = useState(false); // меню аккаунта
  const [notifOpen, setNotifOpen] = useState(false);// меню уведомлений
  const [width, setWidth] = useState(0);   // для простого адаптива

  const acctRef = useRef(null);
  const notifRef = useRef(null);
  const moreRef = useRef(null);

  useEffect(() => {
    // трекаем ширину для условной отрисовки частей меню
    const update = () => setWidth(typeof window !== 'undefined' ? window.innerWidth : 0);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // клик вне меню — закрыть
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
        <div style={{
          maxWidth: MAXW,
          margin: '0 auto',
          height: 44,
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 12,
          padding: '0 12px'
        }}>
          {/* Лево: ссылки */}
          <TopLeftNav isNarrow={isNarrow} onGo={go} menuOpen={menuOpen} setMenuOpen={setMenuOpen} moreRef={moreRef} />

          {/* Право: баланс / уведомления / аккаунт */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BalancePill onClick={() => go('/balance')} />

            <div ref={notifRef} style={{ position: 'relative' }}>
              <IconButton
                ariaLabel="Уведомления"
                onClick={() => setNotifOpen(o => !o)}
                badge={notif}
              >
                <BellIcon />
              </IconButton>
              {notifOpen && (
                <Dropdown style={{ right: 0, minWidth: 280 }}>
                  <DropdownHeader title="Уведомления" />
                  <DropdownItem onClick={() => go('/notifications')}>5 новых: изменения по торгам</DropdownItem>
                  <DropdownItem onClick={() => go('/notifications')}>Новый ответ на вопрос</DropdownItem>
                  <DropdownDivider />
                  <DropdownItem onClick={() => go('/notifications')}>Открыть все уведомления</DropdownItem>
                </Dropdown>
              )}
            </div>

            <div ref={acctRef} style={{ position: 'relative' }}>
              <AccountButton onClick={() => setAcctOpen(o => !o)} />
              {acctOpen && (
                <Dropdown style={{ right: 0, minWidth: 220 }}>
                  <DropdownHeader title="Timofey" />
                  <DropdownItem onClick={() => go('/profile')}>Профиль</DropdownItem>
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
        <div style={{
          maxWidth: MAXW,
          margin: '0 auto',
          height: 64,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 16,
          padding: '0 12px'
        }}>
          {/* Лого */}
          <Logo onClick={() => go('/')} />

          {/* Поиск */}
          <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10 }}>
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
                whiteSpace: 'nowrap'
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
                minWidth: 200
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
                border: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = UI.blueHover}
              onMouseLeave={(e) => e.currentTarget.style.background = UI.blue}
            >
              Найти
            </button>
          </form>

          {/* Справа (опционально): Город или кнопка "Разместить объявление" */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => go('/new')}
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                background: UI.blue,
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
                border: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = UI.blueHover}
              onMouseLeave={(e) => e.currentTarget.style.background = UI.blue}
            >
              Разместить объявление
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────── Компоненты верхнего бара ───────────────────────── */

function TopLeftNav({ isNarrow, onGo, menuOpen, setMenuOpen, moreRef }) {
  // основной ряд ссылок
  const links = [
    { label: 'Админ-панель', href: '/admin' },
    { label: 'Торги', href: '/trades' },
    { label: 'Помощь', href: '/help' },
    { label: 'Мои осмотры', href: '/inspections' },
  ];

  // В узком режиме показываем первые 2 + "Ещё"
  const visible = isNarrow ? links.slice(0, 2) : links;
  const hidden = isNarrow ? links.slice(2) : [];

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 18, color: UI.topMuted, fontSize: 14 }}>
      {visible.map((l) => (
        <a key={l.href} onClick={() => onGo(l.href)} style={{ cursor: 'pointer' }}>{l.label}</a>
      ))}
      {hidden.length > 0 && (
        <div ref={moreRef} style={{ position: 'relative' }}>
          <a onClick={() => setMenuOpen(o => !o)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Ещё <ChevronDownIcon />
          </a>
          {menuOpen && (
            <Dropdown style={{ left: 0, minWidth: 180 }}>
              {hidden.map((l) => (
                <DropdownItem key={l.href} onClick={() => onGo(l.href)}>{l.label}</DropdownItem>
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
        cursor: 'pointer'
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
        cursor: 'pointer'
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
            border: '2px solid ' + UI.topBg
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AccountButton({ onClick }) {
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
        cursor: 'pointer'
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
          fontWeight: 800
        }}
      >
        T
      </span>
      <span style={{ fontSize: 13 }}>Timofey</span>
      <ChevronDownIcon />
    </button>
  );
}

/* ─────────────────────────── Вспомогательные UI ──────────────────────────── */

function Dropdown({ children, style }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        ...style,
        background: '#0F172A',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 12,
        padding: 8,
        boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
        zIndex: 50
      }}
    >
      {children}
    </div>
  );
}

function DropdownHeader({ title }) {
  return (
    <div style={{ padding: '8px 10px', color: '#cbd5e1', fontSize: 12, textTransform: 'uppercase', letterSpacing: .5 }}>
      {title}
    </div>
  );
}

function DropdownItem({ children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        color: '#E6EDF3',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {children}
    </div>
  );
}

function DropdownDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 4px' }} />;
}

/* ─────────────────────────────── Логотип ────────────────────────────────── */

function Logo({ onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {/* Если есть /logo.svg, можно заменить на Image */}
      {/* <Image src="/logo.svg" width={28} height={28} alt="Logo" /> */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'linear-gradient(135deg,#22C55E 0%,#10B981 100%)',
          display: 'grid',
          placeItems: 'center',
          color: '#0B1220',
          fontWeight: 900,
          fontSize: 14
        }}
      >
        A
      </div>
      <div style={{ color: '#fff', fontWeight: 900, letterSpacing: 0.3 }}>
        AuctionA<span style={{ color: '#EF4444' }}>f</span>to
      </div>
    </div>
  );
}

/* ─────────────────────────────── Иконки ─────────────────────────────────── */

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 17h14l-2-3v-4a5 5 0 10-10 0v4l-2 3Z" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 20a2.5 2.5 0 005 0" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="#E6EDF3" strokeWidth="1.6" />
      <path d="M20 20L17 17" stroke="#E6EDF3" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="#E6EDF3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
