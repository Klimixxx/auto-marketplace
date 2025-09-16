create table if not exists parser_trades (
  id                uuid primary key default gen_random_uuid(),
  fedresurs_id      text,
  bidding_number    text,
  title             text,
  category          text,
  region            text,
  brand             text,
  model             text,
  year              int,
  vin               text,
  start_price       numeric,
  applications_count int,
  date_start        timestamptz,
  date_finish       timestamptz,
  trade_place       text,
  source_url        text,

  lot_details       jsonb,
  debtor_details    jsonb,
  contact_details   jsonb,
  prices            jsonb,
  documents         jsonb,
  raw_payload       jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists ux_parser_trades_fedresurs
  on parser_trades (fedresurs_id);

create index if not exists ix_parser_trades_brand_model_year
  on parser_trades (brand, model, year);

create index if not exists ix_parser_trades_vin
  on parser_trades (vin);

create index if not exists ix_parser_trades_price
  on parser_trades (start_price);

-- триггер для updated_at
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_parser_trades_updated_at on parser_trades;
create trigger trg_parser_trades_updated_at
before update on parser_trades
for each row execute function set_updated_at();
