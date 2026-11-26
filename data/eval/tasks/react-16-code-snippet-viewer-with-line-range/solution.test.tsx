// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { HighlightedSnippet } from "./solution";

afterEach(cleanup);

const WORDS = ["one", "two", "three", "four", "five", "six", "seven"];
const code = WORDS.join("\n");

function highlighted(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-highlighted="true"]')).map((el) => {
    const t = el.textContent ?? "";
    const word = WORDS.find((w) => t.includes(w));
    return `${t.replace(/\D/g, "")}:${word}`;
  });
}

it("highlights single lines and inclusive ranges, numbered from 1", () => {
  const { container } = render(<HighlightedSnippet code={code} highlightLines="2,4-6" />);
  expect(highlighted(container)).toEqual(["2:two", "4:four", "5:five", "6:six"]);
});

it("highlights the first and last lines", () => {
  const { container } = render(<HighlightedSnippet code={code} highlightLines="1,7" />);
  expect(highlighted(container)).toEqual(["1:one", "7:seven"]);
});

it("ignores out-of-bounds line numbers and clips ranges", () => {
  const a = render(<HighlightedSnippet code={code} highlightLines="2,9-12,0" />);
  expect(highlighted(a.container)).toEqual(["2:two"]);
  a.unmount();
  const b = render(<HighlightedSnippet code={code} highlightLines="6-9" />);
  expect(highlighted(b.container)).toEqual(["6:six", "7:seven"]);
});

it("highlights nothing for an empty spec", () => {
  const { container } = render(<HighlightedSnippet code={code} highlightLines="" />);
  expect(highlighted(container)).toEqual([]);
  expect(container.textContent).toContain("seven");
});

it("handles CRLF line endings", () => {
  const { container } = render(
    <HighlightedSnippet code={"alpha\r\nbeta\r\ngamma"} highlightLines="2-3" />,
  );
  expect(container.textContent).not.toContain("\r");
  const rows = Array.from(container.querySelectorAll('[data-highlighted="true"]'));
  expect(rows).toHaveLength(2);
  expect(rows[0].textContent).toContain("beta");
  expect(rows[0].textContent?.replace(/\D/g, "")).toBe("2");
  expect(rows[1].textContent).toContain("gamma");
  expect(rows[1].textContent?.replace(/\D/g, "")).toBe("3");
  expect(container.textContent).toContain("alpha");
});

it("preserves leading whitespace on indented lines", () => {
  const { container } = render(
    <HighlightedSnippet code={"function f() {\n    return 1;\n}"} highlightLines="2" />,
  );
  const row = container.querySelector('[data-highlighted="true"]');
  expect(row).not.toBeNull();
  expect(row?.textContent).toContain("    return 1;");
});
