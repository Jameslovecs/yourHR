import test from "node:test";
import assert from "node:assert/strict";
import { newSandbox, sandboxAction, sandboxState } from "../lib/sandbox";
test("visitor sandboxes are isolated and preserve role-switch conversations", () => {
  let a = newSandbox(),
    b = newSandbox();
  a = sandboxAction(a, "demo", { role: "candidate" }).sandbox;
  a.profile.facts.salary.share = false;
  const result = sandboxAction(a, "screen", { jobId: a.jobs[0].id });
  a = result.sandbox;
  assert.equal(b.screens.length, 0);
  assert.equal(b.profile.facts.salary.share, true);
  a = sandboxAction(a, "demo", { role: "recruiter" }).sandbox;
  assert.equal(sandboxState(a).screenings.length, 1);
  assert.equal(sandboxState(a).profile, null);
  assert.equal(
    a.screens[0].checks.find((c) => c.field === "salary")?.answer,
    null,
  );
  assert.throws(
    () =>
      sandboxAction(a, "answer", {
        screeningId: result.result.id,
        field: "salary",
        answer: "100000",
        remember: true,
      }),
    /Only the candidate/,
  );
  a = sandboxAction(a, "demo", { role: "candidate" }).sandbox;
  a = sandboxAction(a, "answer", {
    screeningId: result.result.id,
    field: "salary",
    answer: "100000",
    remember: false,
  }).sandbox;
  assert.equal(a.profile.facts.salary.share, false);
  a = sandboxAction(a, "reset-demo", {}).sandbox;
  assert.equal(a.screens.length, 0);
  assert.equal(a.role, null);
});
