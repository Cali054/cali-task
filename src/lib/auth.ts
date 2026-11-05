"use client";

import { useRouter } from "next/navigation";
import { create } from "zustand";
import { LEGAL } from "./legal";
import { uid } from "./utils";

/**
 * Local-first authentication for the prototype.
 *
 * Accounts live in this browser's localStorage; passwords are salted and
 * hashed with PBKDF2 (Web Crypto) and never stored in plain text. To move to
 * a real backend, replace the functions in `authAdapter` with API calls —
 * the pages and the store below keep working unchanged.
 */

export interface Consent {
  privacyVersion: string;
  termsVersion: string;
  acceptedAt: string;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  username: string;
  createdAt: string;
  consent: Consent;
}

interface StoredUser extends User {
  salt: string;
  passwordHash: string;
}

interface Session {
  userId: string;
  at: string;
  expiresAt: string;
}

const USERS_KEY = "cali-task:users";
const SESSION_KEY = "cali-task:session";
const ATTEMPTS_KEY = "cali-task:auth-attempts";

/** "Remember me" keeps you signed in for 30 days; otherwise until the tab closes (max 12h). */
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;

/** Input limits — also stop absurdly long strings from being hashed. */
export const LIMITS = { name: 80, email: 254, username: 24, password: 128 } as const;

/* ---------- crypto ---------- */

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: 210_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

function newSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/** Constant-length comparison so a mismatch doesn't return early. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- attempt throttling ---------- */

// After 5 failures for the same account, lock it for 30s, doubling each time
// (max 15 min). A real backend must enforce this server-side as well.
const FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

type Attempts = Record<string, { fails: number; lockedUntil: number }>;

function readAttempts(): Attempts {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeAttempts(a: Attempts) {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));
  } catch {}
}
function assertNotLocked(key: string) {
  const rec = readAttempts()[key];
  if (rec && rec.lockedUntil > Date.now()) {
    const secs = Math.ceil((rec.lockedUntil - Date.now()) / 1000);
    throw new AuthError(
      `Too many attempts. Try again in ${secs < 60 ? `${secs} seconds` : `${Math.ceil(secs / 60)} minutes`}.`,
    );
  }
}
function recordFailure(key: string) {
  const all = readAttempts();
  const rec = all[key] ?? { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= FREE_ATTEMPTS) {
    const over = rec.fails - FREE_ATTEMPTS;
    rec.lockedUntil = Date.now() + Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** over);
  }
  all[key] = rec;
  writeAttempts(all);
}
function clearFailures(key: string) {
  const all = readAttempts();
  delete all[key];
  writeAttempts(all);
}

/* ---------- storage ---------- */

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    const s: Session | null = raw ? JSON.parse(raw) : null;
    // Sessions without an expiry (older builds) or past it are treated as signed out.
    if (!s || !s.expiresAt || Date.parse(s.expiresAt) < Date.now()) {
      if (s) writeSession(null);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}
function startSession(userId: string, remember: boolean) {
  const now = Date.now();
  writeSession(
    {
      userId,
      at: new Date(now).toISOString(),
      expiresAt: new Date(now + (remember ? REMEMBER_MS : SESSION_MS)).toISOString(),
    },
    remember,
  );
}
function writeSession(s: Session | null, remember = false) {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
    if (s) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}
const publicUser = (u: StoredUser): User => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  username: u.username,
  createdAt: u.createdAt,
  consent: u.consent,
});

export class AuthError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

