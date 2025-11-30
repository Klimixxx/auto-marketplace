alter table parser_trades
  add column if not exists waiting_at timestamp with time zone;
