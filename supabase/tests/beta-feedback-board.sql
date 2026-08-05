\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-author@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-reader@example.test', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

insert into public.feedback_items (id, user_id, kind, title, body)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'idea', 'Undo a completed set', 'Let me reset a set I mis-tapped.');

select case when count(*) = 1 then 'PASS: author reads their own submitted item' else 'FAIL: author cannot read their own item' end as author_read_test
from public.feedback_items where id = '00000000-0000-0000-0000-0000000000a1';

do $$
begin
  begin
    insert into public.feedback_items (user_id, kind, title, body)
    values ('00000000-0000-0000-0000-0000000000f2', 'idea', 'Impersonated submission', 'Should be rejected.');
    raise exception 'FAIL: inserting feedback as another user unexpectedly succeeded';
  exception when others then
    if position('FAIL:' in sqlerrm) > 0 then raise; end if;
    raise notice 'PASS: inserting feedback as another user rejected';
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);

select case when count(*) = 1 then 'PASS: a different authenticated user reads another user''s item on the shared board' else 'FAIL: shared board is not readable across users' end as cross_user_read_test
from public.feedback_items where id = '00000000-0000-0000-0000-0000000000a1';

insert into public.feedback_votes (item_id, user_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f2');

select case when count(*) = 1 then 'PASS: reader casts a vote on another user''s item' else 'FAIL: reader could not cast a vote' end as vote_cast_test
from public.feedback_votes where item_id = '00000000-0000-0000-0000-0000000000a1' and user_id = '00000000-0000-0000-0000-0000000000f2';

do $$
begin
  begin
    insert into public.feedback_votes (item_id, user_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f2');
    raise exception 'FAIL: a duplicate vote unexpectedly succeeded';
  exception when unique_violation then
    raise notice 'PASS: the (item_id, user_id) primary key rejects a duplicate vote';
  end;
  begin
    insert into public.feedback_votes (item_id, user_id)
    values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL: casting a vote as another user unexpectedly succeeded';
  exception when others then
    if position('FAIL:' in sqlerrm) > 0 then raise; end if;
    raise notice 'PASS: casting a vote as another user rejected';
  end;
end;
$$;

reset role;

-- Founder hides the item (service_role -- no client-facing update path exists).
set local role service_role;
update public.feedback_items set status = 'hidden' where id = '00000000-0000-0000-0000-0000000000a1';
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);

select case when count(*) = 0 then 'PASS: a hidden item is invisible to a non-author' else 'FAIL: a hidden item leaked to a non-author' end as hidden_from_others_test
from public.feedback_items where id = '00000000-0000-0000-0000-0000000000a1';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

select case when count(*) = 1 then 'PASS: a hidden item stays visible to its author' else 'FAIL: a hidden item disappeared for its own author' end as hidden_visible_to_author_test
from public.feedback_items where id = '00000000-0000-0000-0000-0000000000a1';

reset role;

rollback;
