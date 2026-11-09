import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("./supabase", () => ({ supabase: { auth } }));

import { changePassword } from "./passwordReset";

beforeEach(() => {
  auth.signInWithPassword.mockReset();
  auth.updateUser.mockReset();
});

describe("changePassword", () => {
  it("checks the current password first and does not change anything when it is wrong", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    expect(await changePassword("a@b.edu", "wrong", "newpassword1")).toBe("Your current password is not right.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("saves the new password once the current one is right", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    expect(await changePassword(" a@b.edu ", "oldpassword1", "newpassword1")).toBeNull();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.edu", password: "oldpassword1" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "newpassword1" });
  });

  it("explains a reused password in plain words", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.updateUser.mockResolvedValue({ error: { message: "New password should be different from the old password." } });
    expect(await changePassword("a@b.edu", "oldpassword1", "oldpassword1")).toBe("Choose a password you have not used before.");
  });

  it("tells the person to wait when too many tries were made", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { message: "Too many requests" } });
    expect(await changePassword("a@b.edu", "x", "newpassword1")).toBe("Too many tries. Please wait a minute.");
  });
});
