import { describe, it, expect } from "vitest";
import { parsePipeline } from "./pipelineParser";

describe("parsePipeline", () => {
  describe("basic pipeline parsing", () => {
    it("should parse a minimal pipeline with name", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <pipeline name="TestPipeline" group="Test" type="storefront">
          <description>Test description</description>
          <branch basename="Start">
            <segment>
              <node>
                <start-node name="Start"/>
                <node-display x="0" y="0"/>
              </node>
            </segment>
          </branch>
        </pipeline>`;

      const result = parsePipeline(xml);

      expect(result.name).toBe("TestPipeline");
      expect(result.group).toBe("Test");
      expect(result.type).toBe("storefront");
      expect(result.description).toBe("Test description");
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe("start");
      expect(result.nodes[0].label).toBe("Start Start");
    });

    it("should use source name when pipeline name is missing", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <pipeline>
          <branch basename="Start">
            <segment>
              <node>
                <start-node/>
                <node-display x="0" y="0"/>
              </node>
            </segment>
          </branch>
        </pipeline>`;

      const result = parsePipeline(xml, "MyPipeline.xml");

      expect(result.name).toBe("MyPipeline");
    });

    it("should throw error when pipeline element is missing", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><root></root>`;

      expect(() => parsePipeline(xml)).toThrow("Missing <pipeline> root element");
    });
  });

  describe("node type parsing", () => {
    it("should parse start-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("start");
      expect(result.nodes[0].label).toBe("Start Begin");
    });

    it("should parse end-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <end-node name="Finish"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("end");
      expect(result.nodes[0].label).toBe("End Finish");
    });

    it("should parse pipelet-node with config properties and bindings", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <pipelet-node pipelet-name="Script">
                <config-property key="ScriptFile" value="test.ds"/>
                <config-property key="Transactional" value="true"/>
                <key-binding key="Input" alias="MyInput"/>
                <key-binding key="Output" alias="MyOutput"/>
              </pipelet-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("pipelet");
      expect(result.nodes[0].label).toBe("Script");
      expect(result.nodes[0].configProperties).toHaveLength(2);
      expect(result.nodes[0].configProperties?.[0]).toEqual({ key: "ScriptFile", value: "test.ds" });
      expect(result.nodes[0].bindings).toHaveLength(2);
      expect(result.nodes[0].bindings?.[0]).toEqual({ key: "Input", alias: "MyInput" });
    });

    it("should parse call-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <call-node start-name-ref="OtherPipeline-Start"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("call");
      expect(result.nodes[0].label).toBe("Call OtherPipeline-Start");
    });

    it("should parse jump-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <jump-node start-name-ref="Target"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("jump");
      expect(result.nodes[0].label).toBe("Jump Target");
    });

    it("should parse interaction-node with template", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <interaction-node>
                <template name="account/dashboard"/>
              </interaction-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("interaction");
      expect(result.nodes[0].label).toBe("account/dashboard");
    });

    it("should parse decision-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="Customer.authenticated"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("decision");
      expect(result.nodes[0].label).toContain("Decision");
      expect(result.nodes[0].label).toContain("Customer.authenticated");
    });

    it("should parse join-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <join-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("join");
      expect(result.nodes[0].label).toBe("Join");
    });

    it("should parse loop-node", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <loop-node iterator-key="Products"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("loop");
      expect(result.nodes[0].label).toBe("Loop Products");
    });

    it("should parse text-node with description", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <text-node>
                <description>This is a comment node</description>
              </text-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("text");
      expect(result.nodes[0].label).toBe("This is a comment node");
    });

    it("should handle unknown node types", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <custom-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("unknown");
      expect(result.nodes[0].label).toBe("custom-node");
    });
  });

  describe("edge parsing", () => {
    it("should parse simple transitions between nodes", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <simple-transition/>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].from).toBe("Start:0:0");
      expect(result.edges[0].to).toBe("Start:0:1");
    });

    it("should parse transitions with labels from source-connector", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test"/>
              <node-display x="0" y="0"/>
            </node>
            <transition source-connector="yes"/>
            <node>
              <end-node name="YesEnd"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges[0].label).toBe("yes");
      expect(result.edges[0].sourceConnector).toBe("yes");
    });

    it("should parse transitions with bend points", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition source-connector="next">
              <transition-display>
                <bend-point relative-to="source" x="1" y="0"/>
                <bend-point relative-to="target" x="0" y="-1"/>
              </transition-display>
            </transition>
            <node>
              <end-node name="End"/>
              <node-display x="1" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges[0].display).toBeDefined();
      expect(result.edges[0].display?.bendPoints).toHaveLength(2);
      expect(result.edges[0].display?.bendPoints[0]).toEqual({
        relativeTo: "source",
        x: 1,
        y: 0,
      });
    });

    it("should parse nested branch edges", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test"/>
              <node-display x="0" y="0"/>
              <branch basename="yes" source-connector="yes">
                <segment>
                  <transition target-connector="in"/>
                  <node>
                    <end-node name="YesEnd"/>
                    <node-display x="1" y="0"/>
                  </node>
                </segment>
              </branch>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Should have edge from decision to nested branch entry
      const nestedEdge = result.edges.find((e) => e.label === "yes");
      expect(nestedEdge).toBeDefined();
    });
  });

  describe("target-path resolution", () => {
    it("should resolve relative target-path ./+1", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition target-path="./+1"/>
          </segment>
          <segment>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].from).toBe("Start:0:0");
      expect(result.edges[0].to).toBe("Start:1:0");
    });

    it("should resolve absolute target-path /BranchName.segmentIndex", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition target-path="/End.0"/>
          </segment>
        </branch>
        <branch basename="End">
          <segment>
            <node>
              <end-node name="Finish"/>
              <node-display x="1" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      const crossBranchEdge = result.edges.find((e) => e.from === "Start:0:0");
      expect(crossBranchEdge).toBeDefined();
      expect(crossBranchEdge?.to).toBe("End:0:0");
    });
  });

  describe("node positioning", () => {
    it("should parse node display positions", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="5" y="10" width="200" orientation="horizontal"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].position).toBeDefined();
      expect(result.nodes[0].position?.x).toBe(5);
      expect(result.nodes[0].position?.y).toBe(10);
      expect(result.nodes[0].position?.width).toBe(200);
      expect(result.nodes[0].position?.orientation).toBe("horizontal");
    });

    it("should handle nodes without display position", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].position).toBeUndefined();
    });
  });

  describe("loop back-edges", () => {
    it("should parse loop back-edges with loop connector", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <loop-node iterator-key="Items"/>
              <node-display x="0" y="0"/>
              <branch basename="do" source-connector="do">
                <segment>
                  <transition target-connector="in"/>
                  <node>
                    <pipelet-node pipelet-name="Process"/>
                    <node-display x="0" y="1"/>
                  </node>
                  <transition target-connector="loop" target-path="../+0"/>
                </segment>
              </branch>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Should have a loop back-edge
      const loopEdge = result.edges.find((e) => e.label === "loop");
      expect(loopEdge).toBeDefined();
    });
  });

  describe("attribute collection", () => {
    it("should collect all attributes from node elements", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test.value" custom-attr="custom"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].attributes["condition-key"]).toBe("test.value");
      expect(result.nodes[0].attributes["custom-attr"]).toBe("custom");
    });
  });

  describe("label truncation", () => {
    it("should truncate long decision condition labels", () => {
      const longCondition = "a".repeat(100);
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="${longCondition}"/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].label.length).toBeLessThanOrEqual(60);
      expect(result.nodes[0].label).toContain("…");
    });

    it("should truncate long text node descriptions", () => {
      const longText = "b".repeat(100);
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <text-node>
                <description>${longText}</description>
              </text-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].label.length).toBeLessThanOrEqual(61); // 60 + ellipsis
      expect(result.nodes[0].label).toContain("…");
    });
  });

  describe("node types without names", () => {
    it("should handle start-node without name", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("start");
      expect(result.nodes[0].label).toBe("Start");
    });

    it("should handle end-node without name", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <end-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("end");
      expect(result.nodes[0].label).toBe("End");
    });

    it("should handle pipelet-node without pipelet-name", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <pipelet-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("pipelet");
      expect(result.nodes[0].label).toBe("Pipelet");
    });

    it("should handle call-node without start-name-ref", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <call-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("call");
      expect(result.nodes[0].label).toBe("Call Call");
    });

    it("should handle jump-node without start-name-ref", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <jump-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("jump");
      expect(result.nodes[0].label).toBe("Jump Jump");
    });

    it("should handle interaction-node without template", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <interaction-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("interaction");
      expect(result.nodes[0].label).toBe("Interaction");
    });

    it("should handle decision-node without condition-key", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("decision");
      expect(result.nodes[0].label).toBe("Decision");
    });

    it("should handle loop-node without iterator-key", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <loop-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("loop");
      // When no iterator-key, it defaults to "Loop" and shows "Loop Loop"
      expect(result.nodes[0].label).toBe("Loop Loop");
    });

    it("should handle text-node without description", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <text-node/>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("text");
      expect(result.nodes[0].label).toBe("Text");
    });
  });

  describe("config-property and key-binding edge cases", () => {
    it("should handle config-property with null value", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <pipelet-node pipelet-name="Script">
                <config-property key="EmptyValue"/>
              </pipelet-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].configProperties).toHaveLength(1);
      expect(result.nodes[0].configProperties?.[0].key).toBe("EmptyValue");
      expect(result.nodes[0].configProperties?.[0].value).toBe("");
    });

    it("should handle key-binding with null alias", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <pipelet-node pipelet-name="Script">
                <key-binding key="InputKey"/>
              </pipelet-node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].bindings).toHaveLength(1);
      expect(result.nodes[0].bindings?.[0].key).toBe("InputKey");
      expect(result.nodes[0].bindings?.[0].alias).toBe("");
    });
  });

  describe("target-path resolution edge cases", () => {
    it("should resolve relative target-path with negative offset ./-1", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="First"/>
              <node-display x="0" y="0"/>
            </node>
            <transition/>
          </segment>
          <segment>
            <node>
              <pipelet-node pipelet-name="Middle"/>
              <node-display x="0" y="1"/>
            </node>
            <transition target-path="./-1"/>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Should have a back-edge from Middle to First
      const backEdge = result.edges.find((e) => e.from === "Start:1:0" && e.to === "Start:0:0");
      expect(backEdge).toBeDefined();
    });

    it("should resolve nested branch path ./branchName.segmentIndex", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test"/>
              <node-display x="0" y="0"/>
              <branch basename="yes" source-connector="yes">
                <segment>
                  <transition target-connector="in"/>
                  <node>
                    <end-node name="YesEnd"/>
                    <node-display x="1" y="0"/>
                  </node>
                </segment>
              </branch>
            </node>
            <transition target-path="./yes.0"/>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Verify we have an edge going to the nested branch
      const toBranchEdge = result.edges.find((e) => e.to && e.to.includes("yes"));
      expect(toBranchEdge).toBeDefined();
    });

    it("should handle parent branch target-path ../-1", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test"/>
              <node-display x="0" y="0"/>
              <branch basename="loop" source-connector="do">
                <segment>
                  <transition target-connector="in"/>
                  <node>
                    <pipelet-node pipelet-name="Process"/>
                    <node-display x="1" y="0"/>
                  </node>
                  <transition target-path="../+0"/>
                </segment>
              </branch>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Should have an edge back to parent
      expect(result.edges.length).toBeGreaterThan(0);
    });

    it("should handle grandparent branch target-path ../../+0", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <loop-node iterator-key="items"/>
              <node-display x="0" y="0"/>
              <branch basename="do" source-connector="do">
                <segment>
                  <transition target-connector="in"/>
                  <node>
                    <decision-node condition-key="check"/>
                    <node-display x="1" y="0"/>
                    <branch basename="yes" source-connector="yes">
                      <segment>
                        <transition target-connector="in"/>
                        <node>
                          <pipelet-node pipelet-name="Deep"/>
                          <node-display x="2" y="0"/>
                        </node>
                        <transition target-path="../../+0"/>
                      </segment>
                    </branch>
                  </node>
                </segment>
              </branch>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges.length).toBeGreaterThan(0);
    });
  });

  describe("transition display parsing", () => {
    it("should handle bend-points with invalid relative-to values", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition>
              <transition-display>
                <bend-point relative-to="invalid" x="1" y="0"/>
              </transition-display>
            </transition>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Invalid bend points should be ignored, resulting in no display property
      expect(result.edges[0].display).toBeUndefined();
    });

    it("should handle bend-points with missing coordinates", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition>
              <transition-display>
                <bend-point relative-to="source"/>
              </transition-display>
            </transition>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      // Missing x/y defaults to 0,0 which is valid
      expect(result.edges[0].display).toBeDefined();
      expect(result.edges[0].display?.bendPoints[0].x).toBe(0);
      expect(result.edges[0].display?.bendPoints[0].y).toBe(0);
    });
  });

  describe("transition label derivation", () => {
    it("should derive label from target-connector when source-connector is missing", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition target-connector="myTarget"/>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges[0].label).toBe("myTarget");
      expect(result.edges[0].targetConnector).toBe("myTarget");
    });

    it("should derive label from condition-key attribute", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <decision-node condition-key="test"/>
              <node-display x="0" y="0"/>
            </node>
            <transition condition-key="myCondition"/>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges[0].label).toBe("myCondition");
    });

    it("should derive label from name attribute", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <start-node name="Begin"/>
              <node-display x="0" y="0"/>
            </node>
            <transition name="myTransition"/>
            <node>
              <end-node name="End"/>
              <node-display x="0" y="1"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.edges[0].label).toBe("myTransition");
    });
  });

  describe("stripExtension behavior", () => {
    it("should handle filename with multiple dots", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <pipeline>
          <branch basename="Start">
            <segment>
              <node>
                <start-node/>
                <node-display x="0" y="0"/>
              </node>
            </segment>
          </branch>
        </pipeline>`;

      const result = parsePipeline(xml, "path/to/my.pipeline.xml");

      expect(result.name).toBe("my.pipeline");
    });

    it("should handle filename without extension", () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <pipeline>
          <branch basename="Start">
            <segment>
              <node>
                <start-node/>
                <node-display x="0" y="0"/>
              </node>
            </segment>
          </branch>
        </pipeline>`;

      const result = parsePipeline(xml, "MyPipeline");

      expect(result.name).toBe("MyPipeline");
    });
  });

  describe("node without type element", () => {
    it("should handle node element with no type child", () => {
      const xml = `<pipeline name="Test">
        <branch basename="Start">
          <segment>
            <node>
              <node-display x="0" y="0"/>
            </node>
          </segment>
        </branch>
      </pipeline>`;

      const result = parsePipeline(xml);
      expect(result.nodes[0].type).toBe("unknown");
      expect(result.nodes[0].label).toBe("Unknown");
    });
  });
});
