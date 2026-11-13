import { describe, it, expect } from "vitest";
import { authErrorKey, isAuthErrorKey, isValidEmail, isValidPhone, passwordStrength } from "./auth-errors";

describe("authErrorKey", () => {
  it.each([
    [{ code: "invalid_credentials" }, "invalidCredentials"],
    [{ code: "email_not_confirmed" }, "emailNotConfirmed"],
    [{ code: "over_email_send_rate_limit" }, "rateLimited"],
    [{ status: 429, message: "whatever" }, "rateLimited"],
    [{ code: "weak_password" }, "weakPassword"],
    [{ code: "same_password" }, "samePassword"],
    [{ code: "otp_expired" }, "linkExpired"],
    [{ message: "Invalid login credentials" }, "invalidCredentials"],
    [{ message: "Password should be at least 8 characters" }, "weakPassword"],
  ])("maps %j → %s", (err, key) => {
    expect(authErrorKey(err)).toBe(key);
  });

  it("does not reveal existing accounts", () => {
    expect(authErrorKey({ code: "user_already_exists", message: "User already registered" })).toBe("generic");
  });

  it("handles junk", () => {
    expect(authErrorKey(null)).toBe("generic");
    expect(authErrorKey("boom")).toBe("generic");
    expect(isAuthErrorKey("rateLimited")).toBe(true);
    expect(isAuthErrorKey("User already registered")).toBe(false);
  });
});

describe("field checks", () => {
  it("validates email", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail(" a@b.co ")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });

  it("validates phone", () => {
    expect(isValidPhone("+962 79 123 4567")).toBe(true);
    expect(isValidPhone("0791234567")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
    expect(isValidPhone("abc1234567")).toBe(false);
  });

  it("scores password strength", () => {
    expect(passwordStrength("")).toBe(0);
    expect(passwordStrength("abc")).toBe(1);
    expect(passwordStrength("abcdefgh")).toBe(1);
    expect(passwordStrength("abcdefgh1")).toBe(2);
    expect(passwordStrength("Abcdefgh1")).toBe(3);
    expect(passwordStrength("Abcdefgh1!xyz")).toBe(4);
  });
});
