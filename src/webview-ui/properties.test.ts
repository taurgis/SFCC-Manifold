/**
 * Tests for editable fields in properties panel rendering
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderNodeProperties } from "./properties";
import { setPipelineData, setPlacedNodes } from "./state";
import type { PipelineNode } from "./types";

describe("renderNodeProperties editable fields", () => {
  beforeEach(() => {
    const content = { innerHTML: "" } as unknown as HTMLElement;

    const mockDocument = {
      getElementById: (id: string) => (id === "propertiesContent" ? content : null),
    } as unknown as Document;

    vi.stubGlobal("document", mockDocument);

    setPipelineData({ nodes: [], edges: [] });
    setPlacedNodes([]);

    // Expose content for assertions via a symbol on document
    (document as unknown as { __content: HTMLElement }).__content = content;
  });

  function baseNode(): PipelineNode {
    return {
      id: "Start:0:0",
      label: "Start Foo",
      type: "start",
      branch: "Start",
      attributes: { name: "Foo", secure: "true" },
      configProperties: [
        { key: "ScriptFile", value: "test.ds", sourceLocation: { line: 5 } },
      ],
      bindings: [
        { key: "Input", alias: "Foo", sourceLocation: { line: 6 } },
      ],
      template: null,
      description: null,
      sourceLocation: { line: 3 },
    };
  }

  it("renders editable inputs for regular attributes with source locations", () => {
    const node = baseNode();
    setPipelineData({ nodes: [node], edges: [] });

    renderNodeProperties(node);

    const html = (document as unknown as { __content: { innerHTML: string } }).__content.innerHTML;
    expect(html).toContain('data-kind="attribute"');
    expect(html).toContain('data-key="name"');
    expect(html).toContain('value="Foo"');
  });

  it("renders config properties as editable when source location is present", () => {
    const node = baseNode();
    setPipelineData({ nodes: [node], edges: [] });

    renderNodeProperties(node);

    const html = (document as unknown as { __content: { innerHTML: string } }).__content.innerHTML;
    expect(html).toContain('data-kind="config"');
    expect(html).toContain('data-key="ScriptFile"');
    expect(html).toContain('value="test.ds"');
  });

  it("renders bindings as editable when source location is present", () => {
    const node = baseNode();
    setPipelineData({ nodes: [node], edges: [] });

    renderNodeProperties(node);

    const html = (document as unknown as { __content: { innerHTML: string } }).__content.innerHTML;
    expect(html).toContain('data-kind="binding"');
    expect(html).toContain('data-key="Input"');
    expect(html).toContain('value="Foo"');
  });

  it("keeps system attributes read-only even with source location", () => {
    const node = baseNode();
    node.attributes = {
      ...node.attributes,
      "target-connector": "in",
    };
    setPipelineData({ nodes: [node], edges: [] });

    renderNodeProperties(node);

    const html = (document as unknown as { __content: { innerHTML: string } }).__content.innerHTML;
    expect(html).not.toContain('data-key="target-connector"');
    expect(html).toContain("in");
  });
});
