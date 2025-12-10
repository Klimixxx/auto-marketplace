import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import TradeOrderModal from "../../components/TradeOrderModal";
import InspectionModal from "../../components/InspectionModal";
import AutotekaModal from "../../components/AutotekaModal";
import {
  formatValueForDisplay,
  translateFieldKey,
  translateValueByKey,
} from "../../lib/lotFormatting";
import { formatTradeTypeLabel, normalizeTradeTypeCode } from "../../lib/tradeTypes";
import computeTradeTiming, { parseDateLike } from "../../lib/tradeTiming";

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

function PriceDirectionArrow({ direction, size = 22, color = "#2A65F7" }) {
  const isDown = direction === "down";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      style={{ transform: isDown ? "rotate(180deg)" : undefined }}
    >
      <path
        d="M12 5l5.5 5.5a.75.75 0 01-1.06 1.06L12.75 8.87V19a.75.75 0 01-1.5 0V8.87L7.56 11.56a.75.75 0 01-1.06-1.06L12 5z"
        fill={color}
      />
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

function pickFirstNonEmpty(...candidates) {
  for (const candidate of candidates) {
    if (candidate == null) continue;
    if (typeof candidate === "string" && candidate.trim() === "") continue;
    return candidate;
  }
  return null;
}

function pickNumericFromSources(sources = [], keys = []) {
  const normalizedKeys = keys.map((key) =>
    typeof key === "string" ? key.toLowerCase() : String(key)
  );
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    for (const [candidateKey, value] of Object.entries(source)) {
      if (typeof candidateKey !== "string") continue;
      if (normalizedKeys.includes(candidateKey.toLowerCase())) {
        const parsed = parseNumberValue(value);
        if (parsed != null) return parsed;
      }
    }
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

function normalizeEntryKey(value) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.trim().toLowerCase();
}

const LOT_INFO_EXCLUDED_RAW_KEYS = new Set([
  "start_price",
  "startprice",
  "deposit_amount",
  "region_code",
  "inspection_procedure",
]);

const LOT_INFO_EXCLUDED_LABELS = new Set([
  "начальная цена",
  "сумма задатка",
  "регион code",
  "код региона",
  "порядок осмотра",
]);
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
  const lotDetails =
    details?.lot_details && typeof details.lot_details === "object"
      ? details.lot_details
      : {};
  const listingLot =
    item?.lot_details && typeof item.lot_details === "object" ? item.lot_details : {};
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

        return null;
      })}
    </div>
  );
}

