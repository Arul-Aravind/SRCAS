import { describe, expect, it } from "vitest";
import { validateAdminCredentials } from "@/lib/adminAuth";

describe("admin authentication", () => {
  it("accepts the configured administrator credentials", () => {
    expect(validateAdminCredentials("admin", "admin@123")).toBe(true);
  });

  it("rejects incorrect or incomplete credentials", () => {
    expect(validateAdminCredentials("admin", "wrong")).toBe(false);
    expect(validateAdminCredentials("", "admin@123")).toBe(false);
  });
});
