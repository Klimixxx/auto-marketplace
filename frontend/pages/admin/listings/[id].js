import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/+$/, '');

function fmtPrice(value, currency = 'RUB') {
  try {
    if (value == null || value === '') return '—';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const tzOffset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - tzOffset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
}

function formatObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }
  return JSON.stringify({}, null, 2);
}

function formatArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : [], null, 2);
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function normalizePhotoInput(photo) {
  if (!photo) return null;
  if (typeof photo === 'string') {
    const trimmed = photo.trim();
    return trimmed ? { url: trimmed } : null;
  }
  if (typeof photo === 'object') {
    const url = photo.url || photo.href || photo.link || photo.download_url || photo.src || null;
    if (!url) return null;
    const title = photo.title || photo.name || photo.caption || null;
    return title ? { url, title } : { url };
  }
  return null;
}

function extractPhotos(trade) {
  if (!trade) return [];
  const sources = [
    trade.photos,
    trade.lot_details?.photos,
    trade.lot_details?.images,
    trade.lot_details?.gallery,
  ];
  const urls = [];
  const seen = new Set();
  for (const list of sources) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const normalized = normalizePhotoInput(entry);
      if (normalized?.url && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        urls.push(normalized.url);
      }
    }
  }
  return urls;
}

function parsePhotosInput(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error('Некорректный JSON фотографий.');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('JSON фотографий должен быть массивом.');
    }
    const result = [];
    for (const entry of parsed) {
      const normalized = normalizePhotoInput(entry);
      if (normalized) result.push(normalized);
    }
    return result;
  }
  return trimmed
    .split('\n')
    .map((line) => normalizePhotoInput(line))
    .filter(Boolean);
}

function getPhotoPreview(text) {
  try {
    return parsePhotosInput(text).map((photo) => photo.url);
  } catch {
    return [];
  }
}


