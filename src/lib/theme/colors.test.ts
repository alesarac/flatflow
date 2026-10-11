import { describe, it, expect } from "vitest";
import { colors } from "./colors";

describe("colors central configuration", () => {
  it("defines brand color correctly with verde petrolio #0F766E", () => {
    expect(colors.brand.DEFAULT).toBe("#0F766E");
    expect(colors.brand.hover).toBe("#115E59");
    expect(colors.brand.dark).toBe("#2DD4BF");
    expect(colors.brand.light).toBe("#F0FDFA");
  });

  it("defines primary action buttons with #365672", () => {
    expect(colors.action.primary.DEFAULT).toBe("#365672");
    expect(colors.action.primary.hover).toBe("#2C475E");
    expect(colors.action.primary.text).toBe("#FFFFFF");
  });

  it("defines secondary action buttons with #EDF2F7", () => {
    expect(colors.action.secondary.DEFAULT).toBe("#EDF2F7");
    expect(colors.action.secondary.hover).toBe("#E2E8F0");
    expect(colors.action.secondary.text).toBe("#365672");
  });

  it("defines all task status colors (success, info, warning, danger)", () => {
    // Completato (success)
    expect(colors.status.success.bg).toBe("#EAF9F1");
    expect(colors.status.success.border).toBe("#C6EED8");
    expect(colors.status.success.accent).toBe("#10B981");

    // In corso (info)
    expect(colors.status.info.bg).toBe("#EFF6FF");
    expect(colors.status.info.border).toBe("#D9E7F5");

    // Da coprire (warning)
    expect(colors.status.warning.bg).toBe("#FFFAE8");
    expect(colors.status.warning.border).toBe("#F5E9B7");

    // Urgente / spazzatura (danger)
    expect(colors.status.danger.bg).toBe("#FFF1F2");
    expect(colors.status.danger.border).toBe("#FECDD3");
  });

  it("defines history card colors", () => {
    expect(colors.history.bg).toBe("#F4F7FB");
    expect(colors.history.border).toBe("#E2E8F0");
    expect(colors.history.darkBg).toBe("#172033");
  });

  it("defines surfaces and text colors", () => {
    expect(colors.surface.bgLight).toBe("#F8FAFC");
    expect(colors.surface.bgDark).toBe("#090D16");
    expect(colors.surface.cardLight).toBe("#FFFFFF");
    expect(colors.surface.cardDark).toBe("#1E293B");
    expect(colors.text.light.primary).toBe("#0F172A");
    expect(colors.text.dark.primary).toBe("#F8FAFC");
  });
});
