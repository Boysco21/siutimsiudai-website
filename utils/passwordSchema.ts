import { z } from "zod";

// Single source of truth for password strength. The zod schema drives React Hook Form on the
// client, the pure `passwordRules` predicates drive the live checklist UI and the unit tests, and
// the SAME policy is mirrored server-side in supabase/config.toml
// ([auth] minimum_password_length = 8, password_requirements = "lower_upper_letters_digits_symbols")
// so a weak password is rejected even if the client is bypassed. Change the rule in both places.

export const PASSWORD_MIN_LENGTH = 8;

// Each character-class check as a standalone predicate. Exported so the sign-up screen can render a
// per-rule checklist and the tests can assert each rule independently, with no zod or React needed.
export const passwordRules = {
  length: (v: string) => v.length >= PASSWORD_MIN_LENGTH,
  upper: (v: string) => /[A-Z]/.test(v),
  lower: (v: string) => /[a-z]/.test(v),
  number: (v: string) => /[0-9]/.test(v),
  // Anything that is not a letter or a digit counts as a symbol (covers !@#$%^&* and friends).
  symbol: (v: string) => /[^A-Za-z0-9]/.test(v),
} as const;

export type PasswordRuleKey = keyof typeof passwordRules;

// Fixed display order for the checklist, top to bottom.
export const PASSWORD_RULE_ORDER: PasswordRuleKey[] = ["length", "upper", "lower", "number", "symbol"];

export interface PasswordRuleState {
  key: PasswordRuleKey;
  met: boolean;
}

/** Evaluate every rule against a candidate, in display order. Drives the live checklist. */
export function checkPasswordRules(candidate: string): PasswordRuleState[] {
  return PASSWORD_RULE_ORDER.map((key) => ({ key, met: passwordRules[key](candidate) }));
}

/** True only when a candidate satisfies every rule. The one predicate the zod schema gates on. */
export function isPasswordStrong(candidate: string): boolean {
  return PASSWORD_RULE_ORDER.every((key) => passwordRules[key](candidate));
}

// --- zod schemas -----------------------------------------------------------------------------
// Messages are machine keys; the screen maps them to localized copy (see FIELD_ERROR_KEYS in
// app/auth/sign-in.tsx). A single refine keeps sign-up password errors to ONE message so the
// checklist, not a stack of field errors, communicates the specifics.

export const emailSchema = z
  .string()
  .trim()
  .regex(/^\S+@\S+\.\S+$/, { message: "email_invalid" });

export const strongPasswordSchema = z
  .string()
  .min(1, { message: "password_required" })
  .refine(isPasswordStrong, { message: "password_weak" });

// Registration: full strength enforced.
export const signUpSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
});

// Sign-in: shape only. Existing accounts may predate the strong-password rule, so we must never
// lock a legitimate returning user out by re-validating their old password against the new policy.
export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "password_required" }),
});

// Both schemas resolve to the same value shape, so one type serves the shared form.
export type SignUpValues = z.infer<typeof signUpSchema>;
