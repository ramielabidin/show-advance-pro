-- Add settlement tracking fields to shows table
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS is_settled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_tickets_sold text,
  ADD COLUMN IF NOT EXISTS actual_walkout text,
  ADD COLUMN IF NOT EXISTS settlement_notes text;
