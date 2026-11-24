import { blankProfile, type User, type Job } from "./types";
export function demoSeed() {
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
  return { candidate, recruiter, profile, jobs };
}
