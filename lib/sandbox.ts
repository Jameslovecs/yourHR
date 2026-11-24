import { demoSeed } from "./demo-seed";
import { runScreening } from "./screening";
import { approveAnswer } from "./approve-answer";
import { profileSchema, jobSchema } from "./validation";
import type { AppState, Profile, Screening, Role } from "./types";
export type Sandbox = ReturnType<typeof demoSeed> & {
  role: Role | null;
  screens: Screening[];
  agent: string;
  version: 1;
};
export function newSandbox(): Sandbox {
  return { ...demoSeed(), role: null, screens: [], agent: "Scout", version: 1 };
}
export function sandboxState(s: Sandbox): AppState {
  return {
    user:
      s.role === "candidate"
        ? s.candidate
        : s.role === "recruiter"
          ? s.recruiter
          : null,
    profile: s.role === "candidate" ? s.profile : null,
    jobs: s.jobs,
    screenings: s.role ? s.screens : [],
    candidates:
      s.role === "recruiter" && s.profile.discoverable && s.profile.active
        ? [
            {
              id: s.candidate.id,
              name: s.candidate.name,
              headline: s.profile.headline,
              agentName: s.profile.agentName,
            },
          ]
        : [],
    mode: "demo",
    recruiterAgent: s.agent,
  };
}
export function sandboxAction(
  previous: Sandbox,
  action: string,
  body: unknown,
) {
  const s = structuredClone(previous),
    v = body as Record<string, unknown>;
  let result: { ok: boolean; id?: string; existing?: boolean } = { ok: true };
  if (action === "demo") {
    if (v.role !== "candidate" && v.role !== "recruiter")
      throw new Error("Invalid role");
    s.role = v.role;
    return { sandbox: s, result };
  }
  if (action === "reset-demo") return { sandbox: newSandbox(), result };
  if (action === "logout") {
    s.role = null;
    return { sandbox: s, result };
  }
  if (!s.role) throw new Error("Choose a demo role first.");
  if (action === "profile") {
    if (s.role !== "candidate") throw new Error("Candidate access required");
    s.profile = profileSchema.parse(body) as Profile;
  } else if (action === "agent") {
    if (s.role !== "recruiter") throw new Error("Recruiter access required");
    if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 100)
      throw new Error("Enter an agent name");
    s.agent = v.name.trim();
    s.jobs.forEach((j) => (j.agentName = s.agent));
  } else if (action === "job") {
    if (s.role !== "recruiter") throw new Error("Recruiter access required");
    if (s.jobs.length >= 30)
      throw new Error("Demo limit reached. Reset the demo to start again.");
    const j = {
      ...jobSchema.parse(body),
      id: crypto.randomUUID(),
      recruiterId: s.recruiter.id,
      agentName: s.agent,
      createdAt: new Date().toISOString(),
    };
    s.jobs.unshift(j);
    result.id = j.id;
  } else if (action === "screen") {
    const j = s.jobs.find((j) => j.id === v.jobId);
    if (!j) throw new Error("Job not found");
    if (!s.profile.active) throw new Error("Resume the candidate agent first.");
    if (
      s.role === "recruiter" &&
      (!s.profile.discoverable || v.candidateId !== s.candidate.id)
    )
      throw new Error("Candidate has not opted into discovery.");
    const existing = s.screens.find((x) => x.jobId === j.id);
    if (existing)
      return {
        sandbox: s,
        result: { ok: true, id: existing.id, existing: true },
      };
    const now = new Date().toISOString(),
      screen: Screening = {
        ...runScreening(s.profile, j),
        id: crypto.randomUUID(),
        jobId: j.id,
        candidateId: s.candidate.id,
        candidateName: s.candidate.name,
        recruiterId: s.recruiter.id,
        company: j.company,
        jobTitle: j.title,
        candidateAgent: s.profile.agentName,
        recruiterAgent: s.agent,
        createdAt: now,
        updatedAt: now,
        summaryMode: "demo",
      };
    s.screens.unshift(screen);
    result.id = screen.id;
  } else if (action === "answer") {
    if (s.role !== "candidate")
      throw new Error("Only the candidate can approve answers.");
    const index = s.screens.findIndex((x) => x.id === v.screeningId);
    if (index < 0) throw new Error("Screening not found");
    const r = approveAnswer(
      s.screens[index],
      s.profile,
      s.jobs.find((j) => j.id === s.screens[index].jobId)!,
      body,
    );
    s.profile = r.profile;
    s.screens[index] = r.screening;
  } else throw new Error("This action is not available in the demo.");
  return { sandbox: s, result };
}
