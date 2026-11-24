import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { demoSeed } from "../lib/demo-seed";
const c = "11111111-1111-4111-8111-111111111111",
  r = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333";
test("hosted SQL enforces auth, consent, isolation, approvals, limits, and deletion", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    await db.exec(
      readFileSync("supabase/migrations/001_public_beta.sql", "utf8"),
    );
    const as = async (id: string) =>
      db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    const call = async (action: string, payload: unknown = {}) =>
      (
        await db.query<{ result: any }>(
          "select public.yourhr_action($1,$2::jsonb) as result",
          [action, JSON.stringify(payload)],
        )
      ).rows[0].result;
    for (const [id, role] of [
      [c, "candidate"],
      [r, "recruiter"],
      [other, "recruiter"],
    ])
      await db.query("insert into auth.users values($1,$2,now(),$3)", [
        id,
        `${id}@example.test`,
        JSON.stringify({ name: "Test Person", role, company: "Test Co" }),
      ]);
    await as("");
    assert.equal((await call("state")).user, null);
    await assert.rejects(call("job", {}), /Sign in/);
    await as(c);
    const profile = demoSeed().profile;
    profile.discoverable = false;
    profile.facts.salary.share = false;
    profile.facts.location = { value: "PRIVATE_CITY_123", share: false };
    await call("profile", profile);
    await as(r);
    assert.equal((await call("state")).candidates.length, 0);
    const j = demoSeed().jobs[0];
    const posted = await call("job", j);
    await assert.rejects(
      call("screen", { jobId: posted.id, candidateId: c }),
      /not opted/,
    );
    await as(c);
    profile.discoverable = true;
    await call("profile", profile);
    await as(other);
    await assert.rejects(
      call("screen", { jobId: posted.id, candidateId: c }),
      /not your job/,
    );
    await as(r);
    const screen = await call("screen", { jobId: posted.id, candidateId: c });
    const state = await call("state");
    assert.equal(state.screenings.length, 1);
    assert.ok(!JSON.stringify(state).includes("PRIVATE_CITY_123"));
    assert.equal(state.profile, null);
    assert.equal(
      state.screenings[0].checks.find((v: any) => v.field === "salary").answer,
      null,
    );
    await assert.rejects(
      call("answer", {
        screeningId: screen.id,
        field: "salary",
        answer: "150000",
        remember: true,
      }),
      /Only the candidate/,
    );
    await as(other);
    assert.equal((await call("state")).screenings.length, 0);
    await as(c);
    assert.equal((await call("screen", { jobId: posted.id })).id, screen.id);
    await assert.rejects(
      call("answer", {
        screeningId: screen.id,
        field: "salary",
        answer: "NaN",
        remember: true,
      }),
      /numeric/,
    );
    await call("answer", {
      screeningId: screen.id,
      field: "salary",
      answer: "150000",
      remember: false,
    });
    assert.equal((await call("state")).profile.facts.salary.share, false);
    const question = j.questions[0];
    await call("answer", {
      screeningId: screen.id,
      field: `custom:${question}`,
      answer: "I built an accessible app.",
      remember: true,
    });
    await as(r);
    const j2 = await call("job", j);
    const s2 = await call("screen", { jobId: j2.id, candidateId: c });
    const result = (await call("state")).screenings.find(
      (v: any) => v.id === s2.id,
    );
    assert.equal(result.checks.at(-1).answer, "I built an accessible app.");
    assert.equal(result.checks.at(-1).status, "review");
    assert.equal(
      result.checks.find((v: any) => v.field === "salary").answer,
      null,
    );
    // Direct API table access must be denied, regardless of the UI.
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select * from public.yourhr_accounts"),
      /permission denied/,
    );
    await db.exec("reset role");
    await as(c);
    await call("report", {
      jobId: posted.id,
      reason: "A fictional test report",
    });
    await db.query(
      "update public.yourhr_limits set count=120 where account_id=$1",
      [c],
    );
    await assert.rejects(call("profile", profile), /Hourly/);
    await db.query("delete from public.yourhr_limits where account_id=$1", [c]);
    await assert.rejects(
      call("delete-account", { confirmation: "no" }),
      /DELETE/,
    );
    await call("delete-account", { confirmation: "DELETE" });
    assert.equal(
      (await db.query("select * from public.yourhr_accounts where id=$1", [c]))
        .rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.yourhr_screenings")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
