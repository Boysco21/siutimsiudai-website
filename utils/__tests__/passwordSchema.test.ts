import {
  checkPasswordRules,
  isPasswordStrong,
  PASSWORD_MIN_LENGTH,
  passwordRules,
  signInSchema,
  signUpSchema,
} from "../passwordSchema";

// A password that satisfies every rule: >= 8 chars, upper, lower, digit, symbol.
const STRONG = "Siumai#88";

describe("password rules", () => {
  it("accepts a password that meets every requirement", () => {
    expect(isPasswordStrong(STRONG)).toBe(true);
    expect(checkPasswordRules(STRONG).every((r) => r.met)).toBe(true);
  });

  it("requires at least the minimum length", () => {
    // "Ab3$" has all four classes but is too short.
    expect(passwordRules.length("Ab3$")).toBe(false);
    expect(isPasswordStrong("Ab3$")).toBe(false);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("rejects when any single character class is missing", () => {
    expect(isPasswordStrong("siumai#88")).toBe(false); // no uppercase
    expect(isPasswordStrong("SIUMAI#88")).toBe(false); // no lowercase
    expect(isPasswordStrong("Siumaiii#")).toBe(false); // no number
    expect(isPasswordStrong("Siumai888")).toBe(false); // no symbol
    expect(isPasswordStrong("Siumai88")).toBe(false); // no symbol (all alnum)
  });

  it("reports the exact rule that fails, in display order", () => {
    const rules = checkPasswordRules("siumai88"); // missing upper + symbol
    const byKey = Object.fromEntries(rules.map((r) => [r.key, r.met]));
    expect(byKey.length).toBe(true);
    expect(byKey.lower).toBe(true);
    expect(byKey.number).toBe(true);
    expect(byKey.upper).toBe(false);
    expect(byKey.symbol).toBe(false);
    expect(rules.map((r) => r.key)).toEqual(["length", "upper", "lower", "number", "symbol"]);
  });
});

describe("signUpSchema", () => {
  it("passes a valid email + strong password and trims the email", () => {
    const parsed = signUpSchema.safeParse({ email: "  boss@siutimsiudai.app ", password: STRONG });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("boss@siutimsiudai.app");
  });

  it("flags a weak password with the password_weak key", () => {
    const parsed = signUpSchema.safeParse({ email: "boss@siutimsiudai.app", password: "weakpass" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === "password_weak")).toBe(true);
    }
  });

  it("flags an invalid email with the email_invalid key", () => {
    const parsed = signUpSchema.safeParse({ email: "not-an-email", password: STRONG });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message === "email_invalid")).toBe(true);
    }
  });
});

describe("signInSchema", () => {
  it("accepts a legacy (weak) password so returning users are never locked out", () => {
    const parsed = signInSchema.safeParse({ email: "boss@siutimsiudai.app", password: "old123" });
    expect(parsed.success).toBe(true);
  });

  it("still requires a non-empty password", () => {
    const parsed = signInSchema.safeParse({ email: "boss@siutimsiudai.app", password: "" });
    expect(parsed.success).toBe(false);
  });
});
