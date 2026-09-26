-- One-off tidy-up: write every label name in capitals (JAHIT, SABLON, ...).
-- Run after 0004_done_at_and_label_case.sql, which merges names that differ
-- only by case; without it two spellings could collide here. Safe to re-run.
-- New labels keep whatever capitals are typed; matching ignores case, so
-- typing "sablon" still reuses "SABLON".

update public.labels set name = upper(name) where name <> upper(name);
