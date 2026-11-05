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
}

const USERS_KEY = "cali-task:users";
const SESSION_KEY = "cali-task:session";

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
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const authAdapter = {
  async currentUser(): Promise<User | null> {
    const s = readSession();
    const u = s && readUsers().find((x) => x.id === s.userId);
    return u ? publicUser(u) : null;
  },

  async signIn(identifier: string, password: string, remember: boolean): Promise<User> {
    await wait(450); // keep timing similar whether or not the account exists
    const id = norm(identifier);
    const u = readUsers().find((x) => x.email === id || x.username === id);
    if (!u || (await hashPassword(password, u.salt)) !== u.passwordHash)
      throw new AuthError("Incorrect email/username or password.");
    writeSession({ userId: u.id, at: new Date().toISOString() }, remember);
    return publicUser(u);
  },

  async signUp(input: { fullName: string; email: string; username: string; password: string }): Promise<User> {
    await wait(450);
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
    writeSession({ userId: user.id, at: now }, true);
    return publicUser(user);
  },

  /**
   * Without an email service, a reset is confirmed by matching the account's
   * email AND username. Replace with a token-by-email flow on a real backend.
   */
  async resetPassword(email: string, username: string, newPassword: string) {
    await wait(450);
    const users = readUsers();
    const i = users.findIndex((x) => x.email === norm(email) && x.username === norm(username));
    if (i < 0) throw new AuthError("No account matches that email and username.");
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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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
