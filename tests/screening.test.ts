import test from "node:test";
import assert from "node:assert/strict";
import { blankProfile, type Job } from "../lib/types";
import { runScreening, evaluate } from "../lib/screening";
import { profileSchema, jobSchema } from "../lib/validation";
const job: Job = {
  id: "test",
  recruiterId: "r",
  company: "Example",
  title: "Designer",
  location: "San Francisco, CA",
  workplace: "Remote",
  salaryMin: 140000,
  salaryMax: 180000,
  sponsorship: true,
  authorization: "Required",
  relocation: false,
  startWithin: 6,
  description: "Design software with a thoughtful, collaborative team.",
  tags: ["Design"],
  questions: [],
  agentName: "Scout",
  createdAt: "2026-01-01",
};
function profile() {
  const p = blankProfile("Taylor");
  for (const [f, v] of Object.entries({
    location: "San Francisco, CA",
    authorization: "Yes",
    sponsorship: "No",
    relocation: "No",
    workplace: "Remote",
    salary: "150000",
    availability: "4",
  })) {
    p.facts[f as keyof typeof p.facts] = { value: v, share: true };
  }
  return p;
}
test("approved compatible logistics produce an aligned result and full transcript", () => {
  const r = runScreening(profile(), job);
  assert.equal(r.status, "aligned");
  assert.equal(r.checks.length, 7);
  assert.equal(r.messages.length, 15);
});
test("private facts do not appear in results or agent transcript", () => {
  const p = profile();
  p.facts.location = { value: "PRIVATE_CITY_123", share: false };
  const result = runScreening(p, job);
  assert.equal(result.status, "pending");
  assert.equal(result.checks[0].answer, null);
  assert.ok(!JSON.stringify(result).includes("PRIVATE_CITY_123"));
});
test("empty shared fields are routed to human, never invented", () => {
  const p = profile();
  p.facts.salary.value = "";
  const r = runScreening(p, job);
  assert.equal(r.checks.find((c) => c.field === "salary")?.status, "pending");
});
test("salary, sponsorship, timing, and work arrangement conflicts require discussion, never rejection", () => {
  const p = profile();
  p.facts.salary.value = "220000";
  p.facts.sponsorship.value = "Yes";
  p.facts.availability.value = "12";
  p.facts.workplace.value = "On-site";
  const r = runScreening(p, { ...job, sponsorship: false });
  assert.equal(r.status, "review");
  assert.equal(r.checks.filter((c) => c.status === "review").length, 4);
});
test("location agreement means relocation is unnecessary for an onsite role", () => {
  const p = profile();
  p.facts.workplace.value = "On-site";
  const r = runScreening(p, { ...job, workplace: "On-site" });
  assert.equal(
    r.checks.find((c) => c.field === "relocation")?.status,
    "aligned",
  );
});
test("new custom question requires human answer; exact approved answer is reusable but reviewed", () => {
  const p = profile();
  const q = "Describe a project.";
  let r = runScreening(p, { ...job, questions: [q] });
  assert.equal(r.checks.at(-1)?.status, "pending");
  p.savedAnswers[q] = "I built an accessible design system.";
  r = runScreening(p, { ...job, questions: [q] });
  assert.equal(r.checks.at(-1)?.answer, p.savedAnswers[q]);
  assert.equal(r.checks.at(-1)?.status, "review");
  assert.equal(
    runScreening(p, {
      ...job,
      questions: ["Describe another project."],
    }).checks.at(-1)?.answer,
    null,
  );
});
test("prototype property names are never interpreted as approved custom answers", () => {
  assert.equal(
    runScreening(profile(), { ...job, questions: ["constructor"] }).checks.at(
      -1,
    )?.answer,
    null,
  );
});
test("invalid numeric profile facts and inverted salary ranges are rejected", () => {
  const p = profile();
  p.facts.salary.value = "banana";
  assert.equal(profileSchema.safeParse(p).success, false);
  assert.equal(
    jobSchema.safeParse({ ...job, salaryMin: 200000 }).success,
    false,
  );
});
test("salary ceiling and timing boundaries are inclusive", () => {
  assert.equal(evaluate("salary", "180000", job).status, "aligned");
  assert.equal(evaluate("salary", "180001", job).status, "review");
  assert.equal(evaluate("availability", "6", job).status, "aligned");
});
