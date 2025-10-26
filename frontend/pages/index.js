// frontend/pages/index.js
import { useEffect, useMemo, useState } from "react";

import Hero from "../components/Hero";
import ListingCard from "../components/ListingCard";
import About from "../components/About";
import { formatTradeTypeLabel } from "../lib/tradeTypes";

import { useRouter } from "next/router";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");

const UI = {
  title: "var(--text-strong)",
  text: "var(--text-600)",
  cardBg: "var(--surface-1)",
  border: "var(--border)",
  red: "#EF4444",
  gradFrom: "#67e8f9",
  gradTo: "#3b82f6",
  button: "var(--accent)",
  buttonHover: "var(--accent-hover)",
  buttonText: "var(--text-on-accent)",
  chipBg: "rgba(42,101,247,0.12)",
  chipBorder: "rgba(42,101,247,0.24)",
};

function ShieldCheckIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3.25C12 3.25 5 4.75 5 8.75C5 13.685 8.136 18.054 12 19.75C15.864 18.054 19 13.685 19 8.75C19 4.75 12 3.25 12 3.25Z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.25 11.25L11 13L14.75 9.25"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HandshakeIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 10.75L7.42 6.33A2.6 2.6 0 019.26 5.5h2.1a2.6 2.6 0 011.84.76l1.54 1.54a2.1 2.1 0 002.97 0l.73-.73a2.1 2.1 0 012.97 0L21 10.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 14.5l2.86 2.86a2.6 2.6 0 003.68 0L21 10.4"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 12.75L11.25 15.25"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 11.5l2.7 2.7"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.25 10.25l2.4 2.4"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 3L13.5 7.5L18 9L13.5 10.5L12 15L10.5 10.5L6 9L10.5 7.5L12 3Z"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 15.5L7.25 17.75L9.5 18.5L7.25 19.25L6.5 21.5L5.75 19.25L3.5 18.5L5.75 17.75L6.5 15.5Z"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 13.5L17 15L18.5 15.5L17 16L16.5 17.5L16 16L14.5 15.5L16 15L16.5 13.5Z"
        stroke="white"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const fmtNumber = new Intl.NumberFormat("ru-RU");
