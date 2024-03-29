import dedent from "dedent";
import { NotSupportedError } from "../../src/error";
import EspreeAdapter from "../../src/adapter/espree";
import { parseCodeByEspree, parseJsxCodeByEspree } from "../helper";
import mock from "mock-fs";

describe("EspreeAdapter", () => {
  const adapter = new EspreeAdapter();

  afterEach(() => {
    mock.restore();
  });

  describe("getSource", () => {
    it('gets one line code', () => {
      const code = `const synvert = function() {}`;
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.getSource(node)).toEqual(code);
    });

    it('gets multiple lines code', () => {
      const code = `
        const synvert = function() {
          console.log("synvert");
        }
      `;
      mock({ "code.js": code });
      const node = (parseCodeByEspree(code) as any)['declarations'][0]['init'];
      expect(adapter.getSource(node)).toEqual(dedent`
        function() {
                  console.log("synvert");
                }
      `);
    });

    it('fixes multiple lines code', () => {
      const code = `
        const synvert = function() {
          console.log("synvert");
        }
      `;
      mock({ "code.js": code });
      const node = (parseCodeByEspree(code) as any)['declarations'][0]['init'];
      expect(adapter.getSource(node, { fixIndent: true })).toEqual(dedent`
        function() {
          console.log("synvert");
        }
      `);
    });
  });

  describe("getStart", () => {
    it("gets start count", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.getStart(node)).toEqual(0);
    });

    it("gets start count with childName", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.getStart(node, "id")).toEqual("class ".length);
    });
  });

  describe("getEnd", () => {
    it("gets end count", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.getEnd(node)).toEqual(code.length);
    });

    it("gets end count with childName", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.getEnd(node, "id")).toEqual("class Synvert".length);
    });
  });

  describe("getStartLoc", () => {
    test("gets start location", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      const startLoc = adapter.getStartLoc(node);
      expect(startLoc.line).toEqual(1);
      expect(startLoc.column).toEqual(0);
    });

    test("gets start location with childName", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      const startLoc = adapter.getStartLoc(node, "id");
      expect(startLoc.line).toEqual(1);
      expect(startLoc.column).toEqual("class ".length);
    });
  });

  describe("getEndLoc", () => {
    test("gets end location", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      const startLoc = adapter.getEndLoc(node);
      expect(startLoc.line).toEqual(2);
      expect(startLoc.column).toEqual(1);
    });

    test("gets end location with childName", () => {
      const code = "class Synvert {\n}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      const startLoc = adapter.getEndLoc(node, "id");
      expect(startLoc.line).toEqual(1);
      expect(startLoc.column).toEqual("class Synvert".length);
    });
  });

  describe("#childNodeRange", () => {
    test("FunctionDeclaration params", () => {
      const code = "function foobar(foo, bar) {}";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "params")).toEqual({ start: 15, end: 25 });
    });

    test("MethodDeclaration parameters", () => {
      const code = "class Foobar { foobar(foo, bar) {} }";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "body.body.0.value.params")).toEqual({ start: 21, end: 31 });
    });

    test("CallExpression arguments", () => {
      const code = "foobar(foo, bar)";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "expression.arguments")).toEqual({ start: 6, end: 16 });
    });

    test("PropertyAssignment semicolon", () => {
      const code = "const obj = { foo: bar }";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "declarations.0.init.properties.0.semicolon")).toEqual({ start: 17, end: 18 });
    });

    test("PropertyAccessExpression dot", () => {
      const code = "foo.bar";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "expression.dot")).toEqual({ start: 3, end: 4 });
    });

    test("gets xxxProperty child node", () => {
      const code = 'const obj = { foo: "foo", bar: "bar" }';
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "declarations.0.init.fooProperty")).toEqual({ start: "const obj = { ".length, end: 'const obj = { foo: "foo"'.length });
    });

    test("gets xxxAttribute child node", () => {
      const code = '<Field name="email" autoComplete="email" />';
      mock({ "code.jsx": code });
      const node = parseJsxCodeByEspree(code);
      expect(adapter.childNodeRange(node, "expression.openingElement.autoCompleteAttribute")).toEqual({ start: '<Field name="email" '.length, end: '<Field name="email" autoComplete="email"'.length });
    });

    test("gets xxxValue child node", () => {
      const code = 'const obj = { foo: "foo", bar: "bar" }';
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeRange(node, "declarations.0.init.fooValue")).toEqual({ start: "const obj = { foo: ".length, end: 'const obj = { foo: "foo"'.length });
    });

    test("CallExpression unknown", () => {
      const code = "foobar(foo, bar)";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(() => {
        adapter.childNodeRange(node, "expression.unknown");
      }).toThrow(new NotSupportedError("unknown is not supported for foobar(foo, bar)"));
    });
  });

  describe("#childNodeValue", () => {
    test("gets child node", () => {
      const code = "foobar(foo, bar)";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeValue(node, "expression.arguments.0")).toEqual((node as any)["expression"]["arguments"][0]);
    });

    test("gets child node with negative index", () => {
      const code = "foobar(foo, bar)";
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeValue(node, "expression.arguments.-1")).toEqual((node as any)["expression"]["arguments"][1]);
    });

    test("gets child string value", () => {
      const code = 'foobar("foo", "bar")';
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeValue(node, "expression.arguments.0.value")).toEqual("foo");
    });

    test("gets xxxProperty child node", () => {
      const code = 'const obj = { foo: "foo", bar: "bar" }';
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeValue(node, "declarations.0.init.fooProperty")).toEqual((node as any)["declarations"][0]["init"]["properties"][0]);
    });

    test("gets xxxAttribute child node", () => {
      const code = '<Field name="email" autoComplete="email" />';
      mock({ "code.jsx": code });
      const node = parseJsxCodeByEspree(code);
      expect(adapter.childNodeValue(node, "expression.openingElement.autoCompleteAttribute")).toEqual((node as any)["expression"]["openingElement"]["attributes"][1]);
    });

    test("gets xxxValue child node", () => {
      const code = 'const obj = { foo: "foo", bar: "bar" }';
      mock({ "code.js": code });
      const node = parseCodeByEspree(code);
      expect(adapter.childNodeValue(node, "declarations.0.init.fooValue")).toEqual((node as any)["declarations"][0]["init"]["properties"][0]["value"]);
    });
  });
});