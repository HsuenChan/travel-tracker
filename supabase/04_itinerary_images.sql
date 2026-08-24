-- Itinerary item images (multiple per item)
alter table itinerary_items add column if not exists image_urls text[] default '{}';

-- Migrate from the earlier single-image column if this script's previous version was run
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'itinerary_items' and column_name = 'image_url'
  ) then
    update itinerary_items
    set image_urls = array[image_url]
    where image_url is not null and (image_urls is null or image_urls = '{}');
    alter table itinerary_items drop column image_url;
  end if;
end $$;

-- Public-read bucket; uploads go through the API with the service role
insert into storage.buckets (id, name, public)
values ('itinerary-images', 'itinerary-images', true)
on conflict (id) do nothing;