export default function AdminParserTradeCard() {
  const router = useRouter();
  const { id } = router.query;
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [lotDetailsText, setLotDetailsText] = useState('{}');
  const [contactDetailsText, setContactDetailsText] = useState('{}');
  const [debtorDetailsText, setDebtorDetailsText] = useState('{}');
  const [pricesText, setPricesText] = useState('[]');
  const [documentsText, setDocumentsText] = useState('[]');
  const [photosText, setPhotosText] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const applyTrade = useCallback((trade) => {
    if (!trade) return;
    setItem(trade);
    setForm({
      title: trade.title || '',
      description: trade.description || trade.lot_details?.description || '',
      category: trade.category || '',
      region: trade.region || '',
      brand: trade.brand || '',
      model: trade.model || '',
      year: trade.year ? String(trade.year) : '',
      vin: trade.vin || '',
      start_price: trade.start_price != null ? String(trade.start_price) : '',
      applications_count: trade.applications_count != null ? String(trade.applications_count) : '',
      trade_place: trade.trade_place || '',
      source_url: trade.source_url || '',
      bidding_number: trade.bidding_number || '',
      date_start: toInputDate(trade.date_start),
      date_finish: toInputDate(trade.date_finish),
    });
    setLotDetailsText(formatObject(trade.lot_details));
    setContactDetailsText(formatObject(trade.contact_details));
    setDebtorDetailsText(formatObject(trade.debtor_details));
    setPricesText(formatArray(trade.prices));
    setDocumentsText(formatArray(trade.documents));
    const photos = extractPhotos(trade);
    setPhotosText(photos.join('\n'));
  }, []);

  const fetchTrade = useCallback(async () => {
    if (!API_BASE) {
      throw new Error('NEXT_PUBLIC_API_BASE не задан. Невозможно загрузить данные объявления.');
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.replace('/login');
      throw new Error('AUTH_REQUIRED');
    }
    const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new Error(data?.error || 'Не удалось загрузить объявление');
    }
    return data;
  }, [id, router]);

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;

    setLoading(true);
    fetchTrade()
      .then((data) => {
        if (!cancelled && data) {
          applyTrade(data);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.message === 'AUTH_REQUIRED') return;
        alert(error.message || 'Не удалось загрузить объявление');
        router.replace('/admin/listings');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, id, fetchTrade, applyTrade, router]);

  const updateFormField = (field) => (event) => {
    const value = event.target.value;
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const photoPreview = useMemo(() => getPhotoPreview(photosText), [photosText]);

  const resetChanges = useCallback(() => {
    if (item) {
      applyTrade(item);
    }
  }, [item, applyTrade]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!form) return;

      if (!API_BASE) {
        alert('NEXT_PUBLIC_API_BASE не задан. Невозможно сохранить объявление.');
        return;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        router.replace('/login');
        return;
      }

      let lotDetails = null;
      const lotText = lotDetailsText.trim();
      if (lotText) {
        try {
          const parsed = JSON.parse(lotText);
          if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
            throw new Error();
          }
          lotDetails = parsed;
        } catch {
          alert('Поле «Детали лота» должно содержать корректный JSON-объект.');
          return;
        }
      }

      let contactDetails = null;
      const contactText = contactDetailsText.trim();
      if (contactText) {
        try {
          const parsed = JSON.parse(contactText);
          if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
            throw new Error();
          }
          contactDetails = parsed;
        } catch {
          alert('Поле «Контакты» должно содержать корректный JSON-объект.');
          return;
        }
      }

      let debtorDetails = null;
      const debtorText = debtorDetailsText.trim();
      if (debtorText) {
        try {
          const parsed = JSON.parse(debtorText);
          if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
            throw new Error();
          }
          debtorDetails = parsed;
        } catch {
          alert('Поле «Должник» должно содержать корректный JSON-объект.');
          return;
        }
      }

      let prices = [];
      const pricesTrimmed = pricesText.trim();
      if (pricesTrimmed) {
        try {
          const parsed = JSON.parse(pricesTrimmed);
          if (!Array.isArray(parsed)) {
            throw new Error();
          }
          prices = parsed;
        } catch {
          alert('Поле «Периоды цен» должно содержать JSON-массив.');
          return;
        }
      }

      let documents = [];
      const documentsTrimmed = documentsText.trim();
      if (documentsTrimmed) {
        try {
          const parsed = JSON.parse(documentsTrimmed);
          if (!Array.isArray(parsed)) {
            throw new Error();
          }
          documents = parsed;
        } catch {
          alert('Поле «Документы» должно содержать JSON-массив.');
          return;
        }
      }

      let photos;
      try {
        photos = parsePhotosInput(photosText);
      } catch (error) {
        alert(error.message || 'Некорректный список фотографий.');
        return;
      }

      const payload = {
        title: trimOrNull(form.title),
        description: trimOrNull(form.description),
        category: trimOrNull(form.category),
        region: trimOrNull(form.region),
        brand: trimOrNull(form.brand),
        model: trimOrNull(form.model),
        year: trimOrNull(form.year),
        vin: trimOrNull(form.vin),
        start_price: trimOrNull(form.start_price),
        applications_count: trimOrNull(form.applications_count),
        trade_place: trimOrNull(form.trade_place),
        source_url: trimOrNull(form.source_url),
        bidding_number: trimOrNull(form.bidding_number),
        date_start: fromInputDate(form.date_start),
        date_finish: fromInputDate(form.date_finish),
        lot_details: lotDetails,
        contact_details: contactDetails,
        debtor_details: debtorDetails,
        prices,
        documents,
        photos,
      };

      setSaving(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (res.status === 401) {
          router.replace('/login');
          throw new Error('AUTH_REQUIRED');
        }
        if (!res.ok || !data) {
          throw new Error(data?.error || 'Не удалось сохранить изменения');
        }
        applyTrade(data);
        alert('Изменения сохранены.');
      } catch (error) {
        if (error.message !== 'AUTH_REQUIRED') {
          alert(error.message || 'Сохранение не удалось');
        }
      } finally {
        setSaving(false);
      }
    },
    [
      form,
      lotDetailsText,
      contactDetailsText,
      debtorDetailsText,
      pricesText,
      documentsText,
      photosText,
      id,
      applyTrade,
      router,
    ],
  );

  const publishTrade = useCallback(async () => {
    if (!API_BASE) {
      alert('NEXT_PUBLIC_API_BASE не задан. Невозможно опубликовать объявление.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/parser-trades/${id}/publish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) {
        router.replace('/login');
        throw new Error('AUTH_REQUIRED');
      }
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Не удалось опубликовать объявление');
      }
      alert('Объявление опубликовано и доступно на странице «Торги».');
      const refreshed = await fetchTrade().catch((error) => {
        if (error.message !== 'AUTH_REQUIRED') {
          console.warn('Не удалось обновить объявление после публикации:', error);
        }
        return null;
      });
      if (refreshed) {
        applyTrade(refreshed);
      }
    } catch (error) {
      if (error.message !== 'AUTH_REQUIRED') {
        alert(error.message || 'Ошибка публикации');
      }
    } finally {
      setPublishing(false);
    }
  }, [id, applyTrade, fetchTrade, router]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/listings" className="link">
            ← Назад
          </Link>
        </div>
        <p>Загрузка...</p>
      </div>
    );
  }

  if (!item || !form) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/admin/listings" className="link">
            ← Назад
          </Link>
        </div>
        <p>Объявление не найдено.</p>
      </div>
    );
  }

  const d = item;
  const titlePreview = form.title?.trim() || d.title || 'Лот';
  const metaPreview = [form.region?.trim() || d.region, form.category?.trim() || d.category]
    .filter(Boolean)
    .join(' • ') || '—';
  const vehiclePreview = [form.brand?.trim() || d.brand, form.model?.trim() || d.model, form.year?.trim() || d.year]
    .filter(Boolean)
    .join(' ') || '—';
  const vinPreview = form.vin?.trim() || d.vin || '—';
  const parsedStart = form.start_price?.trim()
    ? Number(form.start_price.replace(/\s/g, '').replace(',', '.'))
    : null;
  const startPricePreview = form.start_price?.trim()
    ? (Number.isFinite(parsedStart) ? fmtPrice(parsedStart) : form.start_price)
    : fmtPrice(d.start_price);
  const endDatePreview = form.date_finish?.trim()
    ? formatDateTime(form.date_finish)
    : formatDateTime(d.date_finish);
  const applicationsPreview = form.applications_count?.trim()
    || (d.applications_count != null ? String(d.applications_count) : '—');
  const tradePlacePreview = form.trade_place?.trim() || d.trade_place || '—';
  const biddingPreview = form.bidding_number?.trim() || d.bidding_number || '—';
  const savedDescription = d.description || d.lot_details?.description;
  const descriptionPreview = form.description?.trim() || savedDescription || '';
  const sourceLink = form.source_url?.trim() || d.source_url || '';

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 32 }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/admin/listings" className="link">
          ← Назад
        </Link>
      </div>

      <h1 style={{ marginBottom: 4 }}>{titlePreview}</h1>
      <div className="muted" style={{ marginBottom: 12 }}>{metaPreview}</div>

      <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        ID: {d.id}
        {d.fedresurs_id ? ` • Fedresurs: ${d.fedresurs_id}` : ''}
        {d.created_at ? ` • Получено: ${formatDateTime(d.created_at)}` : ''}
      </div>

      {d.published_at && (
        <div className="badge" style={{ display: 'inline-block', marginBottom: 12 }}>
          Опубликовано {formatDateTime(d.published_at)}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 12,
        }}
      >
        <div className="panel">
          <div className="muted">ТС</div>
          <div className="big">{vehiclePreview}</div>
        </div>
        <div className="panel">
          <div className="muted">VIN</div>
          <div className="big">{vinPreview}</div>
        </div>
        <div className="panel">
          <div className="muted">Стартовая цена</div>
          <div className="big">{startPricePreview}</div>
        </div>
        <div className="panel">
          <div className="muted">Окончание</div>
          <div className="big">{endDatePreview}</div>
        </div>
        <div className="panel">
          <div className="muted">Номер торгов</div>
          <div className="big">{biddingPreview}</div>
        </div>
        <div className="panel">
          <div className="muted">Заявок</div>
          <div className="big">{applicationsPreview}</div>
        </div>
        <div className="panel">
          <div className="muted">Площадка</div>
          <div className="big">{tradePlacePreview}</div>
        </div>
      </div>

      {sourceLink && (
        <div style={{ marginTop: 12 }}>
          <a href={sourceLink} target="_blank" rel="noreferrer" className="link">
            Открыть источник
          </a>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="panel"
        style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <h2>Редактирование объявления</h2>
        <div className="muted" style={{ fontSize: 13 }}>
          Измените данные перед публикацией. JSON-поля можно оставить пустыми — они заполнятся пустыми объектами или массивами.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Заголовок</span>
            <input className="input" value={form.title} onChange={updateFormField('title')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Номер торгов</span>
            <input className="input" value={form.bidding_number} onChange={updateFormField('bidding_number')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Категория</span>
            <input className="input" value={form.category} onChange={updateFormField('category')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Регион</span>
            <input className="input" value={form.region} onChange={updateFormField('region')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Марка</span>
            <input className="input" value={form.brand} onChange={updateFormField('brand')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Модель</span>
            <input className="input" value={form.model} onChange={updateFormField('model')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Год</span>
            <input className="input" value={form.year} onChange={updateFormField('year')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">VIN</span>
            <input className="input" value={form.vin} onChange={updateFormField('vin')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Стартовая цена</span>
            <input className="input" value={form.start_price} onChange={updateFormField('start_price')} placeholder="Например, 1500000" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Кол-во заявок</span>
            <input className="input" value={form.applications_count} onChange={updateFormField('applications_count')} type="number" min="0" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Дата начала</span>
            <input className="input" value={form.date_start} onChange={updateFormField('date_start')} type="datetime-local" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Дата окончания</span>
            <input className="input" value={form.date_finish} onChange={updateFormField('date_finish')} type="datetime-local" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Площадка</span>
            <input className="input" value={form.trade_place} onChange={updateFormField('trade_place')} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="muted">Ссылка на источник</span>
            <input className="input" value={form.source_url} onChange={updateFormField('source_url')} type="url" />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Описание</span>
          <textarea
            className="textarea"
            rows={4}
            value={form.description}
            onChange={updateFormField('description')}
            placeholder="Текст описания для публикации"
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Фотографии (каждый URL с новой строки или JSON-массив)</span>
          <textarea
            className="textarea"
            rows={4}
            value={photosText}
            onChange={(event) => setPhotosText(event.target.value)}
            placeholder="https://...jpg"
            spellCheck={false}
          />
        </label>

        {photoPreview.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
            {photoPreview.map((url, index) => (
              <div key={`${url}-${index}`} className="panel" style={{ padding: 8 }}>
                <img
                  src={url}
                  alt={`Фото ${index + 1}`}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
                />
                <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-word' }}>{url}</div>
              </div>
            ))}
          </div>
        )}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Детали лота (JSON)</span>
          <textarea
            className="textarea"
            rows={8}
            value={lotDetailsText}
            onChange={(event) => setLotDetailsText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Контакты (JSON)</span>
          <textarea
            className="textarea"
            rows={6}
            value={contactDetailsText}
            onChange={(event) => setContactDetailsText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Должник (JSON)</span>
          <textarea
            className="textarea"
            rows={6}
            value={debtorDetailsText}
            onChange={(event) => setDebtorDetailsText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Периоды цен (JSON-массив)</span>
          <textarea
            className="textarea"
            rows={6}
            value={pricesText}
            onChange={(event) => setPricesText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted">Документы (JSON-массив)</span>
          <textarea
            className="textarea"
            rows={6}
            value={documentsText}
            onChange={(event) => setDocumentsText(event.target.value)}
            spellCheck={false}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="submit" className="button primary" disabled={saving || publishing}>
            {saving ? 'Сохранение…' : 'Сохранить изменения'}
          </button>
          <button type="button" className="button outline" onClick={resetChanges} disabled={saving || publishing}>
            Сбросить изменения
          </button>
          <button type="button" className="button" onClick={publishTrade} disabled={saving || publishing}>
            {publishing ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>
      </form>

      {descriptionPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>Описание</h2>
          <div style={{ whiteSpace: 'pre-wrap' }}>{descriptionPreview}</div>
        </section>
      )}

      {d.lot_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Характеристики</h2>
          <div className="panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {Object.entries(d.lot_details).map(([key, value]) => (
              <div
                key={key}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
              >
                <div className="muted">{key}</div>
                <div style={{ fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>
                  {String(value ?? '—')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.contact_details && (
        <section style={{ marginTop: 24 }}>
          <h2>Контакты</h2>
@@ -184,82 +789,108 @@ export default function AdminParserTradeCard() {
              </div>
            )}
            {d.contact_details.email && (
              <div>
                <span className="muted">Email: </span>
                <a className="link" href={`mailto:${d.contact_details.email}`}>
                  {d.contact_details.email}
                </a>
              </div>
            )}
            {d.contact_details.address && (
              <div>
                <span className="muted">Адрес: </span>
                {d.contact_details.address}
              </div>
            )}
            {d.contact_details.inspection_procedure && (
              <div className="muted" style={{ whiteSpace: 'pre-wrap' }}>
                Осмотр: {d.contact_details.inspection_procedure}
              </div>
            )}
          </div>
        </section>
      )}

      {Array.isArray(d.photos) && d.photos.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Фотографии (сохранённые)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            {d.photos.map((photo, index) => {
              const normalized = normalizePhotoInput(photo);
              if (!normalized) return null;
              return (
                <div key={normalized.url || index} className="panel" style={{ padding: 8 }}>
                  <img
                    src={normalized.url}
                    alt={normalized.title || `Фото ${index + 1}`}
                    style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }}
                  />
                  <div className="muted" style={{ marginTop: 6, fontSize: 12, wordBreak: 'break-word' }}>
                    {normalized.title || normalized.url}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {Array.isArray(d.documents) && d.documents.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Документы</h2>
          <ul style={{ paddingLeft: 18 }}>
            {d.documents.map((doc, index) => (
              <li key={index}>
                <a href={doc.url} target="_blank" rel="noreferrer" className="link">
                  {doc.name || doc.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {Array.isArray(d.prices) && d.prices.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2>Периоды цен</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Период</th>
                  <th>Цена</th>
                  <th>Задаток</th>
                  <th>Примечание</th>
                </tr>
              </thead>
              <tbody>
                {d.prices.map((price, index) => (
                  <tr key={index}>
                    <td>
                      {[price?.startDate || price?.start_date, price?.endDate || price?.end_date]
                        .filter(Boolean)
                        .join(' — ') || '—'}
                    </td>
                    <td>
                      {fmtPrice(
                        Number(price?.price ?? price?.currentPrice ?? price?.current_price) || null,
                        d.currency || 'RUB',
                      )}
                    </td>
                    <td>
                      {fmtPrice(
                        Number(price?.deposit ?? price?.depositAmount ?? price?.deposit_amount) || null,
                        d.currency || 'RUB',
                      )}
                    </td>
                    <td>{price?.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
