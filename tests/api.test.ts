import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";

test("account isolation, consent, job posting, screening, answer reuse, and persistence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "yourhr-test-"));
  process.env.DATABASE_PATH = join(dir, "test.sqlite");
  delete process.env.OPENAI_API_KEY;
  const { POST, GET } = await import("../app/api/[...path]/route");
  const { db, profileById } = await import("../lib/db");
  const call = async (
    action: string,
    body: unknown,
    cookie = "",
    origin = "http://localhost:3000",
  ) => {
    const res = await POST(
      new NextRequest(`http://localhost:3000/api/${action}`, {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin,
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify(body),
      }),
    );
    return {
      status: res.status,
      data: await res.json(),
      cookie: res.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  const state = async (cookie = "") =>
    (
      await GET(
        new NextRequest("http://localhost:3000/api/state", {
          headers: { cookie },
        }),
      )
    ).json();
  try {
    assert.equal((await call("profile", {})).status, 401);
    assert.equal(
      (await call("demo", { role: "candidate" }, "", "https://evil.example"))
        .status,
      403,
    );
    const c = await call("register", {
      name: "Test Candidate",
      email: "candidate@example.test",
      password: "long-test-password",
      role: "candidate",
    });
    assert.equal(c.status, 200);
    const r = await call("register", {
      name: "Test Recruiter",
      email: "recruiter@example.test",
      password: "long-test-password",
      role: "recruiter",
      company: "Test Co",
    });
    assert.equal(r.status, 200);
    const r2 = await call("register", {
      name: "Other Recruiter",
      email: "other@example.test",
      password: "long-test-password",
      role: "recruiter",
      company: "Other Co",
    });
    assert.equal(r2.status, 200);
    const cs = await state(c.cookie),
      rs = await state(r.cookie);
    assert.equal(cs.user.role, "candidate");
    assert.equal(rs.profile, null);
    assert.equal(
      rs.candidates.some((u: { id: string }) => u.id === cs.user.id),
      false,
    );
    const profile = cs.profile;
    profile.active = true;
    profile.facts.salary = { value: "PRIVATE", share: true };
    assert.equal((await call("profile", profile, c.cookie)).status, 400);
    profile.facts.salary = { value: "160000", share: false };
    profile.facts.location = { value: "Never-share-city", share: false };
    assert.equal((await call("profile", profile, c.cookie)).status, 200);
    const job = {
      title: "Test Designer",
      company: "Test Co",
      location: "New York, NY",
      workplace: "Remote",
      salaryMin: 140000,
      salaryMax: 190000,
      sponsorship: true,
      authorization: "Required",
      relocation: false,
      startWithin: 6,
      description: "A role for testing the complete hiring workflow.",
      tags: ["Design"],
      questions: ["Tell us about your project."],
    };
    assert.equal((await call("job", job, c.cookie)).status, 403);
    const posted = await call("job", job, r.cookie);
    assert.equal(posted.status, 200);
    assert.equal(
      (
        await call(
          "screen",
          { jobId: posted.data.id, candidateId: cs.user.id },
          r.cookie,
        )
      ).status,
      403,
    );
    profile.discoverable = true;
    await call("profile", profile, c.cookie);
    assert.equal(
      (
        await call(
          "screen",
          { jobId: posted.data.id, candidateId: cs.user.id },
          r2.cookie,
        )
      ).status,
      403,
    );
    const screen = await call(
      "screen",
      { jobId: posted.data.id, candidateId: cs.user.id },
      r.cookie,
    );
    assert.equal(screen.status, 200);
    const duplicate = await call("screen", { jobId: posted.data.id }, c.cookie);
    assert.equal(duplicate.data.id, screen.data.id);
    assert.equal(duplicate.data.existing, true);
    const shared = await state(r.cookie);
    assert.equal(shared.screenings.length, 1);
    assert.equal(JSON.stringify(shared).includes("Never-share-city"), false);
    assert.equal(
      shared.screenings[0].checks.find(
        (v: { field: string }) => v.field === "salary",
      ).answer,
      null,
    );
    assert.equal((await state(r2.cookie)).screenings.length, 0);
    assert.equal(
      (
        await call(
          "answer",
          {
            screeningId: screen.data.id,
            field: "salary",
            answer: "160000",
            remember: true,
          },
          r.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "answer",
          {
            screeningId: screen.data.id,
            field: "salary",
            answer: "garbage",
            remember: true,
          },
          c.cookie,
        )
      ).status,
      400,
    );
    const before = profileById(cs.user.id);
    assert.equal(before.facts.salary.share, false);
    assert.equal(
      (
        await call(
          "answer",
          {
            screeningId: screen.data.id,
            field: "salary",
            answer: "160000",
            remember: false,
          },
          c.cookie,
        )
      ).status,
      200,
    );
    assert.equal(profileById(cs.user.id).facts.salary.share, false);
    assert.equal(
      (
        await call(
          "answer",
          {
            screeningId: screen.data.id,
            field: "custom:Tell us about your project.",
            answer: "I built an accessible dashboard.",
            remember: true,
          },
          c.cookie,
        )
      ).status,
      200,
    );
    assert.equal(
      profileById(cs.user.id).savedAnswers["Tell us about your project."],
      "I built an accessible dashboard.",
    );
    const another = await call(
      "job",
      { ...job, title: "Another Designer" },
      r.cookie,
    );
    const next = await call("screen", { jobId: another.data.id }, c.cookie);
    assert.equal(next.status, 200);
    const nextState = await state(c.cookie);
    const nextScreen = nextState.screenings.find(
      (s: { id: string }) => s.id === next.data.id,
    );
    assert.equal(
      nextScreen.checks.at(-1).answer,
      "I built an accessible dashboard.",
    );
    assert.equal(nextScreen.checks.at(-1).status, "review");
    assert.equal(
      nextScreen.checks.find((c: { field: string }) => c.field === "salary")
        .answer,
      null,
    );
    profile.active = false;
    await call("profile", profile, c.cookie);
    const third = await call(
      "job",
      { ...job, title: "Paused Designer" },
      r.cookie,
    );
    assert.equal(
      (await call("screen", { jobId: third.data.id }, c.cookie)).status,
      400,
    );
    assert.equal(
      (
        await call("login", {
          email: "candidate@example.test",
          password: "wrong",
        })
      ).status,
      401,
    );
    const loggedIn = await call("login", {
      email: "candidate@example.test",
      password: "long-test-password",
    });
    assert.equal(loggedIn.status, 200);
    assert.equal((await state(loggedIn.cookie)).screenings.length, 2);
    await call("logout", {}, loggedIn.cookie);
    assert.equal((await state(loggedIn.cookie)).user, null);
    const publicState = await state();
    assert.equal(publicState.profile, null);
    assert.deepEqual(publicState.screenings, []);
    assert.deepEqual(publicState.candidates, []);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
