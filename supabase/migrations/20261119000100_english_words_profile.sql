-- Private profile fields. Existing accounts and other applications are unchanged.
alter table public.ew_profiles
 add column first_name text check (first_name is null or (char_length(first_name) between 1 and 60 and first_name !~ '[[:cntrl:]]')),
 add column last_name text check (last_name is null or (char_length(last_name) between 1 and 60 and last_name !~ '[[:cntrl:]]')),
 add column nickname text check (nickname is null or nickname ~ '^[[:alnum:]_.]{3,24}$'),
 add column avatar_data text check (avatar_data is null or (char_length(avatar_data) <= 120000 and avatar_data ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$'));

-- Existing RLS policies still apply: only the owner can read or edit these fields.
-- display_name remains the public nickname used by ew_sync_profile on first publication.
comment on column public.ew_profiles.avatar_data is 'Private, size-limited raster thumbnail. Never included in auth metadata or learning backups.';
