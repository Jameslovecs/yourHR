import {
  fields,
  labels,
  type Profile,
  type Job,
  type Check,
  type Screening,
  type Message,
} from "./types";
const questions: Record<string, string> = {
  location: "Where are you currently based?",
  authorization: "Are you authorized to work in the United States?",
  sponsorship: "Will you need employer visa sponsorship now or in the future?",
  relocation: "Are you open to relocation?",
  workplace: "What work arrangement are you looking for?",
  salary: "What is your minimum expected annual base salary in USD?",
  availability: "How many weeks would you need before starting?",
};
export function evaluate(
  field: string,
  value: string,
  job: Job,
): Pick<Check, "status" | "reason"> {
  let aligned = true;
  let reason = "";
  const yes = value === "Yes";
  switch (field) {
    case "location":
      aligned =
        job.workplace === "Remote" ||
        value.trim().toLowerCase() === job.location.trim().toLowerCase();
      reason = aligned
        ? "Location is compatible with this role."
        : "Different locations. Confirm commute or relocation with the candidate.";
      break;
    case "authorization":
      aligned = yes || job.authorization === "Flexible";
      reason = aligned
        ? "Meets the stated authorization policy."
        : "Recruiter should review work authorization options.";
      break;
    case "sponsorship":
      aligned = !yes || job.sponsorship;
      reason = aligned
        ? "Compatible with the employer’s sponsorship policy."
        : "Candidate needs sponsorship; this role does not offer it.";
      break;
    case "relocation":
      aligned = job.workplace === "Remote" || yes;
      reason =
        job.workplace === "Remote"
          ? "Relocation is not needed for this remote role."
          : yes
            ? job.relocation
              ? "Open to relocating; relocation support is available."
              : "Open to relocating; financial support needs discussion."
            : "No relocation. Confirm the candidate can work from the required location.";
      break;
    case "workplace":
      aligned = value === "Flexible" || value === job.workplace;
      reason = aligned
        ? "Work arrangement matches."
        : `Candidate prefers ${value.toLowerCase()}; role is ${job.workplace.toLowerCase()}.`;
      break;
    case "salary":
      aligned = Number(value) <= job.salaryMax;
      reason = aligned
        ? "Minimum expectation fits within the posted salary ceiling."
        : "Minimum expectation exceeds the posted salary ceiling.";
      break;
    case "availability":
      aligned = Number(value) <= job.startWithin;
      reason = aligned
        ? "Available within the desired start window."
        : "Start timing needs a conversation.";
      break;
    default:
      return {
        status: "review",
        reason: "Custom answer shared. A person should assess this response.",
      };
  }
  return { status: aligned ? "aligned" : "review", reason };
}
export function overall(checks: Check[]): Screening["status"] {
  return checks.some((c) => c.status === "pending")
    ? "pending"
    : checks.some((c) => c.status === "review")
      ? "review"
      : "aligned";
}
export function displayAnswer(field: string, value: string) {
  if (field === "salary")
    return `$${Number(value).toLocaleString("en-US")} USD / year (minimum base)`;
  if (field === "availability") return `${value} weeks`;
  return value;
}
export function runScreening(
  profile: Profile,
  job: Job,
): { checks: Check[]; messages: Message[]; status: Screening["status"] } {
  const checks: Check[] = fields.map((field) => {
    const fact = profile.facts[field];
    const allowed = fact.share && fact.value.trim() !== "";
    return {
      field,
      label: labels[field],
      question: questions[field],
      answer: allowed ? displayAnswer(field, fact.value) : null,
      ...(allowed
        ? evaluate(field, fact.value, job)
        : {
            status: "pending" as const,
            reason: fact.value
              ? "Candidate approval is needed to share this answer."
              : "Candidate needs to provide this answer.",
          }),
      source: allowed ? "Approved profile" : "Awaiting candidate",
    };
  });
  for (const question of job.questions) {
    const answer = Object.prototype.hasOwnProperty.call(
      profile.savedAnswers,
      question,
    )
      ? profile.savedAnswers[question]
      : undefined;
    checks.push({
      field: `custom:${question}`,
      label: "Custom question",
      question,
      answer: answer || null,
      status: answer ? "review" : "pending",
      reason: answer
        ? "Reusable answer shared; human review required."
        : "Customized question routed to the candidate.",
      source: answer ? "Approved reusable answer" : "Awaiting candidate",
    });
  }
  // A candidate already in the required city does not need to relocate.
  const location = checks.find((c) => c.field === "location");
  const relocation = checks.find((c) => c.field === "relocation");
  if (
    location?.status === "aligned" &&
    relocation?.status === "review" &&
    job.workplace !== "Remote"
  ) {
    relocation.status = "aligned";
    relocation.reason =
      "Already based in the role’s location; relocation is not needed.";
  }
  const messages: Message[] = [
    {
      speaker: "system",
      text: "Screening started. Only candidate-approved facts may be shared. No hiring decision will be made.",
    },
  ];
  for (const c of checks)
    messages.push(
      { speaker: "recruiter", text: c.question },
      {
        speaker: "candidate",
        text:
          c.answer ||
          "I’ll ask my candidate to review this. I don’t have permission to provide an answer yet.",
      },
    );
  return { checks, messages, status: overall(checks) };
}
