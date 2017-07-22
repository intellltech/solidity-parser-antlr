var fs = require("fs")
var { assert } = require('chai')
var parser = require("../src/index")

function print(obj) {
  console.log(JSON.stringify(obj, null, 2))
}

describe("#parse", () => {

  it("parses test file correctly", () => {
    var content = fs.readFileSync(__dirname + "/test.sol")
    parser.parse(content.toString())
  })

  it("throws ParserError on syntax error", () => {
    var source = "not good"
    assert.throws(() => {
      parser.parse(source)
    }, parser.ParseError)
  })

  it("supports tolerant mode", () => {
    var source = "not good"
    var root = parser.parse(source, { tolerant: true })
    assert.equal(root.errors.length, 1)
  })

  it("supports loc", () => {
    var source = "contract test { uint a; }"
    var root = parser.parse(source, { loc: true })
    assert.isOk(root.hasOwnProperty('loc'))
  })

  it("supports range", () => {
    var source = "contract test { uint a; }"
    var root = parser.parse(source, { range: true })
    assert.isOk(root.hasOwnProperty('range'))
  })

  describe('AST', () => {

    function parseContract(source) {
      var ast = parser.parse(source);
      assert.isOk(ast.children[0])
      return ast.children[0]
    }

    function parseNode(source) {
      var contract = parseContract(
        "contract test { " + source + " }"
      );
      assert.isOk(contract.subNodes[0])
      return contract.subNodes[0]
    }

    function parseStatement(source) {
      var ast = parseNode("function () { " + source + " }")
      assert.isOk(ast.body.statements[0])
      return ast.body.statements[0]
    }

    function parseExpression(source) {
      var ast = parseNode("function () { " + source + "; }")
      assert.isOk(ast.body.statements[0].expression)
      return ast.body.statements[0].expression
    }

    it("SourceUnit", () => {
      var ast = parser.parse("");
      assert.deepEqual(ast, {
        "type": "SourceUnit",
        "children": []
      });
    })

    it("EnumDefinition / EnumValue", () => {
      var ast = parseNode("enum Hello { A, B, C }")
      assert.deepEqual(ast, {
        "type": "EnumDefinition",
        "name": "Hello",
        "members": [
          {
            "type": "EnumValue",
            "name": "A"
          },
          {
            "type": "EnumValue",
            "name": "B"
          },
          {
            "type": "EnumValue",
            "name": "C"
          }
        ]
      })
    })

    it("UsingForDeclaration", () => {

    })

    it("PragmaDirective", () => {
      var ast = parser.parse("pragma solidity ^0.4.0;")
      var pragma = ast.children[0]
      assert.deepEqual(pragma, {
        "type": "PragmaDirective",
        "name": "solidity",
        "value": "^0.4.0"
      })
    })

    it("ContractDefinition", () => {
      var ast = parseContract("contract test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "contract"
      })

      // inheritance
      ast = parseContract("contract test is foo, bar {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [
          {
            "type": "InheritanceSpecifier",
            "baseName": {
              "type": "UserDefinedTypeName",
              "namePath": "foo"
            },
            "arguments": []
          },
          {
            "type": "InheritanceSpecifier",
            "baseName": {
              "type": "UserDefinedTypeName",
              "namePath": "bar"
            },
            "arguments": []
          }
        ],
        "subNodes": [],
        "kind": "contract"
      })

      // library
      ast = parseContract("library test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "library"
      })

      // interface
      ast = parseContract("interface test {}")
      assert.deepEqual(ast, {
        "type": "ContractDefinition",
        "name": "test",
        "baseContracts": [],
        "subNodes": [],
        "kind": "interface"
      })
    })

    it("FunctionDefinition", () => {
      var ast = parseNode("function foo(uint a) {}")
      assert.deepEqual(ast, {
        "type": "FunctionDefinition",
        "name": "foo",
        "parameters": {
          "type": "ParameterList",
          "parameters": [
            {
              "type": "Parameter",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "uint"
              },
              "name": "a",
              "storageLocation": null,
              "isStateVar": false,
              "isIndexed": false
            }
          ]
        },
        "body": {
          "type": "Block",
          "statements": []
        },
        "visibility": "default",
        "modifiers": [],
        "isConstructor": false,
        "isDeclaredConst": false,
        "isPayable": false
      })
    })

    it("FunctionDefinition", () => {
      var ast = parseNode("function foo(uint a) onlyOwner {}")
      assert.deepEqual(ast.modifiers[0], {
        "type": "ModifierInvocation",
        "name": "onlyOwner",
        "arguments": []
      })
    })

    it("ElementaryTypeNameExpression", () => {
      var stmt = parseStatement("uint(a);")
      assert.deepEqual(stmt.expression.expression, {
        "type": "ElementaryTypeNameExpression",
        "typeName": {
          "type": "ElementaryTypeName",
          "name": "uint"
        }
      })
    })

    it("TypeName", () => {


    })

    it("FunctionTypeName", () => {

    })

    it("ReturnStatement", () => {
      var ast = parseStatement("return;")
      assert.deepEqual(ast, {
        "type": "ReturnStatement",
        "expression": null
      })

      ast = parseStatement("return 2;")
      assert.deepEqual(ast, {
        "type": "ReturnStatement",
        "expression": {
          "type": "NumberLiteral",
          "number": "2",
          "subdenomination": null
        }
      })
    })

    it("StructDefinition", () => {
      var ast = parseNode("struct hello { uint a; }")
      assert.deepEqual(ast, {
        "type": "StructDefinition",
        "name": "hello",
        "members": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ]
      })
    })

    it("VariableDeclaration", () => {
      // state variable
      var ast = parseNode("uint a;")
      assert.deepEqual(ast.variables[0], {
        "type": "VariableDeclaration",
        "typeName": {
          "type": "ElementaryTypeName",
          "name": "uint"
        },
        "name": "a",
        "expression": null,
        "visibility": "default",
        "isStateVar": true,
        "isDeclaredConst": false,
        "isIndexed": false
      })
    })

    it("WhileStatement", () => {
      var stmt = parseStatement("while (true) {}")
      assert.deepEqual(stmt, {
        "type": "WhileStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })

      stmt = parseStatement("do {} while (true);")
      assert.deepEqual(stmt, {
        "type": "DoWhileStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })
    })

    it("IfStatement", () => {
      var stmt = parseStatement("if (true) {}")
      assert.deepEqual(stmt, {
        "type": "IfStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "trueBody": {
          "type": "Block",
          "statements": []
        },
        "falseBody": null
      })

      // else
      stmt = parseStatement("if (true) {} else {}")
      assert.deepEqual(stmt, {
        "type": "IfStatement",
        "condition": {
          "type": "BooleanLiteral",
          "value": true
        },
        "trueBody": {
          "type": "Block",
          "statements": []
        },
        "falseBody": {
          "type": "Block",
          "statements": []
        },
      })
    })

    xit("UserDefinedTypeName", () => {

    })

    xit("ExpressionStatement", () => {

    })

    it("NumberLiteral", () => {
      var expr = parseExpression("2")
      assert.deepEqual(expr, {
        "type": "NumberLiteral",
        "number": "2",
        "subdenomination": null
      })
    })

    it("Mapping", () => {
      var ast = parseNode("mapping(uint => address) a;")
      assert.deepEqual(ast.variables[0].typeName, {
        "type": "Mapping",
        "keyType": {
          "type": "ElementaryTypeName",
          "name": "uint"
        },
        "valueType": {
          "type": "ElementaryTypeName",
          "name": "address"
        }
      })
    })

    it("ModifierDefinition", () => {
      var ast = parseNode("modifier onlyOwner {}")
      assert.deepEqual(ast, {
        "type": "ModifierDefinition",
        "name": "onlyOwner",
        "parameters": [],
        "body": {
          "type": "Block",
          "statements": []
        }
      })
    })

    xit("Expression", () => {

    })

    it("StateVariableDeclaration", () => {
      var ast = parseNode("uint a;")
      assert.deepEqual(ast, {
        "type": "StateVariableDeclaration",
        "variables": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "expression": null,
            "visibility": "default",
            "isStateVar": true,
            "isDeclaredConst": false,
            "isIndexed": false
          }
        ],
        "initialValue": null
      })
    })

    it("ForStatement", () => {
      var stmt = parseStatement("for (i = 0; i < 10; i++) {}")
      assert.deepEqual(stmt, {
        "type": "ForStatement",
        "initExpression": {
          "type": "ExpressionStatement",
          "expression": {
            "type": "BinaryOperation",
            "operator": "=",
            "left": {
              "type": "Identifier",
              "name": "i"
            },
            "right": {
              "type": "NumberLiteral",
              "number": "0",
              "subdenomination": null
            }
          }
        },
        "conditionExpression": {
          "type": "BinaryOperation",
          "operator": "<",
          "left": {
            "type": "Identifier",
            "name": "i"
          },
          "right": {
            "type": "NumberLiteral",
            "number": "10",
            "subdenomination": null
          }
        },
        "loopExpression": {
          "type": "ExpressionStatement",
          "expression": {
            "type": "UnaryOperation",
            "subExpression": {
              "type": "Identifier",
              "name": "i"
            },
            "isPrefix": false
          }
        },
        "body": {
          "type": "Block",
          "statements": []
        }
      })

    })

    xit("PrimaryExpression", () => {

    })

    it("Identifier", () => {
      var expr = parseExpression("a")
      assert.deepEqual(expr, {
        "type": "Identifier",
        "name": "a",
      })
    })

    it("TupleExpression", () => {
      // tuple
      var ast = parseExpression("(a, b)")
      assert.deepEqual(ast, {
        "type": "TupleExpression",
        "elements": [
          {
            "type": "Identifier",
            "name": "a"
          },
          {
            "type": "Identifier",
            "name": "b"
          }
        ],
        "isArray": false
      })

      // array
      ast = parseExpression("[a, b]")
      assert.deepEqual(ast, {
        "type": "TupleExpression",
        "elements": [
          {
            "type": "Identifier",
            "name": "a"
          },
          {
            "type": "Identifier",
            "name": "b"
          }
        ],
        "isArray": true
      })
    })

    it("VariableDeclarationStatement", () => {
      var stmt = parseStatement("uint a;")
      assert.deepEqual(stmt, {
        "type": "VariableDeclarationStatement",
        "variables": [
          {
            "type": "VariableDeclaration",
            "typeName": {
              "type": "ElementaryTypeName",
              "name": "uint"
            },
            "name": "a",
            "storageLocation": null,
            "isStateVar": false,
            "isIndexed": false
          }
        ],
        "initialValue": null
      })
    })

    it("ImportDirective", () => {
      var ast = parser.parse("import \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": null,
        "symbolAliases": null
      })

      ast = parser.parse("import \"./abc.sol\" as x;")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": "x",
        "symbolAliases": null
      })

      ast = parser.parse("import * as x from \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": "x",
        "symbolAliases": null
      })

      ast = parser.parse("import { a as b, c as d, f } from \"./abc.sol\";")
      assert.deepEqual(ast.children[0], {
        "type": "ImportDirective",
        "path": "./abc.sol",
        "unitAlias": null,
        "symbolAliases": [
          ["a", "b"],
          ["c", "d"],
          ["f", null],
        ]
      })
    })

    it("EventDefinition", () => {
      var ast = parseNode("event Foo(address indexed a, uint b);")
      assert.deepEqual(ast, {
        "type": "EventDefinition",
        "name": "Foo",
        "parameters": {
          "type": "ParameterList",
          "parameters": [
            {
              "type": "VariableDeclaration",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "address"
              },
              "name": "a",
              "isStateVar": false,
              "isIndexed": true
            },
            {
              "type": "VariableDeclaration",
              "typeName": {
                "type": "ElementaryTypeName",
                "name": "uint"
              },
              "name": "b",
              "isStateVar": false,
              "isIndexed": false
            }
          ]
        },
        "isAnonymous": false
      })
    })

    it("InlineAssemblyStatement", () => {
      var ast = parseStatement("assembly {}")
      assert.deepEqual(ast, {
        "type": "InlineAssemblyStatement",
        "language": null,
        "body": {
          "type": "AssemblyBlock",
          "operations": []
        }
      })

      ast = parseStatement("assembly \"evmasm\" {}")
      assert.deepEqual(ast, {
        "type": "InlineAssemblyStatement",
        "language": "evmasm",
        "body": {
          "type": "AssemblyBlock",
          "operations": []
        }
      })
    })

    xit("AssemblyBlock", () => {

    })

    xit("AssemblyItem", () => {

    })

    xit("AssemblyExpression", () => {

    })

    xit("AssemblyCall", () => {

    })

    xit("AssemblyLiteral", () => {

    })

    xit("AssemblySwitch", () => {

    })

    xit("AssemblyCase", () => {

    })

    xit("AssemblyLocalDefinition", () => {

    })

    xit("AssemblyFunctionDefinition", () => {

    })

    xit("AssemblyAssignment", () => {

    })

    xit("AssemblyLabel", () => {

    })

    xit("AssemblyStackAssignment", () => {

    })

    xit("AssemblyFor", () => {

    })

  })
})

describe("#visit", () => {

  it("walks visitor through AST", () => {
    var source = "contract test { uint a; }"
    var ast = parser.parse(source)
    parser.visit(ast, {
      ContractDefinition: (node) => {
        assert.equal(node.type, 'ContractDefinition')
      },

      'ContractDefinition:exit': (node) => {
        assert.equal(node.type, 'ContractDefinition')
      }
    })
  })

  it("can stop visiting inner nodes by returning false", () => {
    var source = "contract test { uint a; }"
    var ast = parser.parse(source)
    parser.visit(ast, {
      ContractDefinition: (node) => {
        return false
      },

      'ContractDefinition:exit': (node) => {
        assert.fail('should not reach here')
      }
    })
  })

})
