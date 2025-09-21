import { useEffect, useState } from 'react';
import { translateValueByKey } from '../lib/lotFormatting';

const ASSET_TYPE_ALIASES = {
  авто: 'car',
  автомобиль: 'car',
  автомобили: 'car',
  машина: 'car',
  машины: 'car',
  легковой: 'car',
  легковые: 'car',
  грузовик: 'truck',
  грузовые: 'truck',
  грузовая: 'truck',
  спецтехника: 'special_equipment',
  спецтех: 'special_equipment',
  спец: 'special_equipment',
  недвижимость: 'real_estate',
  квартира: 'real_estate',
  квартиры: 'real_estate',
  дом: 'real_estate',
  дома: 'real_estate',
  помещение: 'real_estate',
  помещения: 'real_estate',
  земля: 'land',
  участок: 'land',
  участки: 'land',
  мотоцикл: 'moto',
  мотоциклы: 'moto',
};

function normalizeAssetType(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (ASSET_TYPE_ALIASES[lower]) return ASSET_TYPE_ALIASES[lower];
  return trimmed;
}

function humanizeAssetType(value) {
  if (!value) return '';
  const translated = translateValueByKey('asset_type', value);
  return typeof translated === 'string' ? translated : value;
}

export default function FilterBar({ onSearch, initial }) {
  const [q, setQ] = useState(initial?.q || '');
  const [region, setRegion] = useState(initial?.region || '');
  const [asset_type, setType] = useState(initial?.asset_type ? humanizeAssetType(initial.asset_type) : '');
  const [minPrice, setMin] = useState(initial?.minPrice || '');
  const [maxPrice, setMax] = useState(initial?.maxPrice || '');

  useEffect(() => {
    if (!initial) return;
    setQ(initial.q || '');
    setRegion(initial.region || '');
    setType(initial.asset_type ? humanizeAssetType(initial.asset_type) : '');
    setMin(initial.minPrice || '');
    setMax(initial.maxPrice || '');
  }, [initial]);

  function submit(e) {
    e.preventDefault();
    onSearch({ q, region, asset_type: normalizeAssetType(asset_type), minPrice, maxPrice });
  }

  return (
    <form onSubmit={submit} className="card filter-form">
      <input
        className="input"
        placeholder="Поиск по названию"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="filter-form__row">
        <input
          className="input"
          placeholder="Регион"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        />
        <input
          className="input"
          placeholder="Тип актива (например, авто)"
          value={asset_type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>
      <div className="filter-form__row">
        <input
          className="input"
          placeholder="Мин. цена"
          value={minPrice}
          onChange={(e) => setMin(e.target.value)}
        />
        <input
          className="input"
          placeholder="Макс. цена"
          value={maxPrice}
          onChange={(e) => setMax(e.target.value)}
        />
      </div>
      <button className="button" type="submit">Показать</button>
    </form>
  );
}
