// components/PhoneInput.jsx
import { useRef } from 'react';

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

// Преобразуем любое вводимое в формат "локальных" 10 цифр РФ
// Принимает: "8XXXXXXXXXX", "+7XXXXXXXXXX", "7XXXXXXXXXX", "9XXXXXXXXX" и т.д.
// Возвращает ровно 10 цифр (без +7), либо меньше, если пользователь ввёл ещё не все цифры.
export function toLocalRu10(input) {
  const d = digitsOnly(input);
  if (!d) return '';
  // Если скопировали полный номер с кодом страны или 8:
  if (d.length >= 11) {
    // "+7XXXXXXXXXX" или "7XXXXXXXXXX" => берём последние 10
    if (d.startsWith('7')) return d.slice(-10);
    // "8XXXXXXXXXX" => тоже срезаем ведущую 8
    if (d.startsWith('8')) return d.slice(-10);
  }
  // Если ровно 10 цифр (локальный формат) — ок
  if (d.length === 10) return d;
  // Если 1–9 цифр — пусть вводит дальше
  if (d.length < 10) return d;
  // Если 12+ (лишние) — берём последние 10
  return d.slice(-10);
}

// Форматирование для красоты: 999 123-45-67
function formatLocal(d10) {
  const d = digitsOnly(d10).slice(0, 10);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);
  let out = p1;
  if (p2) out += ' ' + p2;
  if (p3) out += '-' + p3;
  if (p4) out += '-' + p4;
  return out;
}

// В E.164 для бэка
export function toE164Ru(local10) {
  const d = digitsOnly(local10);
  if (d.length !== 10) return null; // неготово
  return '+7' + d;
}

export default function PhoneInput({ value, onChange, disabled, autoFocus }) {
  const inputRef = useRef(null);

  // value — это 10 локальных цифр (может быть меньше, пока вводят)
  const display = formatLocal(value);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#0B1220',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10,
      padding: '8px 10px',
      color: '#E6EDF3'
    }}>
      {/* Префикс +7 — «кнопка» */}
      <span
        onClick={() => inputRef.current?.focus()}
        title="+7 (Россия)"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8,
          padding: '6px 10px',
          fontWeight: 700,
          cursor: 'text',
          userSelect: 'none'
        }}
      >
        +7
      </span>

      {/* Поле для оставшихся 10 цифр */}
      <input
        ref={inputRef}
        value={display}
        onChange={(e) => onChange(toLocalRu10(e.target.value))}
        onPaste={(e) => {
          const text = (e.clipboardData || window.clipboardData).getData('text');
          const local = toLocalRu10(text);
          onChange(local);
          e.preventDefault();
        }}
        placeholder="999 123-45-67"
        inputMode="tel"
        autoFocus={autoFocus}
        disabled={disabled}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#E6EDF3',
          fontSize: 16
        }}
      />
    </div>
  );
}
