export const WORKSHOP_DEADLINE = "2099-01-01T00:00:00+00:00";
export const NEXT_DATE_STATUS = "Next date coming soon";
export const DURATION_MINUTES = 90;
export const PRICE_USD = 9;
export const BUILDERS = 400;
export const IDEAS = 78;

export const includes = [
  { key: "workshop", usd: 97, bonus: false },
  { key: "sheet", usd: 47, bonus: false },
  { key: "replay", usd: 47, bonus: false },
  { key: "plan", usd: 199, bonus: false },
  { key: "builder", usd: 199, bonus: true },
  { key: "kit", usd: 149, bonus: true },
] as const;

export const STACK_VALUE_USD = includes.reduce((total, item) => total + item.usd, 0);
export const BONUS_VALUE_USD = includes.reduce((total, item) => total + (item.bonus ? item.usd : 0), 0);

export const usd = (amount: number) => `$${amount}`;

const tokens = {
  "{price}": usd(PRICE_USD),
  "{stackValue}": usd(STACK_VALUE_USD),
  "{duration}": String(DURATION_MINUTES),
  "{builders}": String(BUILDERS),
  "{ideas}": String(IDEAS),
};

export function shipableText(text: string) {
  return text.replace(/\{(?:price|stackValue|duration|builders|ideas)\}/g, (token: keyof typeof tokens) => tokens[token]);
}