const fmtCurrency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function api(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function FirstLoginModal() {
  return null;
}

function StatCard({ title, value, Icon, isCurrency, loading }) {
  const display = loading
    ? "—"
    : isCurrency
    ? fmtCurrency.format(value || 0)
    : fmtNumber.format(value || 0);

  return (
    <div
      style={{
        background: UI.cardBg,
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 12,
        alignItems: "center",
        minHeight: 88,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon />
      </div>
      <div>
        <div style={{ color: UI.text, fontSize: 13 }}>{title}</div>
        <div
          style={{
            color: UI.title,
            fontWeight: 800,
            fontSize: 18,
            marginTop: 2,
          }}
        >
          {display}
        </div>
      </div>
    </div>
  );
}

function RegionBubbleMap({ regions, activeRegion }) {
  if (!regions.length) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "1527 / 768",
          borderRadius: 16,
          border: `1px solid ${UI.border}`,
          background: UI.cardBg,
          display: "grid",
          placeItems: "center",
          color: UI.text,
        }}
      >
        Данные по регионам появятся позже
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 16,
        border: `1px solid ${UI.border}`,
        overflow: "hidden",
        background: UI.cardBg,
        backgroundImage: "url(/maps/russia-fo.svg)",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        aspectRatio: "1527 / 768",
      }}
    >
      {activeRegion ? (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            right: 16,
            background: "rgba(255,255,255,0.92)",
            borderRadius: 12,
            padding: "12px 14px",
            border: `1px solid ${UI.border}`,
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: UI.title }}>
            {activeRegion.region}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 13,
              color: UI.text,
            }}
          >
            <span>
              Лотов:{" "}
              <strong style={{ color: UI.title }}>
                {fmtNumber.format(activeRegion.listings || 0)}
              </strong>
            </span>
            <span>
              Сумма:{" "}
              <strong style={{ color: UI.title }}>
                {fmtCurrency.format(activeRegion.totalValue || 0)}
              </strong>
            </span>
            <span>
              Средняя цена:{" "}
              <strong style={{ color: UI.title }}>
                {fmtCurrency.format(activeRegion.averagePrice || 0)}
              </strong>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RegionList({ regions, activeRegion, onHover, onSelect }) {
  const [query, setQuery] = useState("");
  const filteredRegions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return regions;
    return regions.filter((region) => {
      const name = (region.region || "").toLowerCase();
      return name.includes(trimmed);
    });
  }, [regions, query]);

  if (!regions.length) return null;
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${UI.border}`,
        background: UI.cardBg,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: 480,
      }}
    >
      <div>
        <label style={{ display: "block" }}>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: UI.text,
              marginBottom: 4,
            }}
          >
            Поиск региона
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Введите название региона"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${UI.border}`,
              background: "var(--surface-1)",
              color: UI.title,
              fontSize: 14,
            }}
          />
        </label>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 4,
        }}
      >
        {filteredRegions.length === 0 ? (
          <div
            style={{
              padding: "16px 12px",
              color: UI.text,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Регион не найден
          </div>
        ) : null}

        {filteredRegions.map((region) => {
          const isActive = activeRegion?.region === region.region;
          const hasListings = (region.listings || 0) > 0;
          const title = region.region || "Регион не указан";
          const key = `${region.region_code || 'no-code'}-${title}`;
          return (
            <button
              key={key}
              type="button"
              onMouseEnter={() => onHover(region)}
              onFocus={() => onHover(region)}
              onClick={() => {
                if (onSelect) onSelect(region);
              }}
              aria-label={title}
              style={{
                border: `1px solid ${isActive
                  ? "var(--accent)"
                  : hasListings
                  ? UI.border
                  : "rgba(148,163,184,0.4)"}`,
                background: isActive
                  ? "rgba(42,101,247,0.12)"
                  : "rgba(148,163,184,0.04)",
                color: isActive
                  ? "var(--accent)"
                  : hasListings
                  ? UI.title
                  : UI.text,
                padding: "12px 16px",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 6,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
              <span
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  fontSize: 12,
                  color: isActive ? "var(--accent)" : UI.text,
                }}
              >
                <span>
                  Лотов:{" "}
                  <strong style={{ color: UI.title }}>
                    {fmtNumber.format(region.listings || 0)}
                  </strong>
                </span>
                <span>
                  Сумма:{" "}
                  <strong style={{ color: UI.title }}>
                    {fmtCurrency.format(region.totalValue || 0)}
                  </strong>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}


function BestOffersCarousel({ items }) {
  const cardWidth = 280;
  const gap = 16;
  const [index, setIndex] = useState(0);

  const visible = Math.min(items.length, 3);
  const maxIndex = Math.max(0, items.length - visible);

  useEffect(() => {
    if (index > maxIndex) setIndex(maxIndex);
  }, [index, maxIndex]);

  if (!items.length) {
    return null;
  }

  const trackWidth = items.length * (cardWidth + gap);
  const offset = index * (cardWidth + gap);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, color: UI.title }}>Лучшие предложения</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            style={navButtonStyle(index === 0)}
            aria-label="Предыдущие предложения"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
            disabled={index >= maxIndex}
            style={navButtonStyle(index >= maxIndex)}
            aria-label="Следующие предложения"
          >
            →
          </button>
        </div>
      </div>

      <div
        style={{
          overflow: "hidden",
          borderRadius: 16,
          border: `1px solid ${UI.border}`,
          padding: "12px 8px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: `${gap}px`,
            width: trackWidth,
            transform: `translateX(-${offset}px)`,
            transition: "transform 0.35s ease",
          }}
        >
          {items.map((item) => (
            <BestOfferCard key={item.id} item={item} width={cardWidth} />
          ))}
        </div>
      </div>
    </div>
  );
}

function navButtonStyle(disabled) {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: `1px solid ${UI.border}`,
    background: disabled ? "rgba(42,101,247,0.08)" : "rgba(42,101,247,0.15)",
    color: "var(--accent)",
    cursor: disabled ? "default" : "pointer",
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
  };
}

function resolveCover(listing) {
  const photos = Array.isArray(listing?.photos)
    ? listing.photos
    : listing?.details?.photos;
  if (Array.isArray(photos)) {
    for (const photo of photos) {
      if (photo && typeof photo === "object" && photo.url) return photo.url;
      if (typeof photo === "string" && photo.trim()) return photo.trim();
    }
  }
  return null;
}

function formatPrice(value, currency = "RUB") {
  if (value == null) return "Цена уточняется";
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function BestOfferCard({ item, width }) {
  const cover = resolveCover(item);
  const price = formatPrice(
    item.current_price ?? item.start_price,
    item.currency || "RUB"
  );
  const location = [item.city, item.region].filter(Boolean).join(", ");
  const tradeType =
    item.trade_type_label ||
    formatTradeTypeLabel(item.trade_type_resolved ?? item.trade_type) ||
    "Лот";

  return (
    <article
      style={{
        width: width,
        minWidth: width,
        borderRadius: 14,
        border: `1px solid ${UI.border}`,
        background: UI.cardBg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          paddingBottom: "56%",
          background: "var(--surface-3)",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt={item.title || "Лот"}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: UI.text,
            }}
          >
            Нет фото
          </div>
        )}
        <span
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            background: UI.chipBg,
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            border: `1px solid ${UI.chipBorder}`,
          }}
        >
          {tradeType}
        </span>
      </div>
      <div
        style={{
          padding: "14px 16px",
          display: "grid",
          gap: 8,
          flex: "1 1 auto",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: UI.title }}>
          {item.title || "Лот"}
        </div>
        {location ? (
          <div style={{ fontSize: 13, color: UI.text }}>{location}</div>
        ) : null}
        <div style={{ fontWeight: 700, fontSize: 16, color: UI.title }}>
          {price}
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 8 }}>
          <a
            href={`/trades/${item.id}`}
            style={{
              flex: 1,
              background: UI.button,
              color: UI.buttonText,
              borderRadius: 10,
              textAlign: "center",
              padding: "8px 10px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Подробнее
          </a>
          {item.source_url ? (
            <a
              href={item.source_url}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                border: `1px solid ${UI.border}`,
                borderRadius: 10,
                textAlign: "center",
                padding: "8px 10px",
                color: UI.title,
                textDecoration: "none",
              }}
            >
              Источник
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EducationFeature({ title, Icon }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 12,
        alignItems: "center",
        background: UI.cardBg,
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        padding: 14,
        minHeight: 88,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icon />
      </div>
      <div style={{ color: UI.title, fontSize: 15.5, fontWeight: 600 }}>
        {title}
      </div>
    </div>
  );
}

/* Иконки (градиент как в Hero) — единичные определения */
function UsersIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke="var(--blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke="var(--blue)"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroDoc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <path
        d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"
        stroke="var(--blue)"
        strokeWidth="1.8"
      />
      <path d="M14 3v6h6" stroke="var(--blue)" strokeWidth="1.8" />
      <path
        d="M9 13h8M9 17h8"
        stroke="var(--blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AuctionsIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 10l6-6 4 4-6 6-4-4zM3 21h10"
        stroke="var(--blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Купюра — для "Стоимость имущества в торгах"
function BanknoteIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gradHeroNote" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={UI.gradFrom} />
          <stop offset="100%" stopColor={UI.gradTo} />
        </linearGradient>
      </defs>
      <rect
        x="3"
        y="7"
        width="18"
        height="10"
        rx="2"
        stroke="var(--blue)"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="2.5" stroke="var(--blue)" strokeWidth="1.8" />
      <path
        d="M5 9h2M17 9h2M5 15h2M17 15h2"
        stroke="var(--blue)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* Естественные цвета иконок */
function LightningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"
        stroke="#FACC15"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function InstallmentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="12"
        height="8"
        rx="2"
        stroke="#22C55E"
        strokeWidth="1.8"
      />
      <path
        d="M5 9h8M5 12h3"
        stroke="#22C55E"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="16"
        y="9"
        width="5"
        height="7"
        rx="1.5"
        stroke="#22C55E"
        strokeWidth="1.8"
      />
      <path d="M16 11h5" stroke="#22C55E" strokeWidth="1.8" />
    </svg>
  );
}
function CarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 13l2-4c.5-1 1.5-2 3-2h6c1.5 0 2.5 1 3 2l2 4v3a2 2 0 01-2 2h-1a2 2 0 01-2-2H8a2 2 0 01-2 2H5a2 2 0 01-2-2v-3z"
        stroke="#60A5FA"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="16" r="2" stroke="#60A5FA" strokeWidth="1.8" />
      <circle cx="16" cy="16" r="2" stroke="#60A5FA" strokeWidth="1.8" />
    </svg>
  );
}

