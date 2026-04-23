import { normalizePhone } from "@/lib/utils";
import type { ShowContact } from "@/lib/types";

export const CONTACT_ROLES = [
  { key: "day_of_show", label: "Day of Show" },
  { key: "promoter", label: "Promoter" },
  { key: "production", label: "Production" },
  { key: "hospitality", label: "Hospitality" },
  { key: "custom", label: "Custom" },
] as const;

export type ContactRoleKey = (typeof CONTACT_ROLES)[number]["key"];

const ROLE_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  CONTACT_ROLES.map((r) => [r.key, r.label]),
);

export function roleLabel(row: Pick<ShowContact, "role" | "role_label">): string {
  if (row.role === "custom") return row.role_label?.trim() || "Contact";
  return ROLE_LABEL_BY_KEY[row.role] ?? "Contact";
}

export function isKnownRole(role: string): role is ContactRoleKey {
  return role in ROLE_LABEL_BY_KEY;
}

export type ContactLike = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

function normalizeField(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function contactKey(c: ContactLike): string {
  const phone = normalizePhone((c.phone ?? "").trim());
  return [normalizeField(c.name), phone, normalizeField(c.email)].join("|");
}

/** True when `candidate` matches any row in `existing` on (name + phone + email).
 *  Used to dedupe AI-parsed contacts against what's already on the show. */
export function isDuplicateContact(candidate: ContactLike, existing: ContactLike[]): boolean {
  const key = contactKey(candidate);
  return existing.some((e) => contactKey(e) === key);
}
