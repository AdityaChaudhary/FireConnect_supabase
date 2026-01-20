-- Add persona column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS persona TEXT;