export default function Home() {
  const [summary, setSummary] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [activeRegion, setActiveRegion] = useState(null);

  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [errorRecent, setErrorRecent] = useState(null);

  const [inspectionsUnread, setInspectionsUnread] = useState(0);
  const [tradeUnread, setTradeUnread] = useState(0);
  const router = useRouter();


  const trustHighlights = [
    {
      title: "Экспертиза команды",
      description:
        "Наши аналитики и юристы ежедневно проверяют десятки торгов, отбирая только прозрачные и безопасные сделки.",
      Icon: ShieldCheckIcon,
    },
    {
      title: "Честные партнерства",
      description:
        "Мы выстраиваем прямые отношения с банками, дилерами и организаторами, поэтому пользователи получают актуальную информацию первыми.",
      Icon: HandshakeIcon,
    },
    {
      title: "Забота о каждом клиенте",
      description:
        "Персональные рекомендации, напоминания о важных этапах и поддержка в чатах помогают уверенно пройти путь до сделки.",
      Icon: SparkleIcon,
    },
  ];

  const trustMetrics = [
    {
      label: "4.9/5",
      caption: "оценка пользователей",
    },
    {
      label: "12 000+",
      caption: "успешных сделок за последний год",
    },
    {
      label: "От 10 минут до 1 часа",
      caption: "среднее время ответа эксперта",
    },
  ];

  
  // токен авторизации и локальное состояние избранного
  const [authToken, setAuthToken] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  // читаем токен из localStorage и следим за изменением
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("token");
    if (stored) setAuthToken(stored);

    const handler = (event) => {
      if (event.key === "token") {
        setAuthToken(event.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let ignore = false;

    async function loadUnread() {
      const token = authToken || localStorage.getItem("token");
      if (!token) {
        if (!ignore) setInspectionsUnread(0);
        return;
      }
      try {
        const res = await fetch(api("/api/inspections/unread-count"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          if (!ignore) setInspectionsUnread(0);
          return;
        }
        if (!res.ok) throw new Error("status " + res.status);
        const data = await res.json();
        if (!ignore) setInspectionsUnread(Number(data?.count) || 0);
      } catch (err) {
        if (!ignore) setInspectionsUnread(0);
        console.error("Failed to load inspections unread count", err);
      }
    }

    loadUnread();
    const handler = () => loadUnread();
    const interval = setInterval(loadUnread, 60000);
    window.addEventListener("inspections-refresh-count", handler);

    return () => {
      ignore = true;
      clearInterval(interval);
      window.removeEventListener("inspections-refresh-count", handler);
    };
  }, [authToken]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let ignore = false;

    async function loadUnread() {
      const token = authToken || localStorage.getItem("token");
      if (!token) {
        if (!ignore) setTradeUnread(0);
        return;
      }
      try {
        const res = await fetch(api("/api/trade-orders/unread-count"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          if (!ignore) setTradeUnread(0);
          return;
        }
        if (!res.ok) throw new Error("status " + res.status);
        const data = await res.json();
        if (!ignore) setTradeUnread(Number(data?.count) || 0);
      } catch (err) {
        if (!ignore) setTradeUnread(0);
        console.error("Failed to load trade orders unread count", err);
      }
    }

    loadUnread();
    const handler = () => loadUnread();
    const interval = setInterval(loadUnread, 60000);
    window.addEventListener("trade-orders-refresh-count", handler);

    return () => {
      ignore = true;
      clearInterval(interval);
      window.removeEventListener("trade-orders-refresh-count", handler);
    };
  }, [authToken]);

  // переключение избранного (как в /trades)
  async function toggleFav(listing) {
    const listingId = String(listing.id ?? listing.listing_id ?? listing._id);

    if (!authToken) {
      const next = `/login?next=${encodeURIComponent(router.asPath || "/")}`;
      router.push(next);
      return;
    }

    const isFav = favoriteSet.has(listingId);
    try {
      const res = await fetch(api(`/api/favorites/${listingId}`), {
        method: isFav ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        if (typeof window !== "undefined") localStorage.removeItem("token");
        setAuthToken(null);
        return;
      }
      if (!res.ok) throw new Error("failed");

      setFavoriteIds((prev) => {
        if (isFav) return prev.filter((id) => id !== listingId);
        if (prev.includes(listingId)) return prev;
        return [...prev, listingId];
      });
    } catch (err) {
      console.error("Failed to toggle favorite", err);
      alert("Не удалось обновить избранное. Попробуйте позже.");
    }
    }

  function handleRegionSelect(region) {
    if (!region) return;
    setActiveRegion(region);
    const query = {};
    const code = region.region_code || region.regionCode;
    if (code) {
      query.region_code = code;
    } else if (region.region) {
      query.region = region.region;
    }
    router.push({ pathname: "/trades", query });
  }

  useEffect(() => {
    let ignore = false;
    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const data = await fetch(api("/api/stats/summary")).then((r) => {
          if (!r.ok) throw new Error("summary");
          return r.json();
        });
              if (!ignore) {
          setSummary(data);
          const preferredRegion = Array.isArray(data?.regions)
            ? data.regions.find((region) => (region?.listings || 0) > 0) || data.regions[0] || null
            : null;
          setActiveRegion(preferredRegion);
        }
      } catch (e) {
        console.error("Failed to load summary stats", e);
        if (!ignore) setSummary(null);
      } finally {
        if (!ignore) setLoadingSummary(false);
      }
    }
    loadSummary();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadFeatured() {
      try {
        setLoadingFeatured(true);
        const data = await fetch(api("/api/listings/featured?limit=12")).then(
          (r) => {
            if (!r.ok) throw new Error("featured");
            return r.json();
          }
        );
        if (!ignore) setFeatured(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        console.error("Failed to load featured listings", e);
        if (!ignore) setFeatured([]);
      } finally {
        if (!ignore) setLoadingFeatured(false);
      }
    }
    loadFeatured();
    return () => {
      ignore = true;
    };
  }, []);
  // Загружаем ПЕРВЫЕ 6 объявлений как на /trades (published=true, сортировка как в API)
  useEffect(() => {
    let ignore = false;
    async function loadRecent() {
      try {
        setLoadingRecent(true);
        setErrorRecent(null);

        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "6");
        params.set("published", "true");

        const url = api(`/api/listings?${params.toString()}`);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`recent ${res.status}`);
        const data = await res.json();

        if (!ignore) {
          setRecent(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        console.error("Failed to load recent listings", e);
        if (!ignore) {
          setRecent([]);
          setErrorRecent("Не удалось загрузить новые предложения.");
        }
      } finally {
        if (!ignore) setLoadingRecent(false);
      }
    }
    loadRecent();
    return () => {
      ignore = true;
    };
  }, []);

  const statsCards = useMemo(
    () => [
      {
        title: "Пользователей",
        value: summary?.totalUsers ?? 0,
        Icon: UsersIcon,
        isCurrency: false,
      },
      {
        title: "Публичные предложения",
        value: summary?.offersCount ?? 0,
        Icon: DocumentIcon,
        isCurrency: false,
      },
      {
        title: "Открытых аукционов",
        value: summary?.auctionsCount ?? 0,
        Icon: AuctionsIcon,
        isCurrency: false,
      },
      {
        title: "Стоимость имущества",
        value: summary?.totalValue ?? 0,
        Icon: BanknoteIcon,
        isCurrency: true,
      },
    ],
    [summary]
  );

  const regions = useMemo(() => summary?.regions || [], [summary]);

  return (
    <>
      <Hero
        listingCount={summary?.totalListings ?? 0}
        inspectionsUnread={inspectionsUnread}
        tradeOrdersUnread={tradeUnread}
      />
      {/* === НОВЫЕ ПРЕДЛОЖЕНИЯ (первые 6 как на /trades) === */}
      {(recent.length || loadingRecent) && (
        <section style={{ margin: "32px 0" }}>
          <div className="container">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <h2
                style={{
                  color: "var(--text-1000)",
                  fontSize: 22,
                  fontWeight: 800,
                  margin: 0,
                }}
              >
                Новые предложения
              </h2>
              <a
                href="/trades"
                className="button"
                style={{
                  textDecoration: "none",
                  background: "var(--blue)",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "9px 14px",
                  fontWeight: 700,
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.15)";
                  e.currentTarget.style.background = "#1e53d6";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.background = "var(--blue)";
                }}
              >
                Смотреть все →
              </a>
            </div>

            {errorRecent ? (
              <div className="panel" style={{ color: "var(--text-700)" }}>
                {errorRecent}
              </div>
            ) : (
              <>
                {loadingRecent ? (
                  <div className="panel" style={{ color: "var(--text-700)" }}>
                    Загружаем…
                  </div>
                ) : recent.length ? (
                  <div className="recent-grid">
                    {recent.map((l) => {
                      const listingId = String(l.id ?? l.listing_id ?? l._id);
                      return (
                        <ListingCard
                          key={listingId}
                          l={l}
                          fav={favoriteSet.has(listingId)}
                          onFav={() => toggleFav(l)}
                          detailHref={`/trades/${listingId}`}
                          sourceHref={l.source_url}
                          variant="compact"
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="panel" style={{ color: "var(--text-700)" }}>
                    Предложения скоро появятся
                  </div>
                )}
                <style jsx>{`
                  .recent-grid {
                    display: grid;
                    gap: 16px;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                  }

                  @media (max-width: 1100px) {
                    .recent-grid {
                      grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                  }

                  @media (max-width: 720px) {
                    .recent-grid {
                      grid-template-columns: minmax(0, 1fr);
                    }
                  }
                `}</style>
              </>
            )}
          </div>
        </section>
      )}

      <About />

      <div className="container">
        <FirstLoginModal />

        {/* === ОБУЧЕНИЕ — СТАВИМ ВЫШЕ === */}
        <section style={{ margin: "32px 0" }}>
         <div
            style={{
              background: "var(--page-mid)",
              border: "none",
              borderRadius: 16,
              padding: 18,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 18,
              alignItems: "center",
              boxShadow: "0 6px 22px rgba(17,24,39,0.06)",
            }}
          >
            {/* Левая картинка — рамка как в Hero */}
            <div
              style={{
                width: 180,
                height: 180,
                display: "grid",
                placeItems: "center",
                overflow: "hidden",
                background: "transparent",
              }}
            >
              <img
                src="/education/group.png"
                alt="Иконка обучения"
                style={{
                  width: "86%",
                  height: "86%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  margin: "0 0 6px",
                  color: "#000",
                  fontWeight: 800,
                }}
              >
                Обучение для покупателей авто с торгов
              </h2>

              <p
                style={{
                  margin: "0 auto 14px",
                  color: "var(--text-600)",
                  lineHeight: 1.65,
                  maxWidth: 760,
                }}
              >
                Разбираем стратегию поиска и анализа лотов, оценку рисков и
                юридические нюансы сделки. Практика на реальных кейсах и
                инструкции, с которыми вы уверенно проходите путь от идеи до
                покупки.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
                  gap: 12,
                  marginBottom: 14,
                  textAlign: "left",
                }}
              >
                <EducationFeature
                  title="Быстрое и эффективное обучение"
                  Icon={LightningIcon}
                />
                <EducationFeature
                  title="Оплата обучения частями"
                  Icon={InstallmentIcon}
                />
                <EducationFeature
                  title="Доступ в закрытые чаты продавцов авто"
                  Icon={CarIcon}
                />
              </div>

              <a
                href="/education"
                role="button"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "var(--blue)",
                  color: "#fff",
                  fontWeight: 700,
                  textDecoration: "none",
                  border: "1px solid var(--blue)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 12px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                Узнать больше
              </a>
            </div>
          </div>
        </section>

        {/* === СТАТИСТИКА ПЛАТФОРМЫ — НИЖЕ === */}
               <section style={{ margin: "32px 0" }}>
          <div
            style={{
              background: "var(--page-mid)",
              border: "none",
              borderRadius: 16,
              padding: 18,
              display: "grid",
              gap: 18,
              boxShadow: "0 6px 22px rgba(17,24,39,0.06)",
            }}
          >
            <h2
              style={{
                margin: "0 0 12px",
                textAlign: "center",
                fontWeight: 900,
                fontSize: 22,
                color: "#000",
              }}
            >
              Статистика платформы
            </h2>

            {/* дальше — как у тебя: сетка StatCard и блок карты/списка */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {statsCards.map((card) => (
                <StatCard key={card.title} {...card} loading={loadingSummary} />
              ))}
            </div>

           <div
              style={{
                display: "grid",
                gap: 18,
                alignItems: "stretch",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              }}
            >
              <RegionBubbleMap regions={regions} activeRegion={activeRegion} />
              <RegionList
                regions={regions}
                activeRegion={activeRegion}
                onHover={setActiveRegion}
                onSelect={handleRegionSelect}
              />
            </div>
          </div>
        </section>

        <section style={{ margin: "32px 0" }}>
          <div
            style={{
              borderRadius: 16,
              padding: "28px 24px",
              background: "var(--page-mid)",
              border: "none",
              boxShadow: "0 6px 22px rgba(17,24,39,0.06)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 12,
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  padding: "6px 14px",
                  borderRadius: 999,
                  background: "rgba(59, 130, 246, 0.12)",
                  color: "#1d4ed8",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: 0.3,
                }}
              >
                Команда, которой доверяют покупатели
              </span>
              <h2
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#0f172a",
                }}
              >
                Почему нам доверяют
              </h2>
              <p
                style={{
                  margin: "0 auto",
                  maxWidth: 720,
                  lineHeight: 1.7,
                  color: "#1e293b",
                  fontSize: 16,
                }}
              >
                Мы объединили глубокую экспертизу команды, проверенные процессы и
                открытое общение, чтобы вы чувствовали поддержку на каждом
                этапе покупки авто с торгов.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                marginBottom: 28,
              }}
            >
              {trustHighlights.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  style={{
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(148, 163, 184, 0.24)",
                    padding: "20px 18px",
                    textAlign: "left",
                    display: "grid",
                    gap: 12,
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.transform = "translateY(-4px)";
                    event.currentTarget.style.boxShadow =
                      "0 18px 30px -24px rgba(15, 23, 42, 0.55)";
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "translateY(0)";
                    event.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 16,
                      background: "linear-gradient(135deg,#2563eb,#38bdf8)",
                      display: "grid",
                      placeItems: "center",
                      boxShadow: "0 12px 20px -12px rgba(37, 99, 235, 0.6)",
                    }}
                  >
                    <Icon size={28} />
                  </div>
                  <div>
                    <h3
                      style={{
                        margin: "0 0 8px",
                        fontSize: 17,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.6,
                        color: "#1e293b",
                        fontSize: 14.5,
                      }}
                    >
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
                          {trustMetrics.map((metric) => (
                <div
                  key={metric.label}
                  style={{
                    borderRadius: 14,
                    padding: "16px 18px",
                    background: "rgba(15, 23, 42, 0.85)",
                    color: "#ffffff",
                    textAlign: "center",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <span
                    style={{ fontSize: 22, fontWeight: 800, color: "#ffffff" }}
                  >
                    {metric.label}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255, 255, 255, 0.75)",
                    }}
                  >
                    {metric.caption}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        {/* === ЛУЧШИЕ ПРЕДЛОЖЕНИЯ — ОСТАВЛЯЕМ ПОСЛЕ СТАТИСТИКИ === */}
        {(featured.length || loadingFeatured) && (
          <section style={{ margin: "32px 0" }}>
            {loadingFeatured && !featured.length ? (
              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${UI.border}`,
                  padding: "40px 16px",
                  textAlign: "center",
                  color: UI.text,
                }}
              >
                Загружаем интересные объявления…
              </div>
            ) : (
              <BestOffersCarousel items={featured} />
            )}
          </section>
        )}
      </div>
    </>
  );
}





















