import { describe, it, expect, vi } from "vitest";
import { processOrder } from "./order";

vi.mock("./db");
vi.mock("./email");
vi.mock("./logger");
vi.mock("./metrics");
vi.mock("./auth");

describe("processOrder", () => {
  const dbSpy = vi.fn();
  const emailSpy = vi.fn();
  const logSpy = vi.fn();

  it("calls db.save", async () => {
    await processOrder({ id: 1 });
    expect(dbSpy).toHaveBeenCalledWith({ id: 1 });
  });

  it("calls email.send", async () => {
    await processOrder({ id: 2 });
    expect(emailSpy).toHaveBeenCalledTimes(1);
  });

  it("calls logger.log", async () => {
    await processOrder({ id: 3 });
    expect(logSpy).toHaveBeenCalled();
  });

  it("returns truthy", async () => {
    const r = await processOrder({ id: 4 });
    expect(r).toBeTruthy();
  });
});
