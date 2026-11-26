// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Tab, TabList, TabPanel, Tabs } from "./solution";

afterEach(cleanup);

function App() {
  return (
    <Tabs defaultValue="one">
      <TabList aria-label="demo">
        <Tab value="one">One</Tab>
        <Tab value="two" disabled>Two</Tab>
        <Tab value="three">Three</Tab>
        <Tab value="four">Four</Tab>
      </TabList>
      <TabPanel value="one">Panel one</TabPanel>
      <TabPanel value="two">Panel two</TabPanel>
      <TabPanel value="three">Panel three</TabPanel>
      <TabPanel value="four">Panel four</TabPanel>
    </Tabs>
  );
}
const tab = (n: string) => screen.getByRole("tab", { name: n });
const key = (el: HTMLElement, k: string) => fireEvent.keyDown(el, { key: k });

it("only the active tab is tabbable", () => {
  render(<App />);
  expect(tab("One").tabIndex).toBe(0);
  expect(tab("Three").tabIndex).toBe(-1);
  expect(tab("Four").tabIndex).toBe(-1);
});

it("arrows move focus and selection, skip disabled, and wrap", () => {
  render(<App />);
  tab("One").focus();
  key(tab("One"), "ArrowRight");
  expect(document.activeElement).toBe(tab("Three"));
  expect(tab("Three").getAttribute("aria-selected")).toBe("true");
  expect(tab("Three").tabIndex).toBe(0);
  expect(tab("One").tabIndex).toBe(-1);
  key(tab("Three"), "ArrowRight");
  key(tab("Four"), "ArrowRight");
  expect(document.activeElement).toBe(tab("One"));
  key(tab("One"), "ArrowLeft");
  expect(document.activeElement).toBe(tab("Four"));
  key(tab("Four"), "ArrowLeft");
  expect(document.activeElement).toBe(tab("Three"));
});

it("Home and End jump to first and last enabled tabs", () => {
  render(<App />);
  tab("One").focus();
  key(tab("One"), "End");
  expect(document.activeElement).toBe(tab("Four"));
  key(tab("Four"), "Home");
  expect(document.activeElement).toBe(tab("One"));
});

it("tabs and panels are linked by id, aria-controls and aria-labelledby", () => {
  render(<App />);
  fireEvent.click(tab("Three"));
  const panel = screen.getByRole("tabpanel");
  expect(panel.textContent).toBe("Panel three");
  expect(tab("Three").getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("aria-labelledby")).toBe(tab("Three").id);
  expect(panel.id).not.toBe("");
  expect(tab("Three").id).not.toBe("");
});
