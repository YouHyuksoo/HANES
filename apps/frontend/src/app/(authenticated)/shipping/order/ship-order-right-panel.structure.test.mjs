import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping order registration uses a right-side panel instead of a form modal", () => {
  assert.doesNotMatch(source, /const \[isModalOpen, setIsModalOpen\]/, "create/edit form should not be controlled by a modal flag");
  assert.doesNotMatch(source, /<Modal[\s\S]*shipping\.shipOrder\.(editTitle|addTitle)/, "create/edit form should not render inside Modal");
  assert.doesNotMatch(source, /import \{[^}]*\bModal\b[^}]*\} from "@\/components\/ui"/, "page should not import the shared Modal for the order form");

  assert.match(source, /const \[isFormPanelOpen, setIsFormPanelOpen\]/, "page should control a right-side form panel");
  assert.match(source, /<aside className="flex w-\[480px\]/, "content should reserve a fixed right panel column");
  assert.match(source, /<aside[\s\S]*출하지시/, "form should live in a right-side aside panel");
  assert.match(source, /setIsFormPanelOpen\(true\)/, "register and edit actions should open the right panel");
  assert.match(source, /setIsFormPanelOpen\(false\)/, "cancel and save should close the right panel");
});
