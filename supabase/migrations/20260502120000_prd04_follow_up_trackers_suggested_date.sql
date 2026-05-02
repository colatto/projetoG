-- PRD-04 Follow-up Logístico — formal ownership of suggested_date on follow_up_trackers
--
-- PRD-04 §4.1 (followup_tracking) requires optional suggested_date on the tracker when the
-- supplier proposes a new promised date. The column was created in initial_schema_v1; this
-- migration adds it idempotently so PRD-04 ownership is explicit in the migration timeline.

ALTER TABLE public.follow_up_trackers
  ADD COLUMN IF NOT EXISTS suggested_date date;