const norm = (s: string) => s.trim().toLowerCase();
const DUMMY_SALT = "00000000000000000000000000000000";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const authAdapter = {
  async currentUser(): Promise<User | null> {
    const s = readSession();
    const u = s && readUsers().find((x) => x.id === s.userId);
    return u ? publicUser(u) : null;
  },

  async signIn(identifier: string, password: string, remember: boolean): Promise<User> {
    const id = norm(identifier).slice(0, LIMITS.email);
    const key = `login:${id}`;
    assertNotLocked(key);
    await wait(300);
    const u = readUsers().find((x) => x.email === id || x.username === id);
    // Always run the hash so a missing account takes as long as a wrong password.
    const hash = await hashPassword(password.slice(0, LIMITS.password), u?.salt ?? DUMMY_SALT);
    if (!u || !safeEqual(hash, u.passwordHash)) {
      recordFailure(key);
      throw new AuthError("Incorrect email/username or password.");
    }
    clearFailures(key);
    startSession(u.id, remember);
    return publicUser(u);
  },

  async signUp(input: { fullName: string; email: string; username: string; password: string }): Promise<User> {
    await wait(450);
    if (
      input.fullName.trim().length > LIMITS.name ||
      !EMAIL_RE.test(input.email.trim()) ||
      !USERNAME_RE.test(input.username.trim()) ||
      input.password.length < 8 ||
      input.password.length > LIMITS.password
    )
      throw new AuthError("Please check your details and try again.");
    const users = readUsers();
    const email = norm(input.email);
    const username = norm(input.username);
    if (users.some((x) => x.email === email)) throw new AuthError("An account with this email already exists.", "email");
    if (users.some((x) => x.username === username)) throw new AuthError("This username is taken.", "username");
    const salt = newSalt();
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: uid(),
      fullName: input.fullName.trim(),
      email,
      username,
      createdAt: now,
      // Consent is recorded with the document versions the user agreed to.
      consent: { privacyVersion: LEGAL.version, termsVersion: LEGAL.version, acceptedAt: now },
      salt,
      passwordHash: await hashPassword(input.password, salt),
    };
    writeUsers([...users, user]);
    startSession(user.id, true);
    return publicUser(user);
  },

  /**
   * Without an email service, a reset is confirmed by matching the account's
   * email AND username. Replace with a token-by-email flow on a real backend.
   */
  async resetPassword(email: string, username: string, newPassword: string) {
    const key = `reset:${norm(email)}`;
    assertNotLocked(key);
    await wait(450);
    const users = readUsers();
    const i = users.findIndex((x) => x.email === norm(email) && x.username === norm(username));
    if (i < 0) {
      recordFailure(key);
      throw new AuthError("No account matches that email and username.");
    }
    clearFailures(key);
    const salt = newSalt();
    users[i] = { ...users[i], salt, passwordHash: await hashPassword(newPassword, salt) };
    writeUsers(users);
  },

  async signOut() {
    writeSession(null);
  },

  usernameTaken(username: string) {
    return readUsers().some((x) => x.username === norm(username));
  },
  emailTaken(email: string) {
    return readUsers().some((x) => x.email === norm(email));
  },
  isFirstAccount() {
    return readUsers().length === 0;
  },
};

/* ---------- store ---------- */

interface AuthState {
  status: "loading" | "anon" | "authed";
  user: User | null;
  init: () => Promise<void>;
  signIn: (identifier: string, password: string, remember: boolean) => Promise<User>;
  signUp: (input: { fullName: string; email: string; username: string; password: string }) => Promise<User>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>()((set, get) => ({
  status: "loading",
  user: null,
  init: async () => {
    if (get().status !== "loading") return;
    const user = await authAdapter.currentUser();
    set({ user, status: user ? "authed" : "anon" });
  },
  signIn: async (identifier, password, remember) => {
    const user = await authAdapter.signIn(identifier, password, remember);
    set({ user, status: "authed" });
    return user;
  },
  signUp: async (input) => {
    const user = await authAdapter.signUp(input);
    set({ user, status: "authed" });
    return user;
  },
  signOut: async () => {
    await authAdapter.signOut();
    set({ user: null, status: "anon" });
  },
}));

/** Signs out and returns to the login page. */
export function useLogout() {
  const router = useRouter();
  return async () => {
    await useAuth.getState().signOut();
    router.replace("/login");
  };
}

/* ---------- validation & password strength ---------- */

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,24}$/;

export function passwordStrength(pw: string) {
  const checks = [
    { label: "At least 8 characters", ok: pw.length >= 8 },
    { label: "Upper & lowercase letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "A symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  let score = checks.filter((c) => c.ok).length;
  if (pw.length >= 14 && score >= 3) score = 4;
  if (pw.length < 8) score = Math.min(score, 1);
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["var(--st-blocked)", "var(--st-blocked)", "var(--warn)", "var(--st-progress)", "var(--st-done)"];
  return { score, label: labels[score], color: colors[score], checks };
}
