export const fields = [
  "location",
  "authorization",
  "sponsorship",
  "relocation",
  "workplace",
  "salary",
  "availability",
] as const;
export type Field = (typeof fields)[number];
export type Role = "candidate" | "recruiter";
export type Fact = { value: string; share: boolean };
export type Profile = {
  agentName: string;
  headline: string;
  discoverable: boolean;
  active: boolean;
  facts: Record<Field, Fact>;
  savedAnswers: Record<string, string>;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: string;
  demo: boolean;
};
export type Job = {
  id: string;
  recruiterId: string;
  company: string;
  title: string;
  location: string;
  workplace: "Remote" | "Hybrid" | "On-site";
  salaryMin: number;
  salaryMax: number;
  sponsorship: boolean;
  authorization: "Required" | "Flexible";
  relocation: boolean;
  startWithin: number;
  description: string;
  tags: string[];
  questions: string[];
  agentName: string;
  createdAt: string;
};
export type Check = {
  field: string;
  label: string;
  question: string;
  answer: string | null;
  status: "aligned" | "review" | "pending";
  reason: string;
  source: string;
};
export type Message = {
  speaker: "recruiter" | "candidate" | "system";
  text: string;
};
export type Screening = {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  recruiterId: string;
  company: string;
  jobTitle: string;
  candidateAgent: string;
  recruiterAgent: string;
  checks: Check[];
  messages: Message[];
  status: "aligned" | "review" | "pending";
  createdAt: string;
  updatedAt: string;
  aiSummary?: string;
  summaryMode?: string;
};
export type AppState = {
  user: User | null;
  profile: Profile | null;
  jobs: Job[];
  screenings: Screening[];
  candidates: {
    id: string;
    name: string;
    headline: string;
    agentName: string;
  }[];
  mode: "demo" | "ai";
  recruiterAgent: string;
};
export const labels: Record<Field, string> = {
  location: "Location",
  authorization: "Work authorization",
  sponsorship: "Visa sponsorship",
  relocation: "Relocation",
  workplace: "Work arrangement",
  salary: "Salary expectation",
  availability: "Start availability",
};
export function blankProfile(name: string): Profile {
  return {
    agentName: `${name.split(" ")[0]}'s agent`,
    headline: "",
    discoverable: false,
    active: true,
    facts: Object.fromEntries(
      fields.map((f) => [f, { value: "", share: false }]),
    ) as Record<Field, Fact>,
    savedAnswers: {},
  };
}
