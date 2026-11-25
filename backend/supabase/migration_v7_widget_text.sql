-- ============================================================
-- OneWayChat — Migration v7: customizable widget text
-- Adds the Send button label and the message-input placeholder
-- to per-org settings, so each business can localize the widget
-- composer (e.g. "Enviar" / "Digite uma mensagem...").
-- Run ONCE in the Supabase SQL Editor on existing databases.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
-- Existing rows receive the English defaults; admins can then
-- override them from Settings -> Chat widget text.
-- ============================================================

alter table public.settings
  add column if not exists send_button_text text not null default 'Send';

alter table public.settings
  add column if not exists input_placeholder text not null default 'Type a message...';

-- Backfill any legacy rows where the values are null or blank.
update public.settings
set send_button_text = 'Send'
where send_button_text is null or btrim(send_button_text) = '';

update public.settings
set input_placeholder = 'Type a message...'
where input_placeholder is null or btrim(input_placeholder) = '';
