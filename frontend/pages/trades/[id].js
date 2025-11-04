import Link from "next/link";
import { useEffect, useState } from "react";
import TradeOrderModal from "../../components/TradeOrderModal";
import InspectionModal from "../../components/InspectionModal";
import AutotekaModal from "../../components/AutotekaModal";
import {
  formatValueForDisplay,
  translateFieldKey,
  translateValueByKey,
} from "../../lib/lotFormatting";
import { formatTradeTypeLabel, normalizeTradeTypeCode } from "../../lib/tradeTypes";
import computeTradeTiming from "../../lib/tradeTiming";

const API = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || "";

function buildApiUrl(pathname = "") {
  const base = typeof API === "string" && API ? API.replace(/\/$/, "") : "";
  if (!pathname) return base || "/";
  if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
    return pathname;
  }
  if (pathname.startsWith("/")) return `${base}${pathname}`;
  return `${base}/${pathname}`;
}

function parseViewCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric);
}

function EyeIcon({ size = 18, color = "#475569" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2.25 12s3.75-6 9.75-6 9.75 6 9.75 6-3.75 6-9.75 6-9.75-6-9.75-6Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3.5"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="1.5" fill={color} />
    </svg>
  );
}

function ViewCounter({ count }) {
  const safeCount = parseViewCount(count);
  const label = safeCount.toLocaleString("ru-RU");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        color: "#475569",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <EyeIcon />
      <span>{label}</span>
    </div>
  );
}

const VEHICLE_LABELS = new Set(
  [
    "марка",
    "модель",
    "поколение",
    "модификация",
    "год выпуска",
    "пробег",
    "двигатель",
    "тип двигателя",
    "объём двигателя",
    "мощность двигателя",
    "мощность",
    "коробка передач",
    "тип коробки передач",
    "кпп",
    "тип привода",
    "расположение руля",
    "тип кузова",
    "кузов",
    "количество дверей",
    "количество мест",
    "цвет",
    "интерьер",
    "отделка салона",
    "состояние",
    "vin",
    "номер шасси",
    "номер рамы",
    "регистрационный номер",
    "госномер",
    "количество владельцев",
    "комплектация",
    "опции",
    "особенности",
    "дополнительно",
    "ограничения",
    "обременения",
    "залог",
    "залоги",
    "страхование",
    "история обслуживания",
    "эксплуатация",
    "птс",
  ].map((value) => value.toLowerCase()),
);

const VEHICLE_KEY_PATTERNS = [
  /^brand/i,
  /^model/i,
  /^generation/i,
  /^modification/i,
  /^year/i,
  /production_year/i,
  /manufacture_year/i,
  /release_year/i,
  /mileage/i,
  /^engine/i,
  /power/i,
  /transmission/i,
  /gearbox/i,
  /kpp/i,
  /drive/i,
  /wheel/i,
  /steer/i,
  /body/i,
  /door/i,
  /seat/i,
  /color/i,
  /interior/i,
  /upholstery/i,
  /condition/i,
  /^vin/i,
  /chassis/i,
  /frame/i,
  /registration/i,
  /license/i,
  /plate/i,
  /owner/i,
  /equipment/i,
  /option/i,
  /feature/i,
  /extra/i,
  /restriction/i,
  /encumbrance/i,
  /pledge/i,
  /passport/i,
  /customs/i,
  /usage/i,
  /service/i,
  /insurance/i,
];

function parseNumberValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value
      .replace(/\u00a0/g, "")
      .replace(/\s/g, "")
      .replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function fmtPrice(value, currency = "RUB") {
  const numeric = parseNumberValue(value);
  if (numeric == null)
    return value == null || value === "" ? "—" : String(value);
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(numeric);
  } catch {
    return `${numeric} ${currency}`;
  }
}

function formatValue(v) {
  if (v == null || v === "") return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toLocaleString("ru-RU");
  if (Array.isArray(v)) return v.map(formatValue).join(", ");
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function normalizePhoto(photo) {
  if (!photo) return null;
  if (typeof photo === "string") {
    return { url: photo, title: "" };
  }
  if (typeof photo === "object") {
    const url = photo.url || photo.href || photo.src || null;
    if (!url) return null;
    return { url, title: photo.title || photo.name || photo.alt || "" };
  }
  return null;
}

function collectPhotos(details) {
  const pools = [
    details?.photos,
    details?.images,
    details?.lot_details?.photos,
    details?.lot_details?.images,
    details?.gallery,
  ].filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const pool of pools) {
    const arr = Array.isArray(pool) ? pool : [pool];
    for (const raw of arr) {
      const ph = normalizePhoto(raw);
      if (ph && ph.url && !seen.has(ph.url)) {
        seen.add(ph.url);
        out.push(ph);
      }
    }
  }
  return out;
}

