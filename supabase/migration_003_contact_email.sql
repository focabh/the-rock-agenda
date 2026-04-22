-- Migration 003: add contact_email to profiles
-- Run this in the Supabase SQL editor

-- 1. Add contact_email column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_email text;

-- 2. Fix Felipe admin: remove is_admin from the guitarrista_solo user
UPDATE profiles
SET is_admin = false
WHERE role = 'guitarrista_solo'
  AND is_admin = true;

-- 3. Safety: ensure only focabh@gmail.com has is_admin = true among musicians
--    (producers have admin-level access via the app logic, not via is_admin flag)
UPDATE profiles
SET is_admin = false
WHERE is_admin = true
  AND id NOT IN (
    SELECT id FROM auth.users WHERE email = 'focabh@gmail.com'
  );
