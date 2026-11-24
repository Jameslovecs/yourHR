-- All application tables are private to the API function. No anon/authenticated
-- table grants: every read and write crosses the explicit ownership checks below.
create table public.yourhr_accounts (
 id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('candidate','recruiter')),
 name text not null, company text not null default '', profile jsonb not null,
 agent text not null default 'Hiring agent', created_at timestamptz not null default now()
);
create table public.yourhr_jobs (
 id uuid primary key default gen_random_uuid(), recruiter_id uuid not null references public.yourhr_accounts(id) on delete cascade,
 data jsonb not null, created_at timestamptz not null default now()
);
create table public.yourhr_screenings (
 id uuid primary key default gen_random_uuid(), job_id uuid not null references public.yourhr_jobs(id) on delete cascade,
 candidate_id uuid not null references public.yourhr_accounts(id) on delete cascade,
 recruiter_id uuid not null references public.yourhr_accounts(id) on delete cascade,
 data jsonb not null, created_at timestamptz not null default now(), unique(job_id,candidate_id)
);
create table public.yourhr_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid references public.yourhr_accounts(id) on delete cascade,
 job_id uuid references public.yourhr_jobs(id) on delete cascade, reason text not null, created_at timestamptz not null default now()
);
create table public.yourhr_limits (account_id uuid not null references public.yourhr_accounts(id) on delete cascade, bucket timestamptz not null, count integer not null, primary key(account_id,bucket));
alter table public.yourhr_accounts enable row level security;
alter table public.yourhr_jobs enable row level security;
alter table public.yourhr_screenings enable row level security;
alter table public.yourhr_reports enable row level security;
alter table public.yourhr_limits enable row level security;
revoke all on public.yourhr_accounts,public.yourhr_jobs,public.yourhr_screenings,public.yourhr_reports,public.yourhr_limits from anon,authenticated;

