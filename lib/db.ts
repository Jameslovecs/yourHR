import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  blankProfile,
  type User,
  type Profile,
  type Job,
  type Screening,
} from "./types";
const file = resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || "./data/yourhr.sqlite");
mkdirSync(dirname(file), { recursive: true });
const globalDb = globalThis as unknown as { yourhrDb?: DatabaseSync };
export const db = globalDb.yourhrDb ?? new DatabaseSync(file);
globalDb.yourhrDb = db;
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,data TEXT NOT NULL,profile TEXT NOT NULL,agent TEXT NOT NULL DEFAULT 'Hiring agent');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,recruiter_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS screenings(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id),candidate_id TEXT NOT NULL REFERENCES users(id),recruiter_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,UNIQUE(job_id,candidate_id));`);
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function userById(id: string): User | null {
  const row = db.prepare("SELECT data FROM users WHERE id=?").get(id) as
    { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}
export function profileById(id: string): Profile {
  const row = db.prepare("SELECT profile FROM users WHERE id=?").get(id) as {
    profile: string;
  };
  return JSON.parse(row.profile);
}
export function allJobs(): Job[] {
  return (
    db.prepare("SELECT data FROM jobs ORDER BY rowid DESC").all() as {
      data: string;
    }[]
  ).map((r) => JSON.parse(r.data));
}
export function screeningsFor(user: User): Screening[] {
  return (
    db
      .prepare(
        `SELECT data FROM screenings WHERE ${user.role === "candidate" ? "candidate_id" : "recruiter_id"}=? ORDER BY rowid DESC`,
      )
      .all(user.id) as { data: string }[]
  ).map((r) => JSON.parse(r.data));
}
export function saveScreening(s: Screening) {
  db.prepare(
    "INSERT INTO screenings(id,job_id,candidate_id,recruiter_id,data) VALUES(?,?,?,?,?) ON CONFLICT(job_id,candidate_id) DO UPDATE SET data=excluded.data",
  ).run(s.id, s.jobId, s.candidateId, s.recruiterId, JSON.stringify(s));
}
function seed() {
  if (db.prepare("SELECT id FROM users WHERE id=?").get("demo-candidate"))
    return;
  const candidate: User = {
    id: "demo-candidate",
    name: "Alex Morgan",
    email: "alex@example.test",
    role: "candidate",
    company: "",
    demo: true,
  };
  const recruiter: User = {
    id: "demo-recruiter",
    name: "Jamie Chen",
    email: "jamie@example.test",
    role: "recruiter",
    company: "Forma",
    demo: true,
  };
  const profile = blankProfile(candidate.name);
  profile.agentName = "Atlas";
  profile.headline = "Product designer · thoughtful systems, useful products";
  profile.discoverable = true;
  const values = {
    location: "San Francisco, CA",
    authorization: "Yes",
    sponsorship: "No",
    relocation: "Yes",
    workplace: "Remote",
    salary: "150000",
    availability: "4",
  };
  for (const [key, value] of Object.entries(values)) {
    profile.facts[key as keyof typeof values] = { value, share: true };
  }
  for (const u of [candidate, recruiter])
    db.prepare(
      "INSERT INTO users(id,email,password,data,profile,agent) VALUES(?,?,?,?,?,?)",
    ).run(
      u.id,
      u.email,
      "disabled",
      JSON.stringify(u),
      JSON.stringify(u.role === "candidate" ? profile : blankProfile(u.name)),
      u.role === "recruiter" ? "Scout" : "Atlas",
    );
  const descriptions = [
    "Help shape the next generation of tools for creative teams. You’ll own end-to-end product experiences, partner closely with engineering, and turn complex workflows into thoughtful, approachable interfaces. We value clear thinking, craft, and a willingness to share work early.\n\nYou bring experience designing shipped digital products, a strong systems mindset, and a portfolio that explains your decisions. Our team works asynchronously across the United States.",
    "Build delightful experiences for teams doing their best work. Partner with product managers and engineers to explore new ideas, lead research, and build a coherent design system.\n\nThis role works from our San Francisco studio three days per week. We welcome people who enjoy collaboration and care about the details.",
    "Help make financial tools easier to understand. You’ll work across discovery, prototyping, and delivery with a small, ambitious team.\n\nWe’re looking for an experienced designer who can simplify complex information and communicate clearly with engineers and customers.",
    "Build the interfaces that power better team collaboration. Own frontend architecture, deliver accessible components, and collaborate with design on polished product experiences.\n\nWe work remotely in the United States and value pragmatism, documentation, and sustainable delivery.",
  ];
  const base = {
    recruiterId: recruiter.id,
    sponsorship: true,
    authorization: "Required" as const,
    relocation: true,
    startWithin: 6,
    agentName: "Scout",
    createdAt: new Date().toISOString(),
  };
  const jobs: Job[] = [
    {
      ...base,
      id: "forma-designer",
      company: "Forma",
      title: "Senior Product Designer",
      location: "San Francisco, CA",
      workplace: "Remote",
      salaryMin: 160000,
      salaryMax: 195000,
      description: descriptions[0],
      tags: ["Design", "Full-time", "Senior"],
      questions: [
        "What is a product decision you are particularly proud of, and why?",
      ],
    },
    {
      ...base,
      id: "layers-designer",
      company: "Layers",
      title: "Product Designer",
      location: "San Francisco, CA",
      workplace: "Hybrid",
      salaryMin: 140000,
      salaryMax: 175000,
      description: descriptions[1],
      tags: ["Design", "Full-time", "Mid-level"],
      questions: [],
    },
    {
      ...base,
      id: "ramp-designer",
      company: "Monograph",
      title: "Lead Product Designer",
      location: "New York, NY",
      workplace: "On-site",
      salaryMin: 170000,
      salaryMax: 210000,
      sponsorship: false,
      description: descriptions[2],
      tags: ["Design", "Full-time", "Lead"],
      questions: ["How do you approach collaboration with engineering?"],
    },
    {
      ...base,
      id: "orbit-engineer",
      company: "Orbit",
      title: "Senior Frontend Engineer",
      location: "Austin, TX",
      workplace: "Remote",
      salaryMin: 150000,
      salaryMax: 190000,
      description: descriptions[3],
      tags: ["Engineering", "Full-time", "Senior"],
      questions: [],
    },
  ];
  for (const j of jobs)
    db.prepare("INSERT INTO jobs(id,recruiter_id,data) VALUES(?,?,?)").run(
      j.id,
      j.recruiterId,
      JSON.stringify(j),
    );
}
seed();
