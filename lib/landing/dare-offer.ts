export const WORKSHOP_DEADLINE = "[[WORKSHOP_DATE_ISO]]";
export const DURATION_MINUTES = 90;
export const PRICE_USD = 29;
export const IDEAS = 78;

export const includes = [
  { key: "workshop", amount: 97, bonus: false },
  { key: "canvas", amount: 47, bonus: false },
  { key: "blueprint", amount: 67, bonus: false },
  { key: "plan", amount: 147, bonus: false },
  { key: "replay", amount: 47, bonus: false },
  { key: "prompts", amount: 97, bonus: true },
  { key: "invite", amount: null, bonus: true },
] as const;

export const STACK_VALUE_USD = includes.reduce((total, item) => total + (item.amount ?? 0), 0);
export const usd = (amount: number) => `$${amount}`;

const tokens: Readonly<Record<string, string>> = {
  "{price}": usd(PRICE_USD),
  "{approxValue}": `~${usd(Math.round(STACK_VALUE_USD / 100) * 100)}`,
  "{duration}": String(DURATION_MINUTES),
  "{ideas}": String(IDEAS),
};

export function dareText(text: string) {
  return text.replace(/\{[a-zA-Z]+\}/g, (token) => tokens[token] ?? token);
}
