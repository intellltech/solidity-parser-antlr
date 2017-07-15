var antlr4 = require('../antlr4/index')

var transformAST = {

  SourceUnit: function (ctx) {
    // last element is EOF terminal node
    return {
      children: this.visit(ctx.children.slice(0, -1))
    }
  },

  EnumDefinition: function (ctx) {
    return {
      name: ctx.identifier().getText(),
      members: this.visit(ctx.enumValue())
    }
  },

  EnumValue: function (ctx) {
    return {
      name: ctx.identifier().getText()
    }
  },

  UsingForDeclaration: function (ctx) {
    var typeName = null
    if (ctx.getChild(3).getText() !== '*') {
      typeName = this.visit(ctx.getChild(3))
    }

    return {
      typeName: typeName,
      libraryName: ctx.identifier().getText()
    }
  },

  PragmaDirective: function (ctx) {
    return {
      name: ctx.pragmaName().getText(),
      value: ctx.pragmaValue().getText()
    }
  },

  ContractDefinition: function (ctx) {
    var name = ctx.identifier().getText()
    this._currentContract = name

    return {
      name: name,
      baseContracts: this.visit(ctx.inheritanceSpecifier()),
      subNodes: this.visit(ctx.contractPart()),
      kind: ctx.getChild(0).getText()
    }
  },

  InheritanceSpecifier: function (ctx) {
    return {
      baseName: this.visit(ctx.userDefinedTypeName()),
      arguments: this.visit(ctx.expression())
    }
  },

  ContractPart: function (ctx) {
    return this.visit(ctx.children[0])
  },

  FunctionDefinition: function (ctx) {
    var name = ctx.identifier(0)

    var parameters = this.visit(ctx.parameterList())

    var block = null
    if (ctx.block()) { block = this.visit(ctx.block()) }

    var modifiers = ctx.modifierList()
      .modifierInvocation()
      .map(mod => this.visit(mod))

    // parse function visibility
    let visibility = 'default'
    if (ctx.modifierList().ExternalKeyword(0)) {
      visibility = 'external'
    } else if (ctx.modifierList().InternalKeyword(0)) {
      visibility = 'internal'
    } else if (ctx.modifierList().PublicKeyword(0)) {
      visibility = 'public'
    } else if (ctx.modifierList().PrivateKeyword(0)) {
      visibility = 'private'
    }

    var isPayable = false
    if (ctx.modifierList().PayableKeyword(0)) {
      isPayable = true
    }

    var isDeclaredConst = false
    if (ctx.modifierList().ConstantKeyword(0)) {
      isDeclaredConst = true
    }

    return {
      name: name ? name.getText() : '',
      parameters: parameters,
      body: block,
      visibility: visibility,
      modifiers: modifiers,
      isConstructor: name === this._currentContract,
      isDeclaredConst: isDeclaredConst,
      isPayable: isPayable
    }
  },

  ModifierInvocation: function (ctx) {
    var exprList = ctx.expressionList()

    var args
    if (exprList != null) { args = this.visit(exprList.children) } else { args = [] }

    return {
      name: ctx.identifier().getText(),
      arguments: args
    }
  },

  ElementaryTypeNameExpression: function (ctx) {
    return {
      typeName: this.visit(ctx.elementaryTypeName())
    }
  },

  TypeName: function (ctx) {
    if (ctx.children.length === 4 &&
        ctx.getChild(1).getText() === '[' &&
        ctx.getChild(3).getText() === ']'
    ) {
      this.visit(ctx.children[0])

      return {
        type: 'ArrayTypeName',
        baseTypeName: this.visit(ctx.getChild(0)),
        length: this.visit(ctx.getChild(2))
      }
    }
    return this.visit(ctx.getChild(0))
  },

  FunctionTypeName: function (ctx) {
    var parameterTypes = ctx.typeNameList(0)
      .unnamedParameter()
      .map(typeCtx => this.visit(typeCtx))

    var returnTypes = []
    if (ctx.typeNameList(1)) {
      returnTypes = ctx.typeNameList(1)
        .typeName()
        .map(typeCtx => this.visit(typeCtx))
    }

    let visibility = 'default'
    if (ctx.InternalKeyword(0)) {
      visibility = 'internal'
    } else if (ctx.ExternalKeyword(0)) {
      visibility = 'external'
    }

    var isDeclaredConst = false
    if (ctx.ConstantKeyword(0)) {
      isDeclaredConst = true
    }

    var isPayable = false
    if (ctx.PayableKeyword(0)) {
      isPayable = true
    }

    return {
      parameterTypes: parameterTypes,
      returnTypes: returnTypes,
      visibility: visibility,
      isDeclaredConst: isDeclaredConst,
      isPayable: isPayable
    }
  },

  ReturnStatement: function (ctx) {
    var expression = null
    if (ctx.expression()) { expression = this.visit(ctx.expression()) }

    return { expression: expression }
  },

  StructDefinition: function (ctx) {
    return {
      name: ctx.identifier().getText(),
      members: this.visit(ctx.variableDeclaration())
    }
  },

  VariableDeclaration: function (ctx) {
    var storageLocation = null
    if (ctx.storageLocation()) {
      storageLocation = ctx.storageLocation().getText()
    }

    return {
      typeName: this.visit(ctx.typeName()),
      name: ctx.identifier().getText(),
      storageLocation: storageLocation,
      isStateVar: false,
      isIndexed: false
    }
  },

  IndexedParameter: function (ctx) {
    var storageLocation = null
    if (ctx.storageLocation(0)) {
      storageLocation = ctx.storageLocation(0).getText()
    }

    return {
      type: 'VariableDeclaration',
      typeName: this.visit(ctx.typeName()),
      name: ctx.identifier().getText(),
      storageLocation: storageLocation,
      isStateVar: false,
      isIndexed: !!ctx.IndexedKeyword(0)
    }
  },

  UnnamedParameter: function (ctx) {
    var storageLocation = null
    if (ctx.storageLocation()) {
      storageLocation = ctx.storageLocation().getText()
    }

    return {
      type: 'VariableDeclaration',
      typeName: this.visit(ctx.typeName()),
      name: null,
      storageLocation: storageLocation,
      isStateVar: false,
      isIndexed: false
    }
  },

  WhileStatement: function (ctx) {
    return {
      condition: this.visit(ctx.expression()),
      body: this.visit(ctx.statement()),
      isDoWhile: ctx.getChild(0).getText() === 'do'
    }
  },

  IfStatement: function (ctx) {
    var trueBody = this.visit(ctx.statement(0))
    var falseBody = null
    if (ctx.statement().length > 1) { falseBody = this.visit(ctx.statement(1)) }

    return {
      condition: this.visit(ctx.expression()),
      trueBody: trueBody,
      falseBody: falseBody
    }
  },

  UserDefinedTypeName: function (ctx) {
    return {
      namePath: ctx.getText()
    }
  },

  ElementaryTypeName: function (ctx) {
    return {
      name: ctx.getText()
    }
  },

  Block: function (ctx) {
    return {
      statements: this.visit(ctx.statement())
    }
  },

  ExpressionStatement: function (ctx) {
    return {
      expression: this.visit(ctx.expression())
    }
  },

  NumberLiteral: function (ctx) {
    var number = ctx.getChild(0).getText()
    var subdenomination = null

    if (ctx.children.length === 2) {
      subdenomination = ctx.getChild(1).getText()
    }

    return {
      number: number,
      subdenomination: subdenomination
    }
  },

  Mapping: function (ctx) {
    return {
      keyType: this.visit(ctx.elementaryTypeName()),
      valueType: this.visit(ctx.typeName())
    }
  },

  ModifierDefinition: function (ctx) {
    var parameters = []
    if (ctx.parameterList()) { parameters = this.visit(ctx.parameterList()) }

    return {
      name: ctx.identifier().getText(),
      parameters: parameters,
      body: this.visit(ctx.block())
    }
  },

  Statement: function (ctx) {
    return this.visit(ctx.getChild(0))
  },

  SimpleStatement: function (ctx) {
    return this.visit(ctx.getChild(0))
  },

  Expression: function (ctx) {
    switch (ctx.children.length) {
      case 1:
        // primary expression
        return this.visit(ctx.getChild(0))

      case 2:
        // new expression
        if (ctx.getChild(0).getText() === 'new') {
          return {
            type: 'NewExpression',
            typeName: this.visit(ctx.typeName())
          }
        }

        // prefix operators
        if (['+', '-', '++', '--', '!', '~', 'after', 'delete'].includes(ctx.getChild(0).getText())) {
          return {
            type: 'UnaryOperation',
            subExpression: this.visit(ctx.getChild(1)),
            isPrefix: true
          }
        }
        // postfix operators
        if (['++', '--'].includes(ctx.getChild(1).getText())) {
          return {
            type: 'UnaryOperation',
            subExpression: this.visit(ctx.getChild(0)),
            isPrefix: false
          }
        }
        break

      case 3:
        // treat parenthesis as no-op
        if (ctx.getChild(0).getText() === '(' &&
            ctx.getChild(2).getText() === ')') {
          return {
            type: 'TupleExpression',
            components: [this.visit(ctx.getChild(1))],
            isArray: false
          }
        }

        var op = ctx.getChild(1).getText()

        // tuple separator
        if (op === ',') {
          return {
            type: 'TupleExpression',
            components: [this.visit(ctx.getChild(0)), this.visit(ctx.getChild(2))],
            isArray: false
          }
        }

        // member access
        if (op === '.') {
          var expression = this.visit(ctx.getChild(0))
          var memberName = ctx.getChild(2).getText()
          return {
            type: 'MemberAccess',
            expression: expression,
            memberName: memberName
          }
        }

        // binary operation
        var binOps = [
          '+', '-', '*', '/', '**', '%',
          '<<', '>>', '&&', '||', '&', '|', '^',
          '<', '>', '<=', '>=', '==', '!=',
          '=', '|=', '^=', '&=', '<<=', '>>=',
          '+=', '-=', '*=', '/=', '%='
        ]

        if (binOps.includes(op)) {
          return {
            type: 'BinaryOperation',
            operator: op,
            left: this.visit(ctx.getChild(0)),
            right: this.visit(ctx.getChild(2))
          }
        }
        break

      case 4:
        // function call
        if (ctx.getChild(1).getText() === '(' && ctx.getChild(3).getText() === ')') {
          var args = []
          var names = []

          var ctxArgs = ctx.functionCallArguments()
          if (ctxArgs.expressionList()) {
            args = ctxArgs.expressionList()
              .expression()
              .map(exprCtx => this.visit(exprCtx))
          } else if (ctxArgs.nameValueList()) {
            for (var nameValue of ctxArgs.nameValueList().nameValue()) {
              args.push(this.visit(nameValue.expression()))
              names.push(nameValue.identifier().getText())
            }
          }

          return {
            type: 'FunctionCall',
            expression: this.visit(ctx.getChild(0)),
            arguments: args,
            names: names
          }
        }

        // index access
        if (ctx.getChild(1).getText() === '[' && ctx.getChild(3).getText() === ']') {
          return {
            type: 'IndexAccess',
            base: this.visit(ctx.getChild(0)),
            index: this.visit(ctx.getChild(2))
          }
        }
        break

      case 5:
                // ternary operator
        if (ctx.getChild(1).getText() === '?' && ctx.getChild(3).getText() === ':') {
          return {
            type: 'Conditional',
            condition: this.visit(ctx.getChild(0)),
            trueExpression: this.visit(ctx.getChild(2)),
            falseExpression: this.visit(ctx.getChild(4))
          }
        }
        break
    }

    throw new Error('unrecognized expression')
  },

  StateVariableDeclaration: function (ctx) {
    var type = this.visit(ctx.typeName())
    var name = ctx.identifier().getText()

    var expression = null
    if (ctx.expression()) {
      expression = this.visit(ctx.expression())
    }

    let visibility = 'default'
    if (ctx.InternalKeyword(0)) {
      visibility = 'internal'
    } else if (ctx.PublicKeyword(0)) {
      visibility = 'public'
    } else if (ctx.PrivateKeyword(0)) {
      visibility = 'private'
    }

    var isDeclaredConst = false
    if (ctx.ConstantKeyword(0)) {
      isDeclaredConst = true
    }

    var decl = {
      type: 'VariableDeclaration',
      typeName: type,
      name: name,
      expression: expression,
      visibility: visibility,
      isStateVar: true,
      isDeclaredConst: isDeclaredConst,
      isIndexed: false
    }

    return {
      variables: [decl],
      initialValue: expression
    }
  },

  ForStatement: function (ctx) {
    return {
      initExpression: this.visit(ctx.simpleStatement()),
      conditionExpression: this.visit(ctx.expression(0)),
      loopExpression: {
        type: 'ExpressionStatement',
        expression: this.visit(ctx.expression(1))
      },
      body: this.visit(ctx.statement())
    }
  },

  PrimaryExpression: function (ctx) {
    if (ctx.BooleanLiteral()) {
      return {
        type: 'BooleanLiteral',
        value: ctx.BooleanLiteral().getText() === 'true'
      }
    }

    if (ctx.HexLiteral()) {
      return {
        type: 'NumberLiteral',
        value: ctx.HexLiteral().getText()
      }
    }

    if (ctx.StringLiteral()) {
      var text = ctx.getText()
      return {
        type: 'StringLiteral',
        value: text.substring(1, text.length - 1)
      }
    }

    return this.visit(ctx.getChild(0))
  },

  Identifier: function (ctx) {
    return {
      name: ctx.getText()
    }
  },

  TupleExpression: function (ctx) {
    return {
      elements: this.visit(ctx.expression()),
      isArray: ctx.getChild(0).getText() === '['
    }
  },

  VariableDeclarationStatement: function (ctx) {
    var variables
    if (ctx.variableDeclaration()) {
      variables = [this.visit(ctx.variableDeclaration())]
    } else {
      variables = ctx.identifierList().identifier()
        .map(iden => this.createNode({
          type: 'VariableDeclaration',
          name: iden.getText(),
          isStateVar: false,
          isIndexed: false
        }, iden))
    }

    var initialValue = null
    if (ctx.expression()) { initialValue = this.visit(ctx.expression()) }

    return {
      variables: variables,
      initialValue: initialValue
    }
  },

  ImportDirective: function (ctx) {
    var pathString = ctx.StringLiteral().getText()
    var unitAlias = null
    var symbolAliases = null

    if (ctx.importDeclaration().length > 0) {
      symbolAliases = ctx.importDeclaration().map(decl => {
        var symbol = decl.identifier(0).getText()
        var alias = null
        if (decl.identifier(1)) {
          alias = decl.identifier(1).getText()
        }
        return [symbol, alias]
      })
    } else if (ctx.children.length === 7) {
      unitAlias = [
        ctx.getChild(1).getText(),
        ctx.getChild(3).getText()
      ]
    } else if (ctx.children.length === 5) {
      unitAlias = [
        null,
        ctx.getChild(3).getText()
      ]
    }

    return {
      path: pathString.substring(1, pathString.length - 1),
      unitAlias: unitAlias,
      symbolAliases: symbolAliases
    }
  },

  EventDefinition: function (ctx) {
    return {
      name: ctx.identifier().getText(),
      parameters: this.visit(ctx.indexedParameterList()),
      isAnonymous: !!ctx.AnonymousKeyword()
    }
  },

  IndexedParameterList: function (ctx) {
    var parameters = ctx.indexedParameter().map(function (paramCtx) {
      var type = this.visit(paramCtx.typeName())
      var name = null
      if (paramCtx.identifier()) {
        name = paramCtx.identifier().getText()
      }

      return {
        type: 'VariableDeclaration',
        typeName: type,
        name: name,
        isStateVar: false,
        isIndexed: !!paramCtx.IndexedKeyword(0)
      }
    }, this)

    return {
      type: 'ParameterList',
      parameters: parameters
    }
  },

  ParameterList: function (ctx) {
    var parameters = ctx.parameter()
      .map(paramCtx => this.visit(paramCtx))

    return {
      type: 'ParameterList',
      parameters: parameters
    }
  },

  InlineAssemblyStatement: function (ctx) {
    var language = null
    if (ctx.StringLiteral()) {
      language = ctx.StringLiteral().getText()
      language = language.substring(1, language.length - 1)
    }

    return {
      language: language,
      body: this.visit(ctx.assemblyBlock())
    }
  },

  AssemblyBlock: function (ctx) {
    var operations = ctx.assemblyItem()
      .map(it => this.visit(it))

    return { operations: operations }
  },

  AssemblyItem: function (ctx) {
    var text

    if (ctx.HexLiteral()) {
      return {
        type: 'NumberLiteral',
        value: ctx.HexLiteral().getText()
        // TODO: add positions to these fake nodes
      }
    }

    if (ctx.StringLiteral()) {
      text = ctx.StringLiteral().getText()
      return {
        type: 'StringLiteral',
        value: text.substring(1, text.length - 1)
      }
    }

    if (ctx.BreakKeyword()) {
      return {
        type: 'Break'
      }
    }

    if (ctx.ContinueKeyword()) {
      return {
        type: 'Continue'
      }
    }

    return this.visit(ctx.getChild(0))
  },

  AssemblyExpression: function (ctx) {
    return this.visit(ctx.getChild(0))
  },

  AssemblyCall: function (ctx) {
    var functionName = ctx.getChild(0).getText()
    var args = ctx.assemblyExpression()
      .map(arg => this.visit(arg))

    return {
      functionName: functionName,
      arguments: args
    }
  },

  AssemblyLiteral: function (ctx) {
    var text

    if (ctx.StringLiteral()) {
      text = ctx.getText()
      return {
        type: 'StringLiteral',
        value: text.substring(1, text.length - 1)
      }
    }

    if (ctx.DecimalNumber()) {
      return {
        type: 'DecimalNumber',
        value: ctx.getText()
      }
    }

    if (ctx.HexNumber()) {
      return {
        type: 'HexNumber',
        value: ctx.getText()
      }
    }

    if (ctx.HexLiteral()) {
      return {
        type: 'HexNumber',
        value: ctx.getText()
      }
    }
  },

  AssemblySwitch: function (ctx) {
    return {
      expression: this.visit(ctx.assemblyExpression()),
      cases: ctx.assemblyCase().map(c => this.visit(c))
    }
  },

  AssemblyCase: function (ctx) {
    var value = null
    if (ctx.getChild(0).getText() === 'case') {
      value = this.visit(ctx.assemblyLiteral())
    }

    var node = { block: this.visit(ctx.assemblyBlock()) }
    if (value !== null) {
      node.value = value
    } else {
      node.default = true
    }

    return node
  },

  AssemblyLocalDefinition: function (ctx) {
    var names = ctx.assemblyIdentifierOrList()
    if (names.identifier()) {
      names = [this.visit(names.identifier())]
    } else {
      names = this.visit(names.assemblyIdentifierList().identifier())
    }

    return {
      names: names,
      expression: this.visit(ctx.assemblyExpression())
    }
  },

  AssemblyFunctionDefinition: function (ctx) {
    return {
      name: ctx.identifier().getText(),
      arguments: this.visit(ctx.assemblyIdentifierList().identifier()),
      returnArguments: this.visit(ctx.assemblyFunctionReturns().assemblyIdentifierList().identifier())
    }
  },

  AssemblyAssignment: function (ctx) {
    var names = ctx.assemblyIdentifierOrList()
    if (names.identifier()) {
      names = [this.visit(names.identifier())]
    } else {
      names = this.visit(names.assemblyIdentifierList().identifier())
    }

    return {
      names: names,
      expression: this.visit(ctx.assemblyExpression())
    }
  },

  AssemblyLabel: function (ctx) {
    return {
      name: ctx.identifier().getText()
    }
  },

  AssemblyStackAssignment: function (ctx) {
    return {
      name: ctx.identifier().getText()
    }
  },

  AssemblyFor: function (ctx) {
    return {
      pre: this.visit(ctx.getChild(1)),
      condition: this.visit(ctx.getChild(2)),
      post: this.visit(ctx.getChild(3)),
      body: this.visit(ctx.getChild(4))
    }
  }
}

