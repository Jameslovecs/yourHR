import { NextRequest, NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  db,
  userById,
  profileById,
  allJobs,
  screeningsFor,
  saveScreening,
  hashPassword,
  verifyPassword,
} from "@/lib/db";
import {
  blankProfile,
  type User,
  type Profile,
  type Job,
  type Screening,
  type Field,
} from "@/lib/types";
import {
  runScreening,
  evaluate,
  displayAnswer,
  overall,
} from "@/lib/screening";
import {
  profileSchema,
  jobSchema,
  answerSchema,
  isFact,
} from "@/lib/validation";
import { summarize } from "@/lib/summary";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function current(req: NextRequest): User | null {
  const token = req.cookies.get("yourhr_session")?.value;
  if (!token) return null;
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE token=? AND expires>?")
    .get(token, Date.now()) as { user_id: string } | undefined;
  return row ? userById(row.user_id) : null;
}
function login(user: User) {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    token,
    user.id,
    Date.now() + 7 * 86400000,
  );
  const res = NextResponse.json({ ok: true });
  res.cookies.set("yourhr_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.SECURE_COOKIES === "true",
    path: "/",
    maxAge: 7 * 86400,
  });
  return res;
}
function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
export async function GET(req: NextRequest) {
  if (!req.nextUrl.pathname.endsWith("/state")) return fail("Not found", 404);
  const user = current(req);
  const candidates =
    user?.role === "recruiter"
      ? (
          db.prepare("SELECT data,profile FROM users").all() as {
            data: string;
            profile: string;
          }[]
        ).flatMap((row) => {
          const u: User = JSON.parse(row.data),
            p: Profile = JSON.parse(row.profile);
          return u.role === "candidate" && p.discoverable && p.active
            ? [
                {
                  id: u.id,
                  name: u.name,
                  headline: p.headline,
                  agentName: p.agentName,
                },
              ]
            : [];
        })
      : [];
  const agent = user
    ? (
        db.prepare("SELECT agent FROM users WHERE id=?").get(user.id) as {
          agent: string;
        }
      ).agent
    : "";
  return NextResponse.json({
    user,
    profile: user?.role === "candidate" ? profileById(user.id) : null,
    jobs: allJobs(),
    screenings: user ? screeningsFor(user) : [],
    candidates,
    mode: process.env.OPENAI_API_KEY ? "ai" : "demo",
    recruiterAgent: agent,
  });
}
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return fail("Invalid origin.", 403);
    }
    if (originHost !== req.headers.get("host"))
      return fail("Cross-origin requests are not allowed.", 403);
  }
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return fail("JSON content type required.", 415);
  try {
    const action = req.nextUrl.pathname.split("/").pop();
    const body = await req.json();
    const user = current(req);
    if (action === "demo") {
      if (process.env.DISABLE_DEMO === "true")
        return fail("Demo accounts are disabled.", 403);
      const role = z.enum(["candidate", "recruiter"]).parse(body.role);
      return login(userById(`demo-${role}`)!);
    }
    if (action === "register") {
      const v = z
        .object({
          name: z.string().trim().min(2).max(100),
          email: z.email().max(254),
          password: z.string().min(10).max(200),
          role: z.enum(["candidate", "recruiter"]),
          company: z.string().trim().max(100).default(""),
        })
        .parse(body);
      const email = v.email.toLowerCase();
      if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
        return fail("An account with that email already exists.");
      const u: User = {
        id: randomUUID(),
        name: v.name,
        email,
        role: v.role,
        company: v.company,
        demo: false,
      };
      db.prepare(
        "INSERT INTO users(id,email,password,data,profile,agent) VALUES(?,?,?,?,?,?)",
      ).run(
        u.id,
        email,
        hashPassword(v.password),
        JSON.stringify(u),
        JSON.stringify(blankProfile(u.name)),
        `${v.company || v.name.split(" ")[0]}'s agent`,
      );
      return login(u);
    }
    if (action === "login") {
      const v = z
        .object({ email: z.string().max(254), password: z.string().max(200) })
        .parse(body);
      const row = db
        .prepare("SELECT id,password FROM users WHERE email=?")
        .get(v.email.toLowerCase()) as
        { id: string; password: string } | undefined;
      if (!row || !verifyPassword(v.password, row.password))
        return fail("Email or password is incorrect.", 401);
      return login(userById(row.id)!);
    }
    if (action === "logout") {
      const token = req.cookies.get("yourhr_session")?.value;
      if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("yourhr_session");
      return res;
    }
    if (!user) return fail("Sign in to continue.", 401);
    if (action === "profile") {
      if (user.role !== "candidate")
        return fail("Only candidates can update this profile.", 403);
      const p = profileSchema.parse(body);
      db.prepare("UPDATE users SET profile=? WHERE id=?").run(
        JSON.stringify(p),
        user.id,
      );
      return NextResponse.json({ ok: true });
    }
    if (action === "agent") {
      if (user.role !== "recruiter")
        return fail("Recruiter access required.", 403);
      const name = z.string().trim().min(1).max(100).parse(body.name);
      db.prepare("UPDATE users SET agent=? WHERE id=?").run(name, user.id);
      for (const j of allJobs().filter((j) => j.recruiterId === user.id)) {
        j.agentName = name;
        db.prepare("UPDATE jobs SET data=? WHERE id=?").run(
          JSON.stringify(j),
          j.id,
        );
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "job") {
      if (user.role !== "recruiter")
        return fail("Recruiter access required.", 403);
      const v = jobSchema.parse(body);
      const agent = (
        db.prepare("SELECT agent FROM users WHERE id=?").get(user.id) as {
          agent: string;
        }
      ).agent;
      const job: Job = {
        ...v,
        id: randomUUID(),
        recruiterId: user.id,
        agentName: agent,
        createdAt: new Date().toISOString(),
      };
      db.prepare("INSERT INTO jobs(id,recruiter_id,data) VALUES(?,?,?)").run(
        job.id,
        user.id,
        JSON.stringify(job),
      );
      return NextResponse.json({ ok: true, id: job.id });
    }
    if (action === "screen") {
      const v = z
        .object({ jobId: z.string(), candidateId: z.string().optional() })
        .parse(body);
      const job = allJobs().find((j) => j.id === v.jobId);
      if (!job) return fail("Job not found.", 404);
      const candidateId = user.role === "candidate" ? user.id : v.candidateId;
      const candidate = candidateId ? userById(candidateId) : null;
      if (!candidate || candidate.role !== "candidate")
        return fail("Candidate not found.", 404);
      const profile = profileById(candidate.id);
      if (!profile.active) return fail("The candidate agent is paused.");
      if (
        user.role === "recruiter" &&
        (job.recruiterId !== user.id || !profile.discoverable)
      )
        return fail(
          "Candidate has not opted in, or this job is not yours.",
          403,
        );
      const existing = db
        .prepare(
          "SELECT data FROM screenings WHERE job_id=? AND candidate_id=?",
        )
        .get(job.id, candidate.id) as { data: string } | undefined;
      if (existing)
        return NextResponse.json({
          ok: true,
          id: JSON.parse(existing.data).id,
          existing: true,
        });
      const now = new Date().toISOString();
      const result = runScreening(profile, job);
      const s: Screening = {
        ...result,
        id: randomUUID(),
        jobId: job.id,
        candidateId: candidate.id,
        candidateName: candidate.name,
        recruiterId: job.recruiterId,
        company: job.company,
        jobTitle: job.title,
        candidateAgent: profile.agentName,
        recruiterAgent: job.agentName,
        createdAt: now,
        updatedAt: now,
      };
      // Persist before optional AI work to avoid losing or duplicating a screening.
      saveScreening(s);
      const summary = await summarize(s);
      const latest = JSON.parse(
        (
          db.prepare("SELECT data FROM screenings WHERE id=?").get(s.id) as {
            data: string;
          }
        ).data,
      ) as Screening;
      if (latest.updatedAt === now) saveScreening({ ...latest, ...summary });
      return NextResponse.json({ ok: true, id: s.id });
    }
    if (action === "answer") {
      const v = answerSchema.parse(body);
      const row = db
        .prepare("SELECT data FROM screenings WHERE id=?")
        .get(v.screeningId) as { data: string } | undefined;
      if (!row) return fail("Screening not found.", 404);
      const s: Screening = JSON.parse(row.data);
      if (user.role !== "candidate" || s.candidateId !== user.id)
        return fail("Only the candidate can approve answers.", 403);
      const check = s.checks.find((c) => c.field === v.field);
      if (!check) return fail("Question not found.", 404);
      const job = allJobs().find((j) => j.id === s.jobId)!;
      const p = profileById(user.id);
      if (isFact(v.field)) {
        const field = v.field as Field;
        const proposed = structuredClone(p);
        proposed.facts[field] = { value: v.answer, share: true };
        profileSchema.parse(proposed);
        Object.assign(check, evaluate(field, v.answer, job), {
          answer: displayAnswer(field, v.answer),
          source: "Candidate approved",
        });
        if (v.remember) p.facts[field] = { value: v.answer, share: true };
      } else {
        check.answer = v.answer;
        check.status = "review";
        check.reason = "Candidate answered. Recruiter review required.";
        check.source = "Candidate approved";
        if (v.remember) p.savedAnswers[check.question] = v.answer;
      }
      s.messages.push(
        { speaker: "system", text: "Candidate reviewed a question." },
        { speaker: "recruiter", text: check.question },
        { speaker: "candidate", text: check.answer! },
      );
      s.status = overall(s.checks);
      s.updatedAt = new Date().toISOString();
      delete s.aiSummary;
      s.summaryMode = "demo";
      db.exec("BEGIN");
      try {
        db.prepare("UPDATE users SET profile=? WHERE id=?").run(
          JSON.stringify(p),
          user.id,
        );
        saveScreening(s);
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return NextResponse.json({ ok: true });
    }
    return fail("Not found.", 404);
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(
        e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" "),
      );
    console.error(
      "Request failed:",
      e instanceof Error ? e.message : "Unknown error",
    );
    return fail("Something went wrong. Please try again.", 500);
  }
}