function KeyValueList({ entries, renderValue, valueClassName, valueStyle }) {
  if (!entries || !entries.length) return null;
  const baseStyle = {
    fontWeight: 600,
    textAlign: "right",
    wordBreak: "word-break",
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
  const currency = item?.currency || "RUB";
  const listingIdentifier =
    item?.id ?? item?.source_id ?? item?.listing_id ?? item?._id ?? null;
  const listingIdRaw =
    listingIdentifier != null ? String(listingIdentifier).trim() : "";

  const router = useRouter();

  const handleBackToList = () => {
    router.push("/trades");
  };

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

  const firstPeriodPrice =
    periods[0]?.priceNumber ?? periods[0]?.minPriceNumber ?? null;
  const firstPeriodMinPrice =
    periods[0]?.minPriceNumber ?? periods[0]?.priceNumber ?? null;
  const minimalPeriodPrice = periods.reduce((min, entry) => {
    const candidate = entry?.minPriceNumber ?? entry?.priceNumber ?? null;
    if (candidate == null || !Number.isFinite(candidate)) return min;
    if (min == null || candidate < min) return candidate;
    return min;
  }, null);

  // ВАЖНО: эти константы объявляем ДО использования в summaryPriceBlocks и priceHistoryEntries
  const prices = Array.isArray(details?.prices) ? details.prices : [];

  const locationLabel = [item?.city, item?.region].filter(Boolean).join(", ");
  const tradeTypeLabel =
    item?.trade_type_label ||
    formatTradeType(item?.trade_type_resolved ?? item?.trade_type);
  const normalizedTradeType = normalizeTradeTypeCode(
    item?.trade_type_resolved ?? item?.trade_type,
  );
  const isOpenAuction = normalizedTradeType === "open_auction";
  const isPublicOffer = normalizedTradeType === "public_offer";
  const normalizedPriceHistory = (() => {
    const mapped = prices.map((entry, index) => {
      const rawPrice = pickFirstNonEmpty(
        entry.price,
        entry.currentPrice,
        entry.current_price,
        entry.startPrice,
        entry.start_price,
        entry.value,
        entry.amount,
      );
      const priceNumber = parseNumberValue(rawPrice);
      const fallbackPrice = rawPrice ?? "—";
      const depositBasePrice =
        priceNumber != null ? priceNumber : parseNumberValue(rawPrice);
      const depositNumber =
        depositBasePrice != null && Number.isFinite(depositBasePrice) && depositBasePrice > 0
          ? Math.round(depositBasePrice * 0.1)
          : null;
      const rawStartDate = pickFirstNonEmpty(
        entry.date_start,
        entry.start_date,
        entry.period_start,
        entry.dateBegin,
        entry.date_from,
        entry.begin,
        entry.start,
        entry.date,
        entry.updated_at,
        entry.updatedAt,
      );
      const rawEndDate = pickFirstNonEmpty(
        entry.date_finish,
        entry.dateFinish,
        entry.end_date,
        entry.date_end,
        entry.period_end,
        entry.date_to,
        entry.finish,
        entry.end,
      );

      return {
        key: entry.id || `history-${index}`,
        priceNumber,
        fallbackPrice,
        depositNumber,
        startDate: parseDateLike(rawStartDate),
        endDate: parseDateLike(rawEndDate),
      };
    });

    const sorted = mapped.sort((a, b) => {
      const aTs = a.startDate?.getTime() ?? a.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTs = b.startDate?.getTime() ?? b.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
      return aTs - bTs;
    });

    return sorted.map((entry, index) => {
      const nextStartDate = sorted[index + 1]?.startDate ?? null;
      const startTs = entry.startDate?.getTime() ?? null;
      const endTs = entry.endDate?.getTime() ?? null;
      let adjustedEndDate = entry.endDate;

      if (endTs == null && nextStartDate) {
        adjustedEndDate = nextStartDate;
      }

      return {
        ...entry,
        endDate: adjustedEndDate,
      };
    });
  })();
  const minPriceFromHistory = normalizedPriceHistory.reduce((min, entry) => {
    if (entry?.priceNumber == null || !Number.isFinite(entry.priceNumber)) return min;
    if (min == null || entry.priceNumber < min) return entry.priceNumber;
    return min;
  }, null);
  const {
    price: currentPriceFromHistory,
    deposit: depositFromCurrentPeriod,
    hasActivePublicOfferPeriod: hasActivePublicOfferPeriodFromHistory,
  } = (() => {
    if (!isPublicOffer || normalizedPriceHistory.length === 0)
      return { price: null, deposit: null, hasActivePublicOfferPeriod: false };
    const nowTs = Date.now();
    let latestPrice = null;
    let latestDeposit = null;
    let latestTimestamp = null;
    let latestPastPrice = null;
    let latestPastDeposit = null;
    let latestPastTimestamp = null;
    let nearestFuturePrice = null;
    let nearestFutureDeposit = null;
    let nearestFutureTimestamp = null;
    let hasActivePeriod = false;

    for (const entry of normalizedPriceHistory) {
      const { priceNumber, depositNumber, startDate, endDate } = entry;
      if (priceNumber == null) continue;

      const startTs = startDate ? startDate.getTime() : null;
      const endTs = endDate ? endDate.getTime() : null;
      const isCurrent =
        (startTs == null || nowTs >= startTs) &&
        (endTs == null || nowTs < endTs);
      if (isCurrent)
        return {
          price: priceNumber,
          deposit: depositNumber,
          hasActivePublicOfferPeriod: true,
        };

      const candidateTs = startTs ?? endTs;
      const isPastPeriod =
        (endTs != null && endTs <= nowTs)
        || (endTs == null && startTs != null && startTs <= nowTs);

      const isFuturePeriod =
        !isPastPeriod &&
        !isCurrent &&
        candidateTs != null &&
        candidateTs > nowTs;

      if (isPastPeriod && candidateTs != null) {
        if (latestPastTimestamp == null || candidateTs > latestPastTimestamp) {
          latestPastTimestamp = candidateTs;
          latestPastPrice = priceNumber;
          latestPastDeposit = depositNumber ?? latestPastDeposit;
        }
      }

      if (isFuturePeriod) {
        if (nearestFutureTimestamp == null || candidateTs < nearestFutureTimestamp) {
          nearestFutureTimestamp = candidateTs;
          nearestFuturePrice = priceNumber;
          nearestFutureDeposit = depositNumber ?? nearestFutureDeposit;
        }
      }

      if (candidateTs != null && (latestTimestamp == null || candidateTs > latestTimestamp)) {
        latestTimestamp = candidateTs;
        latestPrice = priceNumber;
        latestDeposit = depositNumber ?? latestDeposit;
      } else if (latestTimestamp == null && latestPrice == null) {
        latestPrice = priceNumber;
        latestDeposit = depositNumber ?? latestDeposit;
      }
    }

    const price = latestPastPrice ?? nearestFuturePrice ?? latestPrice;
    const deposit = (() => {
      if (latestPastPrice != null) return latestPastDeposit ?? nearestFutureDeposit ?? latestDeposit;
      if (nearestFuturePrice != null) return nearestFutureDeposit ?? latestDeposit;
      return latestDeposit;
    })();

    return {
      price,
      deposit,
      hasActivePublicOfferPeriod: hasActivePeriod,
    };
  })();
  const hasActivePublicOfferPeriod =
    hasActivePublicOfferPeriodFromHistory || Boolean(timing?.currentPeriod);
  const publicOfferCurrentPrice =
    currentPriceFromHistory
    ?? summaryStartPrice
    ?? firstPeriodPrice
    ?? minimalPeriodPrice
    ?? null;
  const resolvedCurrentPrice = isPublicOffer
    ? publicOfferCurrentPrice
    : summaryCurrentPrice;
  const summaryAuctionStepRaw = resolveAuctionStep(details, item);
  const summaryAuctionStepNumber = parseNumberValue(summaryAuctionStepRaw);
  const summaryAuctionStep =
    summaryAuctionStepNumber != null
      ? summaryAuctionStepNumber
      : summaryAuctionStepRaw;

  const depositBasePrice = (() => {
    if (isPublicOffer) return resolvedCurrentPrice ?? summaryStartPrice ?? null;
    if (isOpenAuction) return summaryStartPrice ?? resolvedCurrentPrice ?? null;
    return resolvedCurrentPrice ?? summaryStartPrice ?? null;
  })();

  const explicitDeposit = pickNumericFromSources(
    [item, details, details?.lot_details],
    [
      "deposit",
      "deposit_amount",
      "depositAmount",
      "deposit_sum",
      "depositSum",
      "pledge",
      "pledge_amount",
      "pledgeAmount",
    ],
  );

  const depositPercent = pickNumericFromSources(
    [item, details, details?.lot_details],
    [
      "deposit_percentage",
      "deposit_percent",
      "depositPercent",
      "deposit_rate",
      "pledge_percent",
      "pledgePercent",
    ],
  );

  const summaryDeposit = (() => {
    if (isPublicOffer) {
      const periodDeposit = hasActivePublicOfferPeriod
        ? depositFromCurrentPeriod ?? timing?.currentPeriod?.depositNumber
        : timing?.upcomingPeriod?.depositNumber ?? depositFromCurrentPeriod;

      if (periodDeposit != null) return periodDeposit;
    }
    if (explicitDeposit != null && explicitDeposit > 0) return explicitDeposit;
    if (
      depositPercent != null &&
      depositPercent > 0 &&
      depositBasePrice != null &&
      Number.isFinite(depositBasePrice) &&
      depositBasePrice > 0
    ) {
      return Math.round((depositBasePrice * depositPercent) / 100);
    }
    if (
      depositBasePrice != null &&
      Number.isFinite(depositBasePrice) &&
      depositBasePrice > 0
    ) {
      return Math.round(depositBasePrice * 0.1);
    }
    return null;
  })();

  const summaryDepositDisplay = summaryDeposit != null ? fmtPrice(summaryDeposit, currency) : "—";

  const tradePriceDirection = isPublicOffer ? "up" : isOpenAuction ? "down" : null;

  const summaryPriceBlocks = (() => {
    const blocks = [];

    if (isPublicOffer) {
      const publicOfferStartPrice = summaryStartPrice ?? firstPeriodPrice ?? null;
      const publicOfferCurrentPrice =
        resolvedCurrentPrice ?? publicOfferStartPrice;
      const publicOfferMinimalPrice =
        minimalPeriodPrice
          ?? minPriceFromHistory
          ?? firstPeriodMinPrice
          ?? firstPeriodPrice
          ?? null;

      blocks.push({
        label: "Текущая цена",
        value: fmtPrice(publicOfferCurrentPrice, currency),
        arrowDirection: tradePriceDirection,
      });
      blocks.push({
        label: "Начальная цена",
        value: fmtPrice(publicOfferStartPrice, currency),
      });
      blocks.push({
        label: "Минимальная цена",
        value: fmtPrice(publicOfferMinimalPrice, currency),
      });
    } else {
      blocks.push({
        label: "Начальная цена",
        value: fmtPrice(summaryStartPrice, currency),
        arrowDirection: tradePriceDirection,
      });
      blocks.push({
        label: isOpenAuction ? "Шаг аукциона" : "Текущая цена",
        value: fmtPrice(
          isOpenAuction
            ? summaryAuctionStep != null && summaryAuctionStep !== ""
              ? summaryAuctionStep
              : summaryCurrentPrice
            : summaryCurrentPrice,
          currency,
        ),
      });
    }

    blocks.push({ label: "Задаток", value: summaryDepositDisplay });

    return blocks;
  })();

  const priceHistoryEntries = normalizedPriceHistory.map((entry) => {
    const priceText =
      entry.priceNumber != null
        ? fmtPrice(entry.priceNumber, currency)
        : formatValueForDisplay("price", entry.fallbackPrice);
    const startText = entry.startDate ? formatDateTime(entry.startDate) : "—";
    const endText = entry.endDate ? formatDateTime(entry.endDate) : "—";

    const nowTs = Date.now();
    const startTs = entry.startDate ? entry.startDate.getTime() : null;
    const endTs = entry.endDate ? entry.endDate.getTime() : null;
    let state = "default";
    if (startTs != null && nowTs >= startTs && (endTs == null || nowTs < endTs)) {
      state = "current";
    } else if (endTs != null && nowTs >= endTs) {
      state = "past";
    }

    const depositNumber =
      isPublicOffer && state === "current" && timing?.currentPeriod?.depositNumber != null
        ? timing.currentPeriod.depositNumber
        : entry.depositNumber;
    const depositText =
      depositNumber != null ? fmtPrice(depositNumber, currency) : "—";

    return {
      key: entry.key,
      priceText,
      depositText,
      startText,
      endText,
      state,
    };
  });

  const [authToken, setAuthToken] = useState(null);
  const [viewCount, setViewCount] = useState(() =>
    parseViewCount(item?.view_count),
  );
  const [openTradeModal, setOpenTradeModal] = useState(false);
  const [openInspectionModal, setOpenInspectionModal] = useState(false);
  const [openAutotekaModal, setOpenAutotekaModal] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isPhotoLightboxOpen, setIsPhotoLightboxOpen] = useState(false);
  const [lightboxPhotoIndex, setLightboxPhotoIndex] = useState(0);
  const [contactingManager, setContactingManager] = useState(false);
  const [contactError, setContactError] = useState(null);

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

  async function handleContactManager() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      const next = `/trades/${listingIdRaw || ""}`;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    if (!listingIdRaw || contactingManager) return;
    setContactError(null);
    setContactingManager(true);
    try {
      const res = await fetch(buildApiUrl("/api/support/tickets/listing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId: listingIdRaw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket?.id) {
        throw new Error(data?.error || "FAILED_TO_CREATE");
      }
      const targetTicketId = data.ticket.id;
      router.push(`/support?ticketId=${targetTicketId}`);
    } catch (error) {
      console.error("contact manager error", error);
      setContactError("Не удалось создать обращение. Попробуйте позже.");
    } finally {
      setContactingManager(false);
    }
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
  const { lotInfoEntries } = partitionLotAndVehicleEntries(lotEntries);
  const filteredLotInfoEntries = lotInfoEntries.filter((entry) => {
    const rawKeyNormalized = normalizeEntryKey(entry?.rawKey);
    if (rawKeyNormalized && LOT_INFO_EXCLUDED_RAW_KEYS.has(rawKeyNormalized)) {
      return false;
    }
    const labelNormalized = normalizeEntryKey(entry?.key);
    if (labelNormalized && LOT_INFO_EXCLUDED_LABELS.has(labelNormalized)) {
      return false;
    }
    return true;
  });
  const vehicleEntries = [];
  const contactEntries = buildKeyValueEntries(details?.contact_details);
  const filteredContactEntries = contactEntries.filter((entry) => {
    const rawKey = normalizeEntryKey(entry?.rawKey);
    const label = normalizeEntryKey(entry?.key);
    return rawKey !== "inspection_procedure" && label !== "порядок осмотра";
  });
  const debtorEntries = buildKeyValueEntries(details?.debtor_details);
  const documents = normalizeDocuments(
    Array.isArray(details?.documents) ? details.documents : [],
  );
  const periodScheduleEntries = periods;
  const periodScheduleDeadline = applicationDeadlineDate;
  const fedresursMeta = details?.fedresurs_meta;

  const actionButtons = [
    {
      key: "contactManager",
      label: contactingManager ? "Открываем чат..." : "Связаться с менеджером",
      onClick: handleContactManager,
      className: "button button-outline",
      disabled: contactingManager,
      title: "Создать тикет для консультации по объявлению",
    },
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

  return (
    <div className="container detail-page">
      <div className="back-link">
        <button
          type="button"
          onClick={handleBackToList}
          className="link"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          ← Назад к списку
        </button>
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
              {summaryPriceBlocks.map((block) => (
                <div className="detail-summary__price" key={block.label}>
                  <div className="detail-summary__price-label">
                    {block.label}
                  </div>
                  <div
                    className="detail-summary__price-value"
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span>{block.value}</span>
                    {block.arrowDirection ? (
                      <PriceDirectionArrow direction={block.arrowDirection} />
                    ) : null}
                  </div>
                </div>
              ))}
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
                      <strong>Приём заявок до:</strong>{" "}
                      {applicationDeadlineLabel}
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
                ),
              )}
            </div>
            {contactError && (
              <div style={{ color: "#dc2626", marginTop: 8, fontSize: 14 }}>{contactError}</div>
            )}
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

          {filteredLotInfoEntries.length > 0 && (
            <section className="detail-section">
              <h2>Сведения о лоте</h2>
              <KeyValueGrid entries={filteredLotInfoEntries} />
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
              <KeyValueGrid entries={filteredContactEntries} />
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

          {!isOpenAuction && priceHistoryEntries.length > 0 && (
            <section className="detail-section">
              <h2>История цен</h2>
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
                    {priceHistoryEntries.map((entry, index) => {
                      const rowStyle = { ...PRICE_CELL_STYLE };
                      let rowBackground;
                      let chip;
                      if (entry.state === "current") {
                        rowStyle.fontWeight = 700;
                        rowBackground = "rgba(37,99,235,0.12)";
                        chip = (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(37,99,235,0.15)",
                              color: "#1d4ed8",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            Текущий период
                          </span>
                        );
                      } else if (entry.state === "past") {
                        rowStyle.color = "#94a3b8";
                        rowBackground = "rgba(148,163,184,0.08)";
                        chip = (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "rgba(148,163,184,0.2)",
                              color: "#475569",
                              fontWeight: 600,
                              fontSize: 12,
                            }}
                          >
                            Завершён
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={entry.key}
                          style={{
                            ...(rowBackground ? { background: rowBackground } : null),
                            ...(entry.state === "current"
                              ? { boxShadow: "inset 3px 0 0 #2563eb" }
                              : null),
                          }}
                        >
                          <td style={rowStyle}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "center",
                                fontWeight: 600,
                              }}
                            >
                              {index + 1}
                            </div>
                          </td>
                          <td style={rowStyle}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span>{entry.startText}</span>
                              {chip}
                            </div>
                          </td>
                          <td style={rowStyle}>{entry.endText}</td>
                          <td style={rowStyle}>{entry.priceText}</td>
                          <td style={rowStyle}>{entry.depositText}</td>
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
          )}
          */}
        </div>
      </div>
    </div>
  );
}


























