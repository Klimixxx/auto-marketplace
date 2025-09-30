DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_status') THEN
    IF EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'inspection_status'
         AND e.enumlabel = 'Идет модерация'
    ) THEN
      EXECUTE $$ALTER TYPE inspection_status RENAME VALUE 'Идет модерация' TO 'Оплачен/Ожидание модерации'$$;
    END IF;

    IF EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'inspection_status'
         AND e.enumlabel = 'Выполняется осмотр машины'
    ) THEN
      EXECUTE $$ALTER TYPE inspection_status RENAME VALUE 'Выполняется осмотр машины' TO 'Производится осмотр'$$;
    END IF;

    IF EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'inspection_status'
         AND e.enumlabel = 'Завершен'
    ) THEN
      EXECUTE $$ALTER TYPE inspection_status RENAME VALUE 'Завершен' TO 'Осмотр завершен'$$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'inspection_status'
         AND e.enumlabel = 'Заказ принят, Приступаем к Осмотру'
    ) THEN
      EXECUTE $$ALTER TYPE inspection_status ADD VALUE 'Заказ принят, Приступаем к Осмотру'$$;
    END IF;
  END IF;
END $$;

ALTER TABLE inspections
  ALTER COLUMN status SET DEFAULT 'Оплачен/Ожидание модерации';
