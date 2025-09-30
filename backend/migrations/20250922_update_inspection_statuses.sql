-- 20250922_update_inspection_statuses.sql
-- Цель: привести enum значений статуса к канону и добавить недостающее значение.
-- Канон:
--   'Оплачен/Ожидание модерации'
--   'Заказ принят, Приступаем к Осмотру'
--   'Производится осмотр'
--   'Осмотр завершен'

-- 1) Создаем новый тип с целевыми значениями
DO $m$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status_v2') THEN
    EXECUTE $q$
      CREATE TYPE inspection_status_v2 AS ENUM (
        'Оплачен/Ожидание модерации',
        'Заказ принят, Приступаем к Осмотру',
        'Производится осмотр',
        'Осмотр завершен'
      )
    $q$;
  END IF;
END
$m$;

-- 2) Добавляем временную колонку нового типа
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS status_new inspection_status_v2;

-- 3) Переносим данные с маппингом старых ярлыков к новым
UPDATE inspections
SET status_new = CASE
  WHEN status::text = 'Идет модерация'
    THEN 'Оплачен/Ожидание модерации'::inspection_status_v2
  WHEN status::text = 'Выполняется осмотр машины'
    THEN 'Производится осмотр'::inspection_status_v2
  WHEN status::text = 'Завершен'
    THEN 'Осмотр завершен'::inspection_status_v2
  WHEN status::text = 'Оплачен/Ожидание модерации'
    THEN 'Оплачен/Ожидание модерации'::inspection_status_v2
  WHEN status::text = 'Заказ принят, Приступаем к Осмотру'
    THEN 'Заказ принят, Приступаем к Осмотру'::inspection_status_v2
  WHEN status::text = 'Производится осмотр'
    THEN 'Производится осмотр'::inspection_status_v2
  WHEN status::text = 'Осмотр завершен'
    THEN 'Осмотр завершен'::inspection_status_v2
  ELSE NULL
END;

-- 4) Снимаем дефолт, удаляем старую колонку, переименовываем новую
ALTER TABLE inspections ALTER COLUMN status DROP DEFAULT;
ALTER TABLE inspections DROP COLUMN status;
ALTER TABLE inspections RENAME COLUMN status_new TO status;

-- 5) Выставляем дефолт на новое значение
ALTER TABLE inspections
  ALTER COLUMN status SET DEFAULT 'Оплачен/Ожидание модерации'::inspection_status_v2;

-- 6) Чистим старый тип и переименовываем v2 -> оригинальное имя
DO $m$
DECLARE
  has_old boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'inspection_status') INTO has_old;

  IF has_old THEN
    -- На этом этапе зависимостей быть не должно
    EXECUTE 'DROP TYPE inspection_status';
  END IF;

  IF EXISTS(SELECT 1 FROM pg_type WHERE typname = '' || 'inspection_status_v2')  -- защита от инлайн-подстановки
     AND NOT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
    EXECUTE 'ALTER TYPE inspection_status_v2 RENAME TO inspection_status';
  END IF;
END
$m$;
