-- ============================================================================
-- SMITTEN — sample seed data matching the front-end mockups in /
-- Run AFTER schema.sql. Assumes matching auth.users rows already exist
-- (Supabase requires auth.users before public.users can reference them) —
-- swap these uuids for real `auth.users.id` values from your project,
-- or use `supabase auth admin create-user` first.
-- ============================================================================

-- ---- section definitions (the 15 reusable section types from the spec) ----
insert into public.section_definitions (key, label, config_schema) values
  ('hero',      'Hero',            '{"fields":["title","subtitle","image","alignment","animation"]}'),
  ('photo',     'Photo',           '{"fields":["image","caption","layout"]}'),
  ('gallery',   'Gallery',         '{"fields":["images","ordering","layout"]}'),
  ('message',   'Message',         '{"fields":["body"]}'),
  ('love_letter','Love Letter',    '{"fields":["body","signature"]}'),
  ('date',      'Date',            '{"fields":["date","time","timezone"]}'),
  ('venue',     'Venue',           '{"fields":["venue","address","map_link"]}'),
  ('food',      'Food question',   '{"fields":["question","options"]}'),
  ('activity',  'Activity',        '{"fields":["options"]}'),
  ('question',  'Question',        '{"fields":["prompt","type","options"]}'),
  ('countdown', 'Countdown',       '{"fields":["target_datetime"]}'),
  ('bouquet',   'Bouquet',         '{"fields":["bouquet_type","order_ref"]}'),
  ('card',      'Card',            '{"fields":["message"]}'),
  ('reveal',    'Reveal',          '{"fields":["steps"]}'),
  ('final_response','Final Response','{"fields":["options"]}')
on conflict (key) do nothing;

-- ---- official templates (the six shown on /templates) ----
insert into public.templates (id, name, slug, description, is_official, is_published, theme) values
  ('11111111-1111-1111-1111-111111111101','Puppy Love','puppy-love','Playful and warm — big rounded type, soft pink washes.',true,true,'{"accent":"#FF6F9C"}'),
  ('11111111-1111-1111-1111-111111111102','Sunshine','sunshine','Bright and golden — daytime plans, picnics, brunches.',true,true,'{"accent":"#FFC94A"}'),
  ('11111111-1111-1111-1111-111111111103','Cozy','cozy','Soft lavender and hand-written notes — quiet evenings.',true,true,'{"accent":"#B9A6E8"}'),
  ('11111111-1111-1111-1111-111111111104','Confetti','confetti','Celebratory — birthdays, anniversaries.',true,true,'{"accent":"#5FCBA6"}'),
  ('11111111-1111-1111-1111-111111111105','Rainy Day','rainy-day','Slow and soft — indoor plans, movie nights.',true,true,'{"accent":"#B9A6E8"}'),
  ('11111111-1111-1111-1111-111111111106','Midnight Snack','midnight-snack','A little mysterious, a little sweet — late dinners.',true,false,'{"accent":"#FF6F9C"}')
on conflict (id) do nothing;

-- Puppy Love's sections, in order (illustrates template_sections usage)
insert into public.template_sections (template_id, section_def_id, "order", visible, content)
select '11111111-1111-1111-1111-111111111101',
       id,
       row_number() over (order by array_position(array['hero','photo','date','venue','food','final_response'], key)),
       true,
       '{}'::jsonb
from public.section_definitions
where key in ('hero','photo','date','venue','food','final_response');

-- ---- NOTE ----
-- public.users / public.profiles / public.invitations rows are intentionally
-- NOT seeded here because they require real auth.users(id) values. Example:
--
--   insert into public.users (id, email, mobile, email_verified)
--   values ('<auth-user-uuid>', 'aniket@email.com', '+919876543210', true);
--
--   insert into public.profiles (user_id, full_name, display_name, bio)
--   values ('<auth-user-uuid>', 'Aniket Sharma', 'Aniket',
--           'Terrible at texting, better at planning surprises.');
--
-- See README.md → "Seeding real users" for the full walkthrough.
