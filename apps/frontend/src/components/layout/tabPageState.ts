"use client";

type FieldState = {
  key: string;
  tag: string;
  type: string;
  value?: string;
  checked?: boolean;
};

type ScrollState = {
  key: string;
  top: number;
  left: number;
};

type PageState = {
  fields: FieldState[];
  scrolls: ScrollState[];
  savedAt: number;
};

const STORAGE_KEY = "hanes-tab-page-state";
const MAX_PAGES = 20;

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const isFieldElement = (el: Element): el is FieldElement =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;

const isRestorableInput = (el: HTMLInputElement): boolean =>
  !["button", "submit", "reset", "file", "password", "hidden"].includes(el.type);

const makeElementKey = (el: Element, index: number): string => {
  const attr =
    el.getAttribute("data-tab-state-key") ||
    el.getAttribute("name") ||
    el.getAttribute("id") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("placeholder");

  if (attr) {
    return `${el.tagName.toLowerCase()}:${attr}`;
  }

  const inputType = el instanceof HTMLInputElement ? el.type : "";
  return `${el.tagName.toLowerCase()}:${inputType}:${index}`;
};

const readStore = (): Record<string, PageState> => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const writeStore = (store: Record<string, PageState>): void => {
  const entries = Object.entries(store)
    .sort((a, b) => b[1].savedAt - a[1].savedAt)
    .slice(0, MAX_PAGES);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
};

const setNativeValue = (el: FieldElement, value: string): void => {
  const valueSetter = Object.getOwnPropertyDescriptor(el, "value")?.set;
  const prototype = Object.getPrototypeOf(el);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(el, value);
  } else if (valueSetter) {
    valueSetter.call(el, value);
  } else {
    el.value = value;
  }
};

export function saveTabPageState(pathname: string, root: HTMLElement | null): void {
  if (!root || !pathname) return;

  const fields = Array.from(root.querySelectorAll("input, textarea, select"))
    .filter(isFieldElement)
    .filter((el) => !el.disabled)
    .filter((el) => !(el instanceof HTMLInputElement) || isRestorableInput(el))
    .map((el, index): FieldState => {
      const base = {
        key: makeElementKey(el, index),
        tag: el.tagName.toLowerCase(),
        type: el instanceof HTMLInputElement ? el.type : "",
      };

      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        return { ...base, checked: el.checked, value: el.value };
      }

      return { ...base, value: el.value };
    });

  const scrollCandidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  const scrolls = scrollCandidates
    .map((el, index): ScrollState | null => {
      if (el.scrollTop === 0 && el.scrollLeft === 0) return null;
      return {
        key: el === root ? "__root__" : makeElementKey(el, index),
        top: el.scrollTop,
        left: el.scrollLeft,
      };
    })
    .filter((item): item is ScrollState => Boolean(item));

  const store = readStore();
  store[pathname] = { fields, scrolls, savedAt: Date.now() };
  writeStore(store);
}

export function restoreTabPageState(pathname: string, root: HTMLElement | null): void {
  if (!root || !pathname) return;

  const state = readStore()[pathname];
  if (!state) return;

  const fieldsByKey = new Map(state.fields.map((field) => [field.key, field]));
  Array.from(root.querySelectorAll("input, textarea, select"))
    .filter(isFieldElement)
    .filter((el) => !el.disabled)
    .forEach((el, index) => {
      const field = fieldsByKey.get(makeElementKey(el, index));
      if (!field) return;

      if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        if (typeof field.checked === "boolean" && el.checked !== field.checked) {
          el.checked = field.checked;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        return;
      }

      const value = field.value ?? "";
      if (el.value !== value) {
        setNativeValue(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

  const scrollsByKey = new Map(state.scrolls.map((scroll) => [scroll.key, scroll]));
  const scrollCandidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  scrollCandidates.forEach((el, index) => {
    const scroll = scrollsByKey.get(el === root ? "__root__" : makeElementKey(el, index));
    if (!scroll) return;
    el.scrollTo({ top: scroll.top, left: scroll.left, behavior: "auto" });
  });
}
