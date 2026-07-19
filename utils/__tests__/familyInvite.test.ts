import {
  ACCEPT_REASON_KEYS,
  acceptReasonKey,
  buildInviteUrl,
  CREATE_REASON_KEYS,
  createReasonKey,
  FAMILY_MAX_MEMBERS,
  INVITE_WEB_BASE,
  isDemoToken,
  isDependent,
  isGroupFull,
  isManager,
  makeDemoToken,
  parseInviteToken,
  remainingSeats,
} from "../familyInvite";

describe("invite links", () => {
  it("builds an https universal link for a token", () => {
    expect(buildInviteUrl("abc123")).toBe(`${INVITE_WEB_BASE}/invite/abc123`);
  });

  it("url-encodes the token in the built link", () => {
    // A slash inside the token must not create an extra path segment.
    expect(buildInviteUrl("a/b")).toBe(`${INVITE_WEB_BASE}/invite/a%2Fb`);
  });

  it("round-trips a token through build then parse", () => {
    const url = buildInviteUrl("Siumai88Token");
    expect(parseInviteToken(url)).toBe("Siumai88Token");
  });

  it("parses the token from every deep-link shape", () => {
    expect(parseInviteToken("https://siutimsiudai.app/invite/TOKEN")).toBe("TOKEN");
    expect(parseInviteToken("siutimsiudai://invite/TOKEN")).toBe("TOKEN");
    expect(parseInviteToken("exp://192.168.1.5:8081/--/invite/TOKEN")).toBe("TOKEN");
  });

  it("ignores a trailing slash and any query or fragment", () => {
    expect(parseInviteToken("https://siutimsiudai.app/invite/TOKEN/")).toBe("TOKEN");
    expect(parseInviteToken("https://siutimsiudai.app/invite/TOKEN?utm=sms")).toBe("TOKEN");
    expect(parseInviteToken("https://siutimsiudai.app/invite/TOKEN#x")).toBe("TOKEN");
  });

  it("returns null for non-invite or empty urls", () => {
    expect(parseInviteToken(null)).toBeNull();
    expect(parseInviteToken(undefined)).toBeNull();
    expect(parseInviteToken("https://siutimsiudai.app/")).toBeNull();
    expect(parseInviteToken("https://siutimsiudai.app/recipe/42")).toBeNull();
    expect(parseInviteToken("https://siutimsiudai.app/invite/")).toBeNull();
  });
});

describe("group-size math", () => {
  it("caps a household at one manager plus five dependents", () => {
    expect(FAMILY_MAX_MEMBERS).toBe(6);
  });

  it("reports full only at or beyond the cap", () => {
    expect(isGroupFull(5)).toBe(false);
    expect(isGroupFull(6)).toBe(true);
    expect(isGroupFull(7)).toBe(true);
  });

  it("counts remaining seats without going negative", () => {
    expect(remainingSeats(1)).toBe(5);
    expect(remainingSeats(6)).toBe(0);
    expect(remainingSeats(9)).toBe(0);
  });
});

describe("role helpers", () => {
  it("identifies manager and dependent", () => {
    expect(isManager("manager")).toBe(true);
    expect(isManager("dependent")).toBe(false);
    expect(isManager(null)).toBe(false);
    expect(isDependent("dependent")).toBe(true);
    expect(isDependent("manager")).toBe(false);
    expect(isDependent(undefined)).toBe(false);
  });
});

describe("reason to i18n key maps", () => {
  it("maps every known accept reason and falls back generically", () => {
    expect(acceptReasonKey("expired")).toBe("family.errExpired");
    expect(acceptReasonKey("already_linked")).toBe("family.errAlreadyLinked");
    expect(acceptReasonKey("self")).toBe("family.errSelf");
    expect(acceptReasonKey("revoked")).toBe("family.errInvalid");
    expect(acceptReasonKey("something_new")).toBe("family.errAcceptGeneric");
    expect(acceptReasonKey(null)).toBe("family.errAcceptGeneric");
    // Every mapped value is a real family.* key.
    Object.values(ACCEPT_REASON_KEYS).forEach((k) => expect(k.startsWith("family.")).toBe(true));
  });

  it("maps create-invite reasons and falls back generically", () => {
    expect(createReasonKey("max_required")).toBe("family.errMaxRequired");
    expect(createReasonKey("group_full")).toBe("family.errGroupFull");
    expect(createReasonKey("unknown")).toBe("family.errGenerate");
    expect(createReasonKey("boom")).toBe("family.errGenerate");
    Object.values(CREATE_REASON_KEYS).forEach((k) => expect(k.startsWith("family.")).toBe(true));
  });
});

describe("demo token", () => {
  it("mints a recognizable demo token", () => {
    const t = makeDemoToken();
    expect(isDemoToken(t)).toBe(true);
    expect(t.length).toBeGreaterThan(6);
  });

  it("does not mistake a real token for a demo one", () => {
    expect(isDemoToken("Siumai88Token")).toBe(false);
    expect(isDemoToken(null)).toBe(false);
  });
});
