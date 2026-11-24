import { createClient } from "@supabase/supabase-js";
import {
  newSandbox,
  sandboxState,
  sandboxAction,
  type Sandbox,
} from "./sandbox";
import type { AppState } from "./types";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const staticTrial = process.env.NEXT_PUBLIC_STATIC_TRIAL === "true";
export const cloudEnabled = !!url && !!key;
const cloud = cloudEnabled ? createClient(url, key) : null;
const storageKey = "yourhr.sandbox.v1",
  modeKey = "yourhr.mode.v1";
let memory: Sandbox | undefined;
function load(): Sandbox {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.version === 1 &&
        Array.isArray(parsed.screens) &&
        parsed.profile?.facts
      )
        return (memory = parsed);
    }
  } catch {}
  return (memory = newSandbox());
}
function save(s: Sandbox) {
  memory = s;
  try {
    localStorage.setItem(storageKey, JSON.stringify(s));
  } catch {
    throw new Error(
      "Browser storage is full or disabled. Clear demo data or allow site storage.",
    );
  }
}
export function demoActive() {
  return (
    typeof window !== "undefined" && localStorage.getItem(modeKey) === "demo"
  );
}
async function rpc(action: string, payload: unknown = {}) {
  const { data, error } = await cloud!.rpc("yourhr_action", {
    action,
    payload,
  });
  if (error) throw new Error(error.message);
  return data;
}
export async function getState(): Promise<AppState> {
  if (demoActive() || (!cloudEnabled && staticTrial))
    return sandboxState(load());
  if (cloud) {
    await cloud.auth.getSession();
    return rpc("state");
  }
  const r = await fetch("/api/state", { cache: "no-store" });
  if (!r.ok) throw new Error("Could not load your workspace");
  return r.json();
}
export async function request(action: string, body: unknown) {
  if (action === "demo") {
    localStorage.setItem(modeKey, "demo");
    const r = sandboxAction(load(), action, body);
    save(r.sandbox);
    return r.result;
  }
  if (action === "reset-demo") {
    save(newSandbox());
    localStorage.setItem(modeKey, "demo");
    return { ok: true };
  }
  if ((action === "login" || action === "register") && cloud) {
    const v = body as {
      email: string;
      password: string;
      name: string;
      role: string;
      company: string;
    };
    const result =
      action === "register"
        ? await cloud.auth.signUp({
            email: v.email,
            password: v.password,
            options: {
              emailRedirectTo: window.location.origin,
              data: { name: v.name, role: v.role, company: v.company },
            },
          })
        : await cloud.auth.signInWithPassword({
            email: v.email,
            password: v.password,
          });
    if (result.error) throw result.error;
    localStorage.removeItem(modeKey);
    return {
      ok: true,
      verifyEmail: action === "register" && !result.data.session,
    };
  }
  if (demoActive() || (staticTrial && !cloudEnabled)) {
    if (action === "login" || action === "register")
      throw new Error(
        "Real accounts are not enabled on this demo. Try either demo role instead.",
      );
    const r = sandboxAction(load(), action, body);
    save(r.sandbox);
    if (action === "logout") localStorage.removeItem(modeKey);
    return r.result;
  }
  if (cloud) {
    if (action === "logout") {
      const { error } = await cloud.auth.signOut();
      if (error) throw error;
      return { ok: true };
    }
    const result = await rpc(action, body);
    if (action === "delete-account") await cloud.auth.signOut();
    return result;
  }
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
