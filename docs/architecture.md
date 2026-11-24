# V1 architecture

The candidate profile is the source of truth for _new_ screenings. Each fact contains a value and an independent auto-share flag. Discovery is separate consent: turning it on exposes a candidate’s name, headline, and agent name in the recruiter directory and permits recruiters to initiate screening against their own jobs.

## Screening flow

1. Authenticate the session. Candidates can initiate only for themselves. Recruiters can initiate only for their own jobs and active, discoverable candidate agents.
2. Check for an existing candidate/job screening and return it if present.
3. The recruiter protocol emits a question for each logistics field, then custom questions.
4. The candidate protocol returns approved, nonempty facts only. Private or missing facts produce a pending item; no private value is copied into the screening object or transcript.
5. Compare disclosed values with explicit job requirements. Conflicts remain discussion items, never rejections.
6. Save checks and messages to SQLite before optional model work. A model failure does not discard the screening.
7. Optionally summarize disclosed checks through the Responses API. Write the recap only if the screening has not changed while the request was in flight.
8. Candidate approvals append to the transcript and update the relevant check. “Remember” separately authorizes future reuse. Profile update and screening update run in one SQLite transaction.

A new custom question always requires candidate input. Reused custom answers match the entire exact question, not a model’s interpretation of similarity, and remain human-review items.

## Endpoints

All mutations require JSON and a same-origin browser request. Sessions are HTTP-only cookies; server-side queries scope screens to the authenticated user.

| Endpoint                         | Purpose                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `GET /api/state`                 | Public jobs and the current user’s own profile/inbox; opted-in directory for recruiters |
| `POST /api/register`             | Local candidate or recruiter account                                                    |
| `POST /api/login`, `/api/logout` | Session management                                                                      |
| `POST /api/demo`                 | Explicitly accessible fictional demo account                                            |
| `POST /api/profile`              | Candidate-only profile, permissions, reusable answers                                   |
| `POST /api/agent`                | Recruiter agent name, propagated to their job posts                                     |
| `POST /api/job`                  | Recruiter-only job publication                                                          |
| `POST /api/screen`               | Candidate-initiated or consented recruiter-initiated screening                          |
| `POST /api/answer`               | Screening owner approves an answer and optionally its reuse                             |

This is an internal V1 API, not a versioned external agent API.

## Storage

`users` stores public account data, hashed credentials, candidate profiles, and recruiter agent names. `sessions` stores expiring opaque tokens. `jobs` stores requirements scoped by recruiter. `screenings` stores results scoped by candidate and recruiter with a unique `(job_id, candidate_id)` key. Flexible domain payloads use JSON inside SQLite rows; owner IDs and uniqueness constraints remain SQL columns.

## Privacy and reliability tradeoffs

Already-shared answers are retained in conversation history. Revoking auto-share prevents future sharing; it cannot retroactively remove facts already disclosed. There is no deletion or withdrawal workflow yet. Shared demo accounts are for exploration and should contain only fictional information.

The default app sends no screening data to an AI service. Enabling the optional API key sends only disclosed checks for summarization. Recaps are descriptive and never authoritative for eligibility or hiring decisions. The agent protocol is deterministic in both modes.

For production, replace demo access and local identity, add verified ownership, abuse prevention, audit and retention policies, explicit provider consent, secure deployment, backup/migration tooling, and observability. SQLite persistence is appropriate for the requested local V1; horizontal deployment requires additional design.
