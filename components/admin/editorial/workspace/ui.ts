/** Shared class strings for the idea workspace (tabs, panels, cards). */

export const tabListClass = "flex min-w-0 flex-wrap items-end gap-x-1";

export const tabTriggerClass =
  "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm font-medium text-(--ed-text-2) outline-hidden hover:text-(--ed-text) data-[state=active]:border-(--ed-text) data-[state=active]:text-(--ed-text) focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-(--ed-focus) sm:px-3";

export const tabPanelClass =
  "outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-(--ed-focus)";

export const cardClass = "rounded-lg border border-(--ed-border) bg-(--ed-surface)";

export const smallButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-(--ed-input) bg-(--ed-surface) px-2.5 text-sm font-medium text-(--ed-text) outline-hidden hover:bg-(--ed-sunk) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) disabled:cursor-not-allowed disabled:opacity-50";

export const textButtonClass =
  "inline-flex min-h-8 items-center gap-1 rounded text-sm font-medium text-(--ed-text) underline underline-offset-2 outline-hidden hover:text-(--ed-text-2) focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus)";

export const pressedToggleClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ed-focus) aria-pressed:border-(--ed-text) aria-pressed:bg-(--ed-text) aria-pressed:text-white border-(--ed-input) bg-(--ed-surface) text-(--ed-text) hover:bg-(--ed-sunk) aria-pressed:hover:bg-(--ed-primary-hover)";

export const menuItemClass =
  "flex min-h-10 cursor-default select-none items-center gap-2 rounded px-2.5 text-sm text-(--ed-text) outline-hidden data-[highlighted]:bg-(--ed-sunk) data-[highlighted]:outline-2 data-[highlighted]:outline-solid data-[highlighted]:-outline-offset-2 data-[highlighted]:outline-(--ed-focus) data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";
