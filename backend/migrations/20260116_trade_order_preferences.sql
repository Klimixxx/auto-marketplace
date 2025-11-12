-- 20260116_trade_order_preferences.sql
-- Добавляет поля для хранения ценовых предпочтений клиента при заявке на сопровождение торгов.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_orders' AND column_name = 'auction_bid_limit'
  ) THEN
    ALTER TABLE trade_orders ADD COLUMN auction_bid_limit NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_orders' AND column_name = 'public_offer_price'
  ) THEN
    ALTER TABLE trade_orders ADD COLUMN public_offer_price NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trade_orders' AND column_name = 'price_notes'
  ) THEN
    ALTER TABLE trade_orders ADD COLUMN price_notes TEXT;
  END IF;
END
$$;