function ASTBuilder (options) {
  antlr4.tree.ParseTreeVisitor.call(this)
  this.options = options
}

ASTBuilder.prototype = Object.create(antlr4.tree.ParseTreeVisitor.prototype)
ASTBuilder.prototype.constructor = ASTBuilder

ASTBuilder.prototype._loc = function (ctx) {
  var sourceLocation = {
    start: {
      line: ctx.start.line,
      column: ctx.start.column
    },
    end: {
      line: ctx.stop.line,
      column: ctx.stop.column
    }
  }
  return { loc: sourceLocation }
}

ASTBuilder.prototype._range = function (ctx) {
  return { range: [ctx.start.start, ctx.stop.stop] }
}

ASTBuilder.prototype.meta = function (ctx) {
  var ret = {}
  if (this.options.loc) { Object.assign(ret, this._loc(ctx)) }
  if (this.options.range) { Object.assign(ret, this._range(ctx)) }
  return ret
}

ASTBuilder.prototype.createNode = function (obj, ctx) {
  return Object.assign(obj, this.meta(ctx))
}

ASTBuilder.prototype.visit = function (ctx) {
  if (ctx == null) {
    return null
  }

  if (Array.isArray(ctx)) {
    return ctx.map(function (child) {
      return this.visit(child)
    }, this)
  }

  var name = ctx.constructor.name
  if (name.endsWith('Context')) {
    name = name.substring(0, name.length - 'Context'.length)
  }

  var node = { type: name }

  if (name in transformAST) {
    Object.assign(node,
      transformAST[name].call(this, ctx)
    )
  }

  return this.createNode(node, ctx)
}

module.exports = ASTBuilder
