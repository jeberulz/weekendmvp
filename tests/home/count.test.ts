import { describe, expect, test } from "vitest";
import { formatCount, parseCount } from "../../lib/home/count";

describe("count-up labels", () => {
  test.each(["226", "$15.81B", "12 hrs", "40%", "2,300+", "$1,250,000", "3.2M", "0.5x", "9"])("%s lands back on its own text", (label) => {
    const parts = parseCount(label);
    expect(parts).not.toBeNull();
    expect(formatCount(parts!, parts!.value)).toBe(label);
  });

  test("keeps prefix, decimals and grouping while counting", () => {
    const money = parseCount("$15.81B")!;
    expect(money).toEqual({ prefix: "$", value: 15.81, decimals: 2, grouped: false, suffix: "B" });
    expect(formatCount(money, 0)).toBe("$0.00B");
    expect(formatCount(money, 7.456)).toBe("$7.46B");
    const grouped = parseCount("2,300+")!;
    expect(formatCount(grouped, 1234.4)).toBe("1,234+");
    expect(formatCount(parseCount("12 hrs")!, 3.6)).toBe("4 hrs");
  });

  test("refuses labels without exactly one number", () => {
    expect(parseCount("N/A")).toBeNull();
    expect(parseCount("10-20%")).toBeNull();
    expect(parseCount("2024 to 2030")).toBeNull();
    expect(parseCount("")).toBeNull();
  });
});
