import { answerSchema, profileSchema, isFact } from "./validation";
import { evaluate, displayAnswer, overall } from "./screening";
import type { Screening, Profile, Job, Field } from "./types";
export function approveAnswer(
  screen: Screening,
  profile: Profile,
  job: Job,
  input: unknown,
) {
  const v = answerSchema.parse(input),
    s = structuredClone(screen),
    p = structuredClone(profile);
  const c = s.checks.find((c) => c.field === v.field);
  if (!c) throw new Error("Question not found");
  if (isFact(v.field)) {
    const f = v.field as Field;
    const proposed = structuredClone(p);
    proposed.facts[f] = { value: v.answer, share: true };
    profileSchema.parse(proposed);
    Object.assign(c, evaluate(f, v.answer, job), {
      answer: displayAnswer(f, v.answer),
      source: "Candidate approved",
    });
    if (v.remember) p.facts[f] = { value: v.answer, share: true };
  } else {
    c.answer = v.answer;
    c.status = "review";
    c.reason = "Candidate answered. Recruiter review required.";
    c.source = "Candidate approved";
    if (v.remember) p.savedAnswers[c.question] = v.answer;
  }
  const location = s.checks.find((c) => c.field === "location"),
    relocation = s.checks.find((c) => c.field === "relocation");
  if (
    job.workplace !== "Remote" &&
    location?.status === "aligned" &&
    relocation?.answer === "No"
  ) {
    relocation.status = "aligned";
    relocation.reason =
      "Already based in the role’s location; relocation is not needed.";
  }
  s.messages.push(
    { speaker: "system", text: "Candidate approved an answer." },
    { speaker: "recruiter", text: c.question },
    { speaker: "candidate", text: c.answer! },
  );
  s.status = overall(s.checks);
  s.updatedAt = new Date().toISOString();
  delete s.aiSummary;
  return { screening: s, profile: p };
}
