import { z } from "zod";
import { fields } from "./types";
const text = z.string().trim().max(200);
const fact = (value: z.ZodType) => z.object({ value, share: z.boolean() });
const choice = (values: [string, ...string[]]) => z.enum(["", ...values]);
const numberText = (max: number) =>
  z
    .string()
    .refine(
      (v) => v === "" || (/^\d+$/.test(v) && Number(v) <= max),
      "Enter a valid non-negative number.",
    );
export const profileSchema = z.object({
  agentName: text.min(1),
  headline: z.string().trim().max(300),
  discoverable: z.boolean(),
  active: z.boolean(),
  facts: z.object({
    location: fact(text),
    authorization: fact(choice(["Yes", "No"])),
    sponsorship: fact(choice(["Yes", "No"])),
    relocation: fact(choice(["Yes", "No"])),
    workplace: fact(choice(["Remote", "Hybrid", "On-site", "Flexible"])),
    salary: fact(numberText(10000000)),
    availability: fact(numberText(104)),
  }),
  savedAnswers: z
    .record(z.string().max(500), z.string().trim().min(1).max(4000))
    .refine((v) => Object.keys(v).length <= 100),
});
export const jobSchema = z
  .object({
    title: text.min(3),
    company: text.min(1),
    location: text.min(2),
    workplace: z.enum(["Remote", "Hybrid", "On-site"]),
    salaryMin: z.number().int().min(0).max(10000000),
    salaryMax: z.number().int().min(1).max(10000000),
    sponsorship: z.boolean(),
    authorization: z.enum(["Required", "Flexible"]),
    relocation: z.boolean(),
    startWithin: z.number().int().min(0).max(104),
    description: z.string().trim().min(30).max(10000),
    tags: z.array(text.min(1)).max(6),
    questions: z.array(z.string().trim().min(3).max(500)).max(5),
  })
  .refine((v) => v.salaryMax >= v.salaryMin, {
    message: "Maximum salary must be at least the minimum salary.",
  })
  .refine((v) => new Set(v.questions).size === v.questions.length, {
    message: "Custom questions must be unique.",
  });
export const answerSchema = z.object({
  screeningId: z.string(),
  field: z.string().max(600),
  answer: z.string().trim().min(1).max(4000),
  remember: z.boolean(),
});
export const isFact = (s: string) =>
  fields.includes(s as (typeof fields)[number]);
