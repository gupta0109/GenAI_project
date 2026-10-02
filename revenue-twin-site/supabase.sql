-- Run in the Supabase SQL editor. The secret key is used only by Vercel functions.
create table if not exists public.revenue_twin_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_key text not null,
  input jsonb not null,
  output jsonb,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'pending' check (status in ('pending', 'complete', 'failed'))
);

create index if not exists revenue_twin_visitor_time_idx
  on public.revenue_twin_requests (visitor_key, created_at desc);

alter table public.revenue_twin_requests enable row level security;
revoke all on public.revenue_twin_requests from anon, authenticated;
grant select, insert, update on public.revenue_twin_requests to service_role;

create or replace function public.reserve_revenue_twin_request(p_visitor_key text, p_input jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_id uuid;
begin
  if p_visitor_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid visitor key';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_visitor_key, 0));
  if (select count(*) from public.revenue_twin_requests
      where visitor_key = p_visitor_key
        and created_at > now() - interval '24 hours'
        and status in ('pending', 'complete')) >= 3 then
    return null;
  end if;
  insert into public.revenue_twin_requests (visitor_key, input)
  values (p_visitor_key, p_input) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.revenue_twin_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'completed', count(*),
    'averageChange', round(avg(
      ((output->>'suggestedRate')::numeric - (input->>'currentRate')::numeric)
    ), 0)
  )
  from public.revenue_twin_requests
  where status = 'complete';
$$;

revoke all on function public.reserve_revenue_twin_request(text, jsonb) from public, anon, authenticated;
revoke all on function public.revenue_twin_stats() from public, anon, authenticated;
grant execute on function public.reserve_revenue_twin_request(text, jsonb) to service_role;
grant execute on function public.revenue_twin_stats() to service_role;