create function public.yourhr_blank_profile(name text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('agentName',split_part(name,' ',1)||'''s agent','headline','','active',true,'discoverable',false,'savedAnswers','{}'::jsonb,'facts',(select jsonb_object_agg(f,jsonb_build_object('value','','share',false)) from unnest(array['location','authorization','sponsorship','relocation','workplace','salary','availability']) f));
$$;
create function public.yourhr_signup() returns trigger language plpgsql security definer set search_path='' as $$
declare r text; n text;
begin
 r:=new.raw_user_meta_data->>'role'; n:=trim(new.raw_user_meta_data->>'name');
 if r is null or r not in ('candidate','recruiter') or n is null or length(n)<2 or length(n)>100 then raise exception 'Name and role are required'; end if;
 insert into public.yourhr_accounts(id,role,name,company,profile,agent) values(new.id,r,n,left(coalesce(new.raw_user_meta_data->>'company',''),100),public.yourhr_blank_profile(n),split_part(n,' ',1)||'''s hiring agent');
 return new;
end;$$;
create trigger yourhr_new_user after insert on auth.users for each row execute function public.yourhr_signup();

create function public.yourhr_validate_profile(p jsonb) returns void language plpgsql set search_path='' as $$
declare f text; v text; item record;
begin
 if jsonb_typeof(p) is distinct from 'object' or length(p::text)>100000 or length(trim(coalesce(p->>'agentName','')))=0 or length(p->>'agentName')>200 or length(p->>'headline')>300 then raise exception 'Invalid profile'; end if;
 if jsonb_typeof(p->'active') is distinct from 'boolean' or jsonb_typeof(p->'discoverable') is distinct from 'boolean' then raise exception 'Invalid profile permissions';end if;
 foreach f in array array['location','authorization','sponsorship','relocation','workplace','salary','availability'] loop
  if jsonb_typeof(p->'facts'->f->'value') is distinct from 'string' or jsonb_typeof(p->'facts'->f->'share') is distinct from 'boolean' then raise exception 'Invalid fact';end if;
  v:=p->'facts'->f->>'value';if length(v)>200 then raise exception 'Answer too long';end if;
  if v<>'' then
   if f in ('authorization','sponsorship','relocation') and v not in ('Yes','No') then raise exception 'Choose Yes or No';end if;
   if f='workplace' and v not in ('Remote','Hybrid','On-site','Flexible') then raise exception 'Invalid work arrangement';end if;
   if f in ('salary','availability') then
    if v!~'^\d{1,8}$' then raise exception 'Invalid numeric answer';end if;
    if (f='salary' and v::numeric>10000000) or (f='availability' and v::numeric>104) then raise exception 'Numeric answer out of range';end if;
   end if;
  end if;
 end loop;
 if jsonb_typeof(p->'savedAnswers') is distinct from 'object' then raise exception 'Invalid reusable answers';end if;
 if (select count(*) from jsonb_each(p->'savedAnswers'))>100 then raise exception 'Too many reusable answers';end if;
 for item in select * from jsonb_each(p->'savedAnswers') loop
  if length(item.key)>500 or jsonb_typeof(item.value)<>'string' or length(item.value#>>'{}')>4000 then raise exception 'Invalid reusable answer';end if;
 end loop;
end;$$;

create function public.yourhr_check(f text,v text,j jsonb) returns jsonb language plpgsql set search_path='' as $$
declare ok boolean:=true; reason text; answer text:=v;
begin
 case f
 when 'location' then ok:=j->>'workplace'='Remote' or lower(trim(v))=lower(trim(j->>'location'));reason:=case when ok then 'Location is compatible with this role. Remote roles assume eligible US-based work.' else 'Different locations. Confirm commute or relocation.' end;
 when 'authorization' then ok:=v='Yes' or j->>'authorization'='Flexible';reason:=case when ok then 'Meets the stated authorization policy.' else 'Work authorization options need discussion.' end;
 when 'sponsorship' then ok:=v='No' or (j->>'sponsorship')::boolean;reason:=case when ok then 'Compatible with the employer sponsorship policy.' else 'Candidate needs sponsorship; this role does not offer it.' end;
 when 'relocation' then ok:=j->>'workplace'='Remote' or v='Yes';reason:=case when j->>'workplace'='Remote' then 'Relocation is not needed for this remote role.' when ok then 'Open to relocation; confirm details and support.' else 'No relocation. Confirm required work location.' end;
 when 'workplace' then ok:=v='Flexible' or v=j->>'workplace';reason:=case when ok then 'Work arrangement matches.' else 'Preferred work arrangement differs from the role.' end;
 when 'salary' then ok:=v::numeric<=(j->>'salaryMax')::numeric;answer:='$'||to_char(v::numeric,'FM999,999,999')||' USD / year (minimum base)';reason:=case when ok then 'Minimum expectation fits within the posted salary ceiling.' else 'Minimum expectation exceeds the posted salary ceiling.' end;
 when 'availability' then ok:=v::numeric<=(j->>'startWithin')::numeric;answer:=v||' weeks';reason:=case when ok then 'Available within the desired start window.' else 'Start timing needs a conversation.' end;
 else ok:=false;reason:='Custom answer shared. A person should assess this response.';
 end case;
 return jsonb_build_object('answer',answer,'status',case when ok then 'aligned' else 'review' end,'reason',reason);
end;$$;
create function public.yourhr_status(checks jsonb) returns text language sql immutable set search_path='' as $$
 select case when exists(select 1 from jsonb_array_elements(checks)c where c->>'status'='pending') then 'pending' when exists(select 1 from jsonb_array_elements(checks)c where c->>'status'='review') then 'review' else 'aligned' end;
$$;

create function public.yourhr_action(action text,payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<ctx>>
declare
 uid uuid:=auth.uid(); me public.yourhr_accounts; candidate public.yourhr_accounts;
 j jsonb; p jsonb; s jsonb; checks jsonb:='[]'; messages jsonb:='[]'; c jsonb; existing public.yourhr_screenings;
 job_id uuid; candidate_id uuid; sid uuid; f text; v text; q text; allowed boolean; remembered boolean; i integer; hits integer;
 labels text[]:=array['Location','Work authorization','Visa sponsorship','Relocation','Work arrangement','Salary expectation','Start availability'];
 questions text[]:=array['Where are you currently based?','Are you authorized to work in the United States?','Will you need employer visa sponsorship now or in the future?','Are you open to relocation?','What work arrangement are you looking for?','What is your minimum expected annual base salary in USD?','How many weeks would you need before starting?'];
 fields text[]:=array['location','authorization','sponsorship','relocation','workplace','salary','availability'];
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
 if length(payload::text)>100000 then raise exception 'Request too large';end if;
 if uid is not null then
  if not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Confirm your email before continuing';end if;
  select * into me from public.yourhr_accounts where id=uid;
  if me.id is null then raise exception 'Account unavailable';end if;
 end if;
 if action='state' then
  return jsonb_build_object('user',case when uid is null then null else jsonb_build_object('id',me.id,'name',me.name,'email',(select email from auth.users where id=uid),'role',me.role,'company',me.company,'demo',false) end,
  'profile',case when me.role='candidate' then me.profile else null end,
  'jobs',coalesce((select jsonb_agg(data order by created_at desc) from (select data,created_at from public.yourhr_jobs order by created_at desc limit 200)t),'[]'::jsonb),
  'screenings',coalesce((select jsonb_agg(data order by created_at desc) from public.yourhr_screenings where (me.role='candidate' and yourhr_screenings.candidate_id=uid) or (me.role='recruiter' and recruiter_id=uid)),'[]'::jsonb),
  'candidates',case when me.role='recruiter' then coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'headline',profile->>'headline','agentName',profile->>'agentName')) from (select * from public.yourhr_accounts where role='candidate' and profile->>'discoverable'='true' and profile->>'active'='true' limit 200)t),'[]'::jsonb) else '[]'::jsonb end,'mode','demo','recruiterAgent',coalesce(me.agent,''));
 end if;
 if uid is null then raise exception 'Sign in to continue';end if;
 -- Account-scoped mutation budget, enforced atomically across server instances.
 delete from public.yourhr_limits where account_id=uid and bucket<date_trunc('hour',now());
 insert into public.yourhr_limits values(uid,date_trunc('hour',now()),1) on conflict(account_id,bucket) do update set count=yourhr_limits.count+1 returning count into hits;
 if hits>120 then raise exception 'Hourly action limit reached. Please try again later.';end if;
 if action='profile' then
  if me.role<>'candidate' then raise exception 'Candidate access required';end if;
  perform public.yourhr_validate_profile(payload);update public.yourhr_accounts set profile=payload where id=uid;
 elsif action='agent' then
  if me.role<>'recruiter' then raise exception 'Recruiter access required';end if;
  v:=trim(payload->>'name');if v is null or length(v)<1 or length(v)>100 then raise exception 'Invalid agent name';end if;
  update public.yourhr_accounts set agent=v where id=uid;update public.yourhr_jobs set data=jsonb_set(data,'{agentName}',to_jsonb(v)) where recruiter_id=uid;
 elsif action='job' then
  if me.role<>'recruiter' then raise exception 'Recruiter access required';end if;
  if (select count(*) from public.yourhr_jobs where recruiter_id=uid)>=20 then raise exception 'Beta limit: 20 active jobs per recruiter';end if;
  if length(trim(coalesce(payload->>'title','')))<3 or length(payload->>'title')>200 or length(trim(coalesce(payload->>'company','')))<1 or length(payload->>'company')>200 or length(trim(coalesce(payload->>'location','')))<2 or length(payload->>'location')>200 or length(trim(coalesce(payload->>'description','')))<30 or length(payload->>'description')>10000 then raise exception 'Complete the job title, company, location, and description';end if;
  if coalesce(payload->>'workplace','') not in ('Remote','Hybrid','On-site') or coalesce(payload->>'authorization','') not in ('Required','Flexible') or jsonb_typeof(payload->'sponsorship') is distinct from 'boolean' or jsonb_typeof(payload->'relocation') is distinct from 'boolean' then raise exception 'Invalid job requirements';end if;
  foreach f in array array['salaryMin','salaryMax','startWithin'] loop
   if coalesce(payload->>f,'')!~'^\d{1,8}$' then raise exception 'Invalid numeric requirement';end if;
  end loop;
  if (payload->>'salaryMax')::numeric<1 or (payload->>'salaryMin')::numeric>(payload->>'salaryMax')::numeric or (payload->>'salaryMax')::numeric>10000000 or (payload->>'startWithin')::numeric>104 then raise exception 'Invalid salary or start range';end if;
  if jsonb_typeof(payload->'questions') is distinct from 'array' or jsonb_typeof(payload->'tags') is distinct from 'array' then raise exception 'Invalid questions or tags';end if;
  if jsonb_array_length(payload->'questions')>5 or jsonb_array_length(payload->'tags')>6 then raise exception 'Too many questions or tags';end if;
  for c in select value from jsonb_array_elements(payload->'questions') loop
   if jsonb_typeof(c)<>'string' or length(c#>>'{}')<3 or length(c#>>'{}')>500 then raise exception 'Invalid custom question';end if;
  end loop;
  if (select count(distinct value) from jsonb_array_elements(payload->'questions'))<>jsonb_array_length(payload->'questions') then raise exception 'Custom questions must be unique';end if;
  for c in select value from jsonb_array_elements(payload->'tags') loop
   if jsonb_typeof(c)<>'string' or length(c#>>'{}')>200 then raise exception 'Invalid tag';end if;
  end loop;
  job_id:=gen_random_uuid();j:=payload||jsonb_build_object('id',job_id,'recruiterId',uid,'agentName',me.agent,'createdAt',stamp);
  insert into public.yourhr_jobs(id,recruiter_id,data) values(job_id,uid,j);return jsonb_build_object('ok',true,'id',job_id);
 elsif action='screen' then
  job_id:=(payload->>'jobId')::uuid;select data into j from public.yourhr_jobs where id=job_id;
  if j is null then raise exception 'Job not found';end if;
  candidate_id:=case when me.role='candidate' then uid else (payload->>'candidateId')::uuid end;
  -- Lock candidate to serialize privacy edits and duplicate screens.
  select * into candidate from public.yourhr_accounts where id=candidate_id and role='candidate' for update;
  if candidate.id is null then raise exception 'Candidate unavailable';end if;
  p:=candidate.profile;
  if me.role='recruiter' and ((j->>'recruiterId')::uuid<>uid or p->>'discoverable'<>'true') then raise exception 'Candidate has not opted in, or this is not your job';end if;
  if p->>'active'<>'true' then raise exception 'Candidate agent is paused';end if;
  select * into existing from public.yourhr_screenings where yourhr_screenings.job_id=ctx.job_id and yourhr_screenings.candidate_id=ctx.candidate_id;
  if existing.id is not null then return jsonb_build_object('ok',true,'id',existing.id,'existing',true);end if;
  if (select count(*) from public.yourhr_screenings where yourhr_screenings.candidate_id=ctx.candidate_id)>=100 then raise exception 'Beta screening limit reached';end if;
  messages:=jsonb_build_array(jsonb_build_object('speaker','system','text','Screening started. Only candidate-approved facts may be shared. No hiring decision will be made.'));
  for i in 1..7 loop
   f:=fields[i];v:=p->'facts'->f->>'value';allowed:=p->'facts'->f->>'share'='true' and length(trim(v))>0;
   c:=jsonb_build_object('field',f,'label',labels[i],'question',questions[i],'source',case when allowed then 'Approved profile' else 'Awaiting candidate' end);
   if allowed then c:=c||public.yourhr_check(f,v,j);else c:=c||jsonb_build_object('answer',null,'status','pending','reason','Candidate input or approval is required.');end if;
   checks:=checks||jsonb_build_array(c);
   messages:=messages||jsonb_build_array(jsonb_build_object('speaker','recruiter','text',questions[i]),jsonb_build_object('speaker','candidate','text',coalesce(c->>'answer','I will ask my candidate. I do not have permission to answer yet.')));
  end loop;
  if checks->0->>'status'='aligned' and checks->3->>'answer'='No' and j->>'workplace'<>'Remote' then checks:=jsonb_set(checks,'{3}',checks->3||jsonb_build_object('status','aligned','reason','Already in the required location; relocation is not needed.'));end if;
  for q in select jsonb_array_elements_text(j->'questions') loop
   v:=p->'savedAnswers'->>q;c:=jsonb_build_object('field','custom:'||q,'label','Custom question','question',q,'answer',v,'status',case when v is null then 'pending' else 'review' end,'reason',case when v is null then 'Customized question routed to the candidate.' else 'Reusable answer shared; human review required.' end,'source',case when v is null then 'Awaiting candidate' else 'Approved reusable answer' end);checks:=checks||jsonb_build_array(c);
   messages:=messages||jsonb_build_array(jsonb_build_object('speaker','recruiter','text',q),jsonb_build_object('speaker','candidate','text',coalesce(v,'I will ask my candidate to review this custom question.')));
  end loop;
  sid:=gen_random_uuid();s:=jsonb_build_object('id',sid,'jobId',job_id,'candidateId',candidate_id,'candidateName',candidate.name,'recruiterId',j->>'recruiterId','company',j->>'company','jobTitle',j->>'title','candidateAgent',p->>'agentName','recruiterAgent',j->>'agentName','checks',checks,'messages',messages,'status',public.yourhr_status(checks),'createdAt',stamp,'updatedAt',stamp,'summaryMode','demo');
  insert into public.yourhr_screenings values(sid,job_id,candidate_id,(j->>'recruiterId')::uuid,s,now());return jsonb_build_object('ok',true,'id',sid);
 elsif action='answer' then
  if me.role<>'candidate' then raise exception 'Only the candidate can approve answers';end if;
  select * into existing from public.yourhr_screenings where id=(payload->>'screeningId')::uuid and yourhr_screenings.candidate_id=uid for update;
  if existing.id is null then raise exception 'Screening not found';end if;
  select profile into p from public.yourhr_accounts where id=uid for update;
  s:=existing.data;select data into j from public.yourhr_jobs where id=existing.job_id;
  f:=payload->>'field';v:=trim(payload->>'answer');remembered:=coalesce((payload->>'remember')::boolean,false);
  if v is null or length(v)=0 or length(v)>4000 then raise exception 'Enter an answer up to 4000 characters';end if;
  select value,ordinality::integer-1 into c,i from jsonb_array_elements(s->'checks') with ordinality where value->>'field'=f;
  if c is null then raise exception 'Question not found';end if;
  if f=any(fields) then
   perform public.yourhr_validate_profile(jsonb_set(p,array['facts',f],jsonb_build_object('value',v,'share',true)));
   c:=c||public.yourhr_check(f,v,j)||jsonb_build_object('source','Candidate approved');
   if remembered then p:=jsonb_set(p,array['facts',f],jsonb_build_object('value',v,'share',true));end if;
  else
   c:=c||jsonb_build_object('answer',v,'status','review','reason','Candidate answered. Recruiter review required.','source','Candidate approved');
   if remembered then p:=jsonb_set(p,array['savedAnswers',c->>'question'],to_jsonb(v));end if;
  end if;
  perform public.yourhr_validate_profile(p);
  checks:=jsonb_set(s->'checks',array[i::text],c);
  if checks->0->>'status'='aligned' and checks->3->>'answer'='No' and j->>'workplace'<>'Remote' then checks:=jsonb_set(checks,'{3}',checks->3||jsonb_build_object('status','aligned','reason','Already in the required location; relocation is not needed.'));end if;
  messages:=(s->'messages')||jsonb_build_array(jsonb_build_object('speaker','system','text','Candidate approved an answer.'),jsonb_build_object('speaker','recruiter','text',c->>'question'),jsonb_build_object('speaker','candidate','text',c->>'answer'));
  if jsonb_array_length(messages)>500 then raise exception 'Conversation limit reached';end if;
  s:=s||jsonb_build_object('checks',checks,'messages',messages,'status',public.yourhr_status(checks),'updatedAt',stamp);
  update public.yourhr_accounts set profile=p where id=uid;update public.yourhr_screenings set data=s where id=existing.id;
 elsif action='close-job' then
  delete from public.yourhr_jobs where id=(payload->>'jobId')::uuid and recruiter_id=uid;
 elsif action='report' then
  v:=trim(payload->>'reason');if v is null or length(v)<5 or length(v)>1000 then raise exception 'Provide a report reason (5–1000 characters)';end if;
  insert into public.yourhr_reports(reporter_id,job_id,reason) values(uid,(payload->>'jobId')::uuid,v);
 elsif action='delete-account' then
  if payload->>'confirmation' is distinct from 'DELETE' then raise exception 'Type DELETE to confirm';end if;
  delete from auth.users where id=uid;
 else raise exception 'Unknown action';
 end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.yourhr_signup(),public.yourhr_blank_profile(text),public.yourhr_validate_profile(jsonb),public.yourhr_check(text,text,jsonb),public.yourhr_status(jsonb),public.yourhr_action(text,jsonb) from public,anon,authenticated;
grant execute on function public.yourhr_action(text,jsonb) to anon,authenticated;