function buildKeyValueEntries(source) {
  if (!source || typeof source !== "object") return [];
  const result = [];
  const seen = new Set();

  Object.entries(source).forEach(([key, value]) => {
    if (
      value == null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    )
      return;
    const displayValue = formatValueForDisplay(key, value);
    if (!displayValue || displayValue === "—") return;
    const label = translateFieldKey(key);
    const dedupeKey = `${label}:${displayValue}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push({
      key: label,
      value: displayValue,
      rawKey: key,
      rawValue: value,
    });
  });

  return result;
}

function partitionLotAndVehicleEntries(entries) {
  const lotInfoEntries = [];
  const vehicleEntries = [];

  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const label = typeof entry.key === "string" ? entry.key.trim() : "";
    if (!label || label.toLowerCase() === "заголовок") return;

    const rawKey =
      entry.rawKey != null && entry.rawKey !== ""
        ? String(entry.rawKey).toLowerCase()
        : "";
    const normalizedLabel = label.toLowerCase();
    const isVehicleLabel = VEHICLE_LABELS.has(normalizedLabel);
    const isVehicleKey =
      rawKey && VEHICLE_KEY_PATTERNS.some((pattern) => pattern.test(rawKey));

    if (isVehicleLabel || isVehicleKey) {
      vehicleEntries.push(entry);
    } else {
      lotInfoEntries.push(entry);
    }
  });

  return { lotInfoEntries, vehicleEntries };
}

function formatTradeType(value) {
  const mapped = formatTradeTypeLabel(value);
  if (mapped) return mapped;
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "tender" || normalized === "torgi") return "Торги";
  return translateFieldKey(value);
}

const DOCUMENT_TYPE_LABELS = {
  protocol: "Протокол",
  report: "Отчёт",
  contract: "Договор",
  notice: "Уведомление",
  statement: "Заявление",
  application: "Заявка",
  decision: "Решение",
  order: "Приказ",
  passport: "Паспорт",
  conclusion: "Заключение",
  regulation: "Положение",
  instruction: "Инструкция",
  agreement: "Соглашение",
  act: "Акт",
};

function translateDocumentType(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/[а-яё]/i.test(raw)) return raw;
  const normalized = raw.toLowerCase();
  if (DOCUMENT_TYPE_LABELS[normalized]) return DOCUMENT_TYPE_LABELS[normalized];
  return translateFieldKey(raw);
}

function normalizeDocuments(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((doc, index) => {
      if (!doc || typeof doc !== "object") return null;
      const url =
        doc.url || doc.href || doc.link || doc.download_url || doc.file || null;
      const title =
        doc.title ||
        doc.name ||
        doc.filename ||
        doc.label ||
        `Документ ${index + 1}`;
      const typeRaw = doc.document_type || doc.type || doc.kind || null;
      const type = translateDocumentType(typeRaw);
      const description = doc.description || doc.comment || doc.note || "";
      const date =
        doc.date || doc.created_at || doc.updated_at || doc.uploaded_at || null;
      return {
        id: url || `${title}-${index}`,
        title,
        type,
        rawType: typeRaw,
        description,
        date,
        url,
      };
    })
    .filter(Boolean);
}

function resolveAuctionStep(details, item) {
  const lotDetails = details?.lot_details && typeof details.lot_details === "object"
    ? details.lot_details
    : {};
  const listingLot = item?.lot_details && typeof item.lot_details === "object" ? item.lot_details : {};
  const candidates = [
    lotDetails.price_step,
    lotDetails.auction_step,
    lotDetails.step,
    lotDetails.bid_step,
    lotDetails.increase_step,
    lotDetails.step_value,
    listingLot.price_step,
    listingLot.auction_step,
    listingLot.step,
    listingLot.bid_step,
    listingLot.increase_step,
    listingLot.step_value,
    item?.price_step,
    item?.auction_step,
    item?.step,
  ];
  for (const candidate of candidates) {
    if (candidate != null && candidate !== "") {
      return candidate;
    }
  }
  return null;
}

function renderContactValue(entry) {
  const raw = entry?.rawValue;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return entry.value;
    if (/^https?:\/\//i.test(trimmed)) {
      return (
        <a href={trimmed} target="_blank" rel="noreferrer">
          {trimmed}
        </a>
      );
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return <a href={`mailto:${trimmed}`}>{trimmed}</a>;
    }
    const digits = trimmed.replace(/[^\d+]/g, "");
    const digitCount = digits.replace(/\D/g, "").length;
    if (digitCount >= 10) {
      const normalized = digits.startsWith("+")
        ? digits
        : `+${digits.replace(/^8/, "7")}`;
      return <a href={`tel:${normalized}`}>{entry.value}</a>;
    }
  }
  return entry.value;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ru-RU");
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU");
}

function hasData(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

const PRICE_HEADER_STYLE = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 600,
  color: "#9aa6b2",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const PRICE_CELL_STYLE = {
  padding: "10px 12px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  verticalAlign: "top",
  fontSize: 13,
  color: "#4b5563",
};

function resolveApiBase(req) {
  if (API) return API.replace(/\/$/, "");
  const headers = req?.headers || {};
  const proto =
    headers["x-forwarded-proto"] || (req?.socket?.encrypted ? "https" : "http");
  const host = headers["x-forwarded-host"] || headers.host;
  return host ? `${proto}://${host}` : "";
}

export async function getServerSideProps(context) {
  const { params, req } = context;
  const base = resolveApiBase(req);
  if (!base) return { notFound: true };

  const url = `${base}/api/listings/${params.id}`;

  try {
    const response = await fetch(url, { cache: "no-store" });
    if (response.status === 404) return { notFound: true };
    if (!response.ok) return { notFound: true };
    const item = await response.json();
    return { props: { item } };
  } catch {
    return { notFound: true };
  }
}

function KeyValueGrid({ entries }) {
  if (!entries || !entries.length) return null;
  return (
    <div
      className="panel"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: 12,
      }}
    >
      {entries.map((entry, index) => {
        const { key, value } = entry;
        const isMultiline = typeof value === "string" && value.includes("\n");
        const excludeKeys = [
          "Название",
          "Категория",
          "Trade тип",
          "Описание",
          "Object name",
          "Ссылка на источник",
        ];

        if (!excludeKeys.includes(key))
          return (
            <div
              key={`${key}-${index}`}
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <div className="detail-label">{key}</div>
              {isMultiline ? (
                <pre
                  style={{
                    margin: 0,
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {value}
                </pre>
              ) : (
                <div
                  style={{
                    fontWeight: 600,
                    wordBreak: "break-word",
                    color: "#4b5563",
                  }}
                >
                  {value}
                </div>
              )}
            </div>
          );
      })}
    </div>
  );
}

function KeyValueList({ entries, renderValue, valueClassName, valueStyle }) {
  if (!entries || !entries.length) return null;
  const baseStyle = {
    fontWeight: 600,
    textAlign: "right",
    wordBreak: "break-word",
    ...(valueStyle || {}),
  };
  return (
    <div className="panel" style={{ display: "grid", gap: 8 }}>
      {entries.map((entry, index) => {
        const { key, value } = entry;
        const content = renderValue ? renderValue(entry) : value;
        const resolvedClassName =
          typeof valueClassName === "function"
            ? valueClassName(entry)
            : valueClassName;
        const isMultiline =
          typeof content === "string" && content.includes("\n");
        return (
          <div
            key={`${key}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div className="detail-label">{key}</div>
            {isMultiline ? (
              <pre
                className={resolvedClassName}
                style={{ ...baseStyle, margin: 0, whiteSpace: "pre-wrap" }}
              >
                {content}
              </pre>
            ) : (
              <div className={resolvedClassName} style={baseStyle}>
                {content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function pickLotValue(source, keys = []) {
  if (!source || typeof source !== "object" || !keys.length) return null;
  for (const key of keys) {
    if (key in source) {
      const value = source[key];
      if (value != null && value !== "") return value;
    }
  }
  return null;
}

export default function ListingPage({ item }) {
  const details =
    item?.details && typeof item.details === "object" ? item.details : {};
  const listingIdentifier =
    item?.id ?? item?.source_id ?? item?.listing_id ?? item?._id ?? null;
  const listingIdRaw =
    listingIdentifier != null ? String(listingIdentifier).trim() : "";
  const timing = computeTradeTiming(item || {});
  const statusInfo = timing?.status || null;
  const periods = Array.isArray(timing?.periods) ? timing.periods : [];
  const currentPeriodIndex = timing?.currentPeriodIndex;
  const currentPeriod =
    timing?.currentPeriod ||
    (typeof currentPeriodIndex === "number"
      ? periods[currentPeriodIndex]
      : null);
  const currentStageLabel =
    typeof currentPeriodIndex === "number" && timing?.periodsCount
      ? `${currentPeriodIndex + 1} из ${timing.periodsCount}`
      : null;
  const stageEndDate = timing?.currentPeriod?.end || null;
  const stageEndLabel = stageEndDate ? formatDateTime(stageEndDate) : null;
  const applicationDeadlineDate = timing?.applicationDeadline || null;
  const applicationDeadlineLabel =
    applicationDeadlineDate &&
    (!stageEndDate ||
      applicationDeadlineDate.getTime() !== stageEndDate.getTime())
      ? formatDateTime(applicationDeadlineDate)
      : null;
  const finishDate = timing?.finishDate || null;
  const finishLabel =
    finishDate &&
    (!applicationDeadlineDate ||
      finishDate.getTime() !== applicationDeadlineDate.getTime())
      ? formatDateTime(finishDate)
      : item?.end_date
      ? formatDateTime(item.end_date)
      : null;
  const fallbackStatusLabel = item?.status
    ? translateValueByKey("status", item.status) ||
      translateFieldKey(item.status)
    : null;
  const statusDisplay =
    statusInfo ||
    (fallbackStatusLabel
      ? { label: fallbackStatusLabel, color: "#64748b" }
      : null);
  const normalizedStatusLabels = [
    statusInfo?.label,
    fallbackStatusLabel,
    typeof item?.status === "string" ? item.status : null,
  ]
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  const isTradeFinished =
    statusInfo?.key === "finished" ||
    normalizedStatusLabels.some((label) => label.includes("торги завершены"));
  const summaryStartPrice =
    item?.start_price ??
    periods[0]?.priceNumber ??
    periods[0]?.minPriceNumber ??
    null;
  const summaryCurrentPrice =
    timing?.currentPriceNumber != null
      ? timing.currentPriceNumber
      : item?.current_price ??
        currentPeriod?.priceNumber ??
        currentPeriod?.minPriceNumber ??
        item?.start_price ??
        null;

  const [authToken, setAuthToken] = useState(null);
  const [viewCount, setViewCount] = useState(() => parseViewCount(item?.view_count));
  const [openTradeModal, setOpenTradeModal] = useState(false);
  const [openInspectionModal, setOpenInspectionModal] = useState(false);
  const [openAutotekaModal, setOpenAutotekaModal] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);

  function handleOrderClick() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      const next = `/trades/${listingIdRaw || ""}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    setOpenTradeModal(true);
  }

  function handleInspectionClick() {
    setOpenInspectionModal(true);
  }

  function handleAutotekaClick() {
    setOpenAutotekaModal(true);
  }

  const photos = collectPhotos(details);

  useEffect(() => {
    setViewCount(parseViewCount(item?.view_count));
  }, [item?.id, item?.view_count]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [item?.id, photos.length]);
  const activePhoto = photos[activePhotoIndex] || photos[0] || null;
  const lightboxPhoto = photos[lightboxPhotoIndex] || null;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const stored = localStorage.getItem("token");
    setAuthToken(stored || null);

    function handleStorage(event) {
      if (event.key === "token") {
        setAuthToken(event.newValue || null);
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!authToken || !listingIdRaw) return undefined;
    let cancelled = false;

    async function registerView() {
      try {
        const response = await fetch(
          buildApiUrl(`/api/listings/${listingIdRaw}/views`),
          {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          },
        );

        if (response.status === 401) {
          if (typeof window !== "undefined") localStorage.removeItem("token");
          setAuthToken(null);
          return;
        }

        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }

        const data = await response.json();
        if (!cancelled && data && typeof data.viewCount !== "undefined") {
          setViewCount(parseViewCount(data.viewCount));
        }
      } catch (error) {
        console.error("Failed to register listing view", error);
      }
    }

    registerView();
    return () => {
      cancelled = true;
    };
  }, [authToken, listingIdRaw]);

  useEffect(() => {
    if (!photos.length) {
      setIsPhotoLightboxOpen(false);
      setLightboxPhotoIndex(0);
      return;
    }
    if (lightboxPhotoIndex >= photos.length) {
      setLightboxPhotoIndex(photos.length - 1);
    }
  }, [photos.length, lightboxPhotoIndex]);

  useEffect(() => {
    if (!isPhotoLightboxOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsPhotoLightboxOpen(false);
        return;
      }
      if (event.key === "ArrowRight" && photos.length > 1) {
        event.preventDefault();
        setLightboxPhotoIndex((prev) => (prev + 1) % photos.length);
      }
      if (event.key === "ArrowLeft" && photos.length > 1) {
        event.preventDefault();
        setLightboxPhotoIndex((prev) =>
          (prev - 1 + photos.length) % photos.length,
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPhotoLightboxOpen, photos.length]);

  useEffect(() => {
    if (!isPhotoLightboxOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPhotoLightboxOpen]);

  function openPhotoLightbox(index) {
    if (!photos.length) return;
    setLightboxPhotoIndex(index);
    setIsPhotoLightboxOpen(true);
  }

  function closePhotoLightbox() {
    setIsPhotoLightboxOpen(false);
  }

  function showNextPhoto() {
    if (photos.length <= 1) return;
    setLightboxPhotoIndex((prev) => (prev + 1) % photos.length);
  }

  function showPrevPhoto() {
    if (photos.length <= 1) return;
    setLightboxPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }


  const lotEntries = buildKeyValueEntries(details?.lot_details);
  const { lotInfoEntries, vehicleEntries } = partitionLotAndVehicleEntries(
    lotEntries,
  );
  const contactEntries = buildKeyValueEntries(details?.contact_details);
  const debtorEntries = buildKeyValueEntries(details?.debtor_details);
  const prices = Array.isArray(details?.prices) ? details.prices : [];
  const documents = normalizeDocuments(
    Array.isArray(details?.documents) ? details.documents : []
  );
  const periodScheduleEntries = periods;
  const periodScheduleDeadline = applicationDeadlineDate;
  const fedresursMeta = details?.fedresurs_meta;
  const currency = item?.currency || "RUB";

  const locationLabel = [item?.city, item?.region].filter(Boolean).join(", ");
  const tradeTypeLabel =
    item?.trade_type_label ||
    formatTradeType(item?.trade_type_resolved ?? item?.trade_type);
  const normalizedTradeType = normalizeTradeTypeCode(
    item?.trade_type_resolved ?? item?.trade_type,
  );
  const isOpenAuction = normalizedTradeType === "open_auction";
  const summaryAuctionStepRaw = resolveAuctionStep(details, item);
  const summaryAuctionStepNumber = parseNumberValue(summaryAuctionStepRaw);
  const summaryAuctionStep =
    summaryAuctionStepNumber != null ? summaryAuctionStepNumber : summaryAuctionStepRaw;
  const actionButtons = [
    {
      key: "participate",
      label: "Участвовать в торгах",
      onClick: handleOrderClick,
      className: "button",
      disabled: isTradeFinished,
      title: isTradeFinished
        ? "Торги завершены, участие недоступно"
        : undefined,
    },
    {
      key: "inspection",
      label: "Заказать осмотр",
      onClick: handleInspectionClick,
      className: "button button-outline",
      disabled: isTradeFinished,
      title: isTradeFinished
        ? "Торги завершены, заказ осмотра недоступен"
        : undefined,
    },
    {
      key: "autoteka",
      label: "Заказать автотеку",
      onClick: handleAutotekaClick,
      className: "button button-outline",
      disabled: isTradeFinished,
      title: isTradeFinished
        ? "Торги завершены, заказ автотеки недоступен"
        : undefined,
    },
  ];

  if (item?.source_url) {
    actionButtons.push({
      key: "source",
      label: "Перейти к источнику",
      href: item.source_url,
      className: "button button-outline",
      disabled: isTradeFinished,
      title: isTradeFinished
        ? "Торги завершены, переход к источнику недоступен"
        : undefined,
    });
  }
  return (
    <div className="container detail-page">
      <div className="back-link">
        <Link href="/trades" className="link">
          ← Назад к списку
        </Link>
      </div>

      <div
        className="detail-hero"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        <div className="detail-hero__gallery" style={{ marginTop: 60 }}>
<div className="detail-hero__main-photo">
            {activePhoto ? (
              <button
                type="button"
                className="detail-hero__main-photo-button"
                onClick={() => openPhotoLightbox(activePhotoIndex)}
                aria-label="Открыть фотографию в полноэкранном режиме"
              >
                <img
                  src={activePhoto.url}
                  alt={activePhoto.title || item?.title || "Фотография лота"}
                />
              </button>
            ) : (
              <div className="detail-hero__placeholder">
                Фотографии появятся позже
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="detail-hero__thumbs">
              {photos.slice(0, 8).map((photo, index) => (
                <button
                  key={photo.url || `${index}-${photo.title || ""}`}
                  type="button"
                  className={
                    index === activePhotoIndex ? "is-active" : undefined
                  }
                  onClick={() => setActivePhotoIndex(index)}
                  onMouseEnter={() => setActivePhotoIndex(index)}
                  aria-label={`Фотография ${index + 1}`}
                >
                  <img
                    src={photo.url}
                    alt={photo.title || `Фото ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-hero__info">
          {tradeTypeLabel ? (
            <div className="detail-hero__badge">{tradeTypeLabel}</div>
          ) : null}
          <h1 className="detail-hero__title">{item?.title || "Лот"}</h1>
          {locationLabel ? (
            <div
              className="detail-hero__location"
              style={{ color: "#6B7280", display: "flex", gap: 6 }}
            >
              <img
                src="/maps/geo.svg"
                alt="Geo"
                style={{
                  width: 18,
                  height: 18,
                }}
              />
              {locationLabel}
            </div>
          ) : null}

          <div className="detail-summary-card detail-summary-card--inline">
            <div className="detail-summary__prices">
              <div className="detail-summary__price">
                <div className="detail-summary__price-label">
                  Стартовая цена
                </div>
                <div className="detail-summary__price-value">
                  {fmtPrice(summaryStartPrice, currency)}
                </div>
              </div>
              <div className="detail-summary__price">
                <div className="detail-summary__price-label">
                  {isOpenAuction ? "Шаг аукциона" : "Текущая цена"}
                </div>
                <div className="detail-summary__price-value">
                  {fmtPrice(
                    isOpenAuction
                      ? summaryAuctionStep != null && summaryAuctionStep !== ""
                        ? summaryAuctionStep
                        : summaryCurrentPrice
                      : summaryCurrentPrice,
                    currency,
                  )}
                </div>
              </div>
            </div>

            {(statusDisplay ||
              currentStageLabel ||
              stageEndLabel ||
              applicationDeadlineLabel ||
              finishLabel) && (
              <div
                className="detail-summary__status"
                style={{
                  padding: "16px !important",
                  borderRadius: "12px !important",
                  marginTop: "16px !important",
                }}
              >
                {statusDisplay ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#000000 !important",
                    }}
                  >
                    {statusDisplay.color ? (
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: statusDisplay.color,
                          display: "inline-block",
                        }}
                      />
                    ) : null}
                    <div style={{ color: "#000000 !important" }}>
                      <strong>Статус:</strong> {statusDisplay.label}
                    </div>
                  </div>
                ) : null}
                {currentStageLabel ? (
                  <div style={{ color: "#000000 !important" }}>
                    <strong>Текущий этап:</strong> {currentStageLabel}
                  </div>
                ) : null}
                {stageEndLabel ? (
                  <div style={{ color: "#000000 !important" }}>
                    <strong>Окончание этапа:</strong> {stageEndLabel}
                  </div>
                ) : null}
                {applicationDeadlineLabel ? (
                  <div
                    style={{
                      color: "#000000 !important",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>Приём заявок до:</strong> {applicationDeadlineLabel}
                    </div>
                    <ViewCounter count={viewCount} />
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      color: "#000000 !important",
                    }}
                  >
                    <ViewCounter count={viewCount} />
                  </div>
                )}
                {!stageEndLabel && !applicationDeadlineLabel && finishLabel ? (
                  <div style={{ color: "#000000 !important" }}>
                    <strong>Дата окончания:</strong> {finishLabel}
                  </div>
                ) : null}
                {finishLabel &&
                (stageEndLabel || applicationDeadlineLabel) &&
                finishLabel !== stageEndLabel &&
                finishLabel !== applicationDeadlineLabel ? (
                  <div style={{ color: "#000000 !important" }}>
                    <strong>Завершение торгов:</strong> {finishLabel}
                  </div>
                ) : null}
              </div>
            )}

<div className="detail-summary__actions">
             {actionButtons.map((action) =>
                action.href ? (
                  <a
                    key={action.key}
                    href={action.disabled ? undefined : action.href}
                    target={action.disabled ? undefined : "_blank"}
                    rel={action.disabled ? undefined : "noreferrer"}
                    className={action.className}
                    onClick={
                      action.disabled
                        ? (event) => {
                            event.preventDefault();
                          }
                        : undefined
                    }
                    aria-disabled={action.disabled || undefined}
                    title={action.title}
                    tabIndex={action.disabled ? -1 : undefined}
                  >
                    {action.label}
                  </a>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    onClick={action.onClick}
                    className={action.className}
                    disabled={action.disabled}
                    aria-disabled={action.disabled || undefined}
                    title={action.title}
                  >
                    {action.label}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {isPhotoLightboxOpen && lightboxPhoto ? (
        <div
          className="detail-photo-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={closePhotoLightbox}
        >
          <div
            className="detail-photo-lightbox__content"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="detail-photo-lightbox__close"
              onClick={closePhotoLightbox}
              aria-label="Закрыть просмотр фотографии"
            >
              ×
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  className="detail-photo-lightbox__nav detail-photo-lightbox__nav--prev"
                  onClick={showPrevPhoto}
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="detail-photo-lightbox__nav detail-photo-lightbox__nav--next"
                  onClick={showNextPhoto}
                  aria-label="Следующее фото"
                >
                  ›
                </button>
              </>
            ) : null}

            <div className="detail-photo-lightbox__image-wrapper">
              <img
                src={lightboxPhoto.url}
                alt={
                  lightboxPhoto.title ||
                  activePhoto?.title ||
                  item?.title ||
                  "Фотография лота"
                }
              />
            </div>

            {photos.length > 1 ? (
              <div className="detail-photo-lightbox__counter">
                {lightboxPhotoIndex + 1} / {photos.length}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <TradeOrderModal
        listingId={listingIdRaw}
        listing={item}
        isOpen={openTradeModal}
        onClose={() => setOpenTradeModal(false)}
      />

      <InspectionModal
        listingId={listingIdRaw}
        isOpen={openInspectionModal}
        onClose={() => setOpenInspectionModal(false)}
      />
      <AutotekaModal
        listingId={listingIdRaw}
        isOpen={openAutotekaModal}
        onClose={() => setOpenAutotekaModal(false)}
      />

      <div className="detail-layout">
        <div className="detail-main">
          {(item?.description || details?.lot_details?.description) && (
            <section className="detail-section">
              <h2>Описание</h2>
              <div className="panel" style={{ whiteSpace: "pre-wrap" }}>
                {item?.description || details?.lot_details?.description}
              </div>
            </section>
          )}

          {lotInfoEntries.length > 0 && (
            <section className="detail-section">
              <h2>Сведения о лоте</h2>
              <KeyValueGrid entries={lotInfoEntries} />
            </section>
          )}

          {vehicleEntries.length > 0 && (
            <section className="detail-section">
              <h2>Характеристики автомобиля</h2>
              <KeyValueGrid entries={vehicleEntries} />
            </section>
          )}

          {debtorEntries.length > 0 && (
            <section className="detail-section">
              <h2>Информация о должнике</h2>
              <KeyValueGrid entries={debtorEntries} />
            </section>
          )}

          {contactEntries.length > 0 && (
            <section className="detail-section">
              <h2>Информация об организаторе</h2>
              <KeyValueGrid entries={contactEntries} />
            </section>
          )}

          {periodScheduleEntries.length > 0 && (
            <section className="detail-section">
              <h2>График снижения цены</h2>
              <div className="panel table-scroll" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ ...PRICE_HEADER_STYLE, width: 60 }}>№</th>
                      <th style={PRICE_HEADER_STYLE}>Дата начала</th>
                      <th style={PRICE_HEADER_STYLE}>Дата окончания</th>
                      <th style={PRICE_HEADER_STYLE}>Цена, руб.</th>
                      <th style={PRICE_HEADER_STYLE}>Задаток, руб.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodScheduleEntries.map((entry, index) => {
                      const isActive =
                        typeof currentPeriodIndex === "number" &&
                        currentPeriodIndex === index;
                      const startText = entry.start
                        ? formatDateTime(entry.start)
                        : "—";
                      const endText = entry.end
                        ? formatDateTime(entry.end)
                        : "—";
                      const priceNumeric =
                        entry.priceNumber != null
                          ? entry.priceNumber
                          : entry.minPriceNumber;
                      const priceText =
                        priceNumeric != null
                          ? fmtPrice(priceNumeric, currency)
                          : entry.priceRaw != null
                          ? formatValueForDisplay("price", entry.priceRaw)
                          : "—";
                      const depositText =
                        entry.depositNumber != null
                          ? fmtPrice(entry.depositNumber, currency)
                          : entry.depositRaw != null
                          ? formatValueForDisplay("deposit", entry.depositRaw)
                          : "—";

                      return (
                        <tr
                          key={entry.id || `period-${index}`}
                          style={
                            isActive
                              ? { background: "rgba(30,144,255,0.08)" }
                              : undefined
                          }
                        >
                          <td
                            style={{
                              ...PRICE_CELL_STYLE,
                              textAlign: "center",
                              fontWeight: 600,
                            }}
                          >
                            {index + 1}
                          </td>
                          <td style={PRICE_CELL_STYLE}>{startText}</td>
                          <td style={PRICE_CELL_STYLE}>{endText}</td>
                          <td style={PRICE_CELL_STYLE}>{priceText}</td>
                          <td style={PRICE_CELL_STYLE}>{depositText}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {periodScheduleDeadline ? (
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>
                  Дата окончания приёма заявок по лоту:{" "}
                  <b>{formatDateTime(periodScheduleDeadline)}</b>
                </div>
              ) : null}
            </section>
          )}

          {!isOpenAuction && Array.isArray(prices) && prices.length > 0 && (
            <section className="detail-section">
              <h2>История цен</h2>
              <div className="panel table-scroll" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={PRICE_HEADER_STYLE}>Этап</th>
                      <th style={PRICE_HEADER_STYLE}>Цена</th>
                      <th style={PRICE_HEADER_STYLE}>Дата</th>
                      <th style={PRICE_HEADER_STYLE}>Комментарий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((entry, index) => {
                      const labelRaw =
                        entry.stage ||
                        entry.stage_name ||
                        entry.stageName ||
                        entry.round ||
                        entry.type ||
                        entry.name ||
                        entry.title;
                      const label = labelRaw
                        ? translateFieldKey(labelRaw)
                        : `Запись ${index + 1}`;
                      const numericPrice = parseNumberValue(
                        entry.price ??
                          entry.currentPrice ??
                          entry.current_price ??
                          entry.startPrice ??
                          entry.start_price ??
                          entry.value ??
                          entry.amount
                      );
                      const fallbackPrice =
                        entry.price ??
                        entry.currentPrice ??
                        entry.current_price ??
                        entry.startPrice ??
                        entry.start_price ??
                        entry.value ??
                        entry.amount ??
                        "—";
                      const priceText =
                        numericPrice != null
                          ? fmtPrice(numericPrice, currency)
                          : formatValueForDisplay("price", fallbackPrice);
                      const dateValue =
                        entry.date ||
                        entry.date_start ||
                        entry.dateStart ||
                        entry.date_finish ||
                        entry.dateFinish ||
                        entry.updated_at ||
                        entry.updatedAt;
                      const dateText = dateValue
                        ? formatDateTime(dateValue)
                        : "—";
                      const commentRaw =
                        entry.comment ||
                        entry.description ||
                        entry.info ||
                        entry.status ||
                        entry.note ||
                        entry.result ||
                        null;
                      const commentText = commentRaw
                        ? formatValueForDisplay("comment", commentRaw)
                        : null;

                      return (
                        <tr key={entry.id || `${label}-${index}`}>
                          <td style={PRICE_CELL_STYLE}>{label}</td>
                          <td style={PRICE_CELL_STYLE}>{priceText}</td>
                          <td style={PRICE_CELL_STYLE}>{dateText}</td>
                          <td style={PRICE_CELL_STYLE}>
                            {commentText ? (
                              <span style={{ whiteSpace: "pre-wrap" }}>
                                {commentText}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {documents.length > 0 && (
            <section className="detail-section">
              <h2>Документы</h2>
              <div className="panel" style={{ display: "grid", gap: 12 }}>
                {documents.map((doc) => {
                  const hasMeta = doc.type || doc.date;

                  return (
                    <article key={doc.id} className="document-card">
                      <div className="document-card__title">{doc.title}</div>
                      {hasMeta ? (
                        <div className="document-card__meta">
                          {doc.type ? <span>{doc.type}</span> : null}
                          {doc.date ? (
                            <span>Дата: {formatDate(doc.date)}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {doc.description ? (
                        <div
                          style={{
                            color: "rgba(226,232,240,0.75)",
                            fontSize: 13,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {doc.description}
                        </div>
                      ) : null}
                      {doc.url ? (
                        <div className="document-card__actions">
                          <a href={doc.url} target="_blank" rel="noreferrer">
                            Открыть документ →
                          </a>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          )}
          {/* 
          {hasData(fedresursMeta) && (
            <section className="detail-section">
              <h2>Дополнительные данные</h2>
              <div className="panel" style={{ padding: 12, overflowX: "auto" }}>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(fedresursMeta, null, 2)}
                </pre>
              </div>
            </section>
          )} */}
        </div>
      </div>
    </div>
  );
}












