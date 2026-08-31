-- Add a start date to orders so the calendar view can show bars
-- spanning from start to due date.
--
-- Run this in the Supabase SQL editor.

ALTER TABLE public.tasks ADD COLUMN start_date date;
