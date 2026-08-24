import { RowHeight, RowHeightClass } from "./vault-list.component";

describe("desktop vault card layout", () => {
  it("uses compact, consistently sized cards", () => {
    expect(RowHeight).toBe(64);
    expect(RowHeightClass).toBe("tw-h-[64px]");
  });
});
