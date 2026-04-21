-- Add destinations (JSONB array of {name, lat, lng}) and ai_notes columns to trips table
-- Run this in Supabase SQL Editor

ALTER TABLE trips ADD COLUMN IF NOT EXISTS destinations JSONB DEFAULT '[]';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ai_notes JSONB DEFAULT NULL;

-- Optional: allow trip members to update ai_notes (if your RLS restricts updates to owner only)
-- Uncomment the policy below if members cannot save notes:
--
-- CREATE POLICY "trip_members_can_update_ai_notes" ON trips
-- FOR UPDATE USING (
--   auth.uid() = user_id
--   OR EXISTS (
--     SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()
--   )
-- )
-- WITH CHECK (
--   auth.uid() = user_id
--   OR EXISTS (
--     SELECT 1 FROM trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid()
--   )
-- );
