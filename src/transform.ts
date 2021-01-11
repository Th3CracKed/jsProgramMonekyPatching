import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as R from 'ramda';


export function transform(code: string): string {
    const ast = parse(code, {
        sourceFilename: "test.js", sourceType: "module"
    });
    traverse(ast, {
        ObjectProperty(path) {
            appendArgumentsToFunctionInsideAnObject(path);
        },
        ObjectExpression(path: any) {
            addSymbolToObject(path);
        },
        VariableDeclarator(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            if (t.isObjectExpression(path?.node?.init)) { return; }
            if (t.isForStatement(path?.parentPath.parentPath)) { return; }
            const variableName = path?.node?.id?.name;
            const variableBinding = path?.context?.scope?.bindings[variableName];
            if (t.isArrowFunctionExpression(path?.node?.init)) {
                appendArgumentsToArrowFunctionDeclaration(path);
            } else if (
                t.isCallExpression(path?.node?.init) &&
                path?.node?.init?.callee?.name !== 'Symbol' &&
                t.isIdentifier(path?.node?.id)
            ) {
                addSymbolForFunctionResult(path);
            } else if (isPrimitiveVariable(variableBinding)) {
                path?.parentPath?.insertAfter(declareSymbol('let', path?.node?.loc?.start?.line, path?.node?.id?.name));
            }
        },
        AssignmentExpression(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            const mutationPos: number = path.node?.loc?.start?.line;
            if (t.isIdentifier(path.node.left)) {
                if (t.isCallExpression(path.node.right)) {
                    assignSymbolForFunctionResult(path, mutationPos);
                } else {
                    addSymbolForPrimitiveAssignment(path, mutationPos);
                }
            } else if (t.isMemberExpression(path.node.left)) {
                if (t.isThisExpression(path.node.left.object)) {
                    addSymbolForClassAssignment(path, mutationPos);
                } else {
                    addSymbolForObjectAssignment(path, mutationPos);
                }
            }
        },
        FunctionExpression(path: any) {
            appendSymbolsIntoReturnOfFunctionDeclaration(path);
        },
        FunctionDeclaration(path: any) {
            appendArgumentsToFunctionDeclaration(path);
            appendSymbolsIntoReturnOfFunctionDeclaration(path);
        },
        ExpressionStatement(path) {
            appendArgumentsToFunctionCall(path);
            addSymbolOnArrayMutation(path);
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    return result.code;
}

function addSymbolOnArrayMutation(path: NodePath<t.ExpressionStatement>) { // TODO don't add mutation for array methods that dont mutate (like map)
    if (
        t.isCallExpression(path?.node?.expression) &&
        t.isMemberExpression(path?.node?.expression?.callee) &&
        t.isIdentifier(path?.node?.expression?.callee?.object) &&
        t.isIdentifier(path?.node?.expression?.callee?.property)
    ) {
        const arrayCandidateName = path?.node?.expression?.callee?.object?.name;
        const binding = path?.context?.scope?.bindings[arrayCandidateName];
        if (t.isVariableDeclarator(binding?.path?.node) && t.isArrayExpression(binding?.path?.node?.init)) {
            const mutationPos = path.node?.loc?.start?.line;
            if (mutationPos) {
                const symbolName = getSymbolName(arrayCandidateName);
                getMutateExistingSymbolStatement(symbolName, mutationPos).forEach(statement => path.insertAfter(statement));
            }
        }
    }
}

function appendArgumentsToFunctionInsideAnObject(path: any) {
    if (t.isArrowFunctionExpression(path?.node?.value) ||
        t.isFunctionExpression(path?.node?.value)
    ) {
        const functionLike = path?.node?.value;
        R.clone(functionLike?.params)?.forEach((param: any) => {
            const paramNode = path?.context?.scope?.bindings[param?.name];
            if (isPrimitiveVariable(paramNode) && t.isIdentifier(param)) {
                functionLike.params.push(t.identifier(getSymbolName(param?.name)));
            }
        });
    }
}

function assignSymbolForFunctionResult(path: any, mutationPos: number) {
    const varName = path.node.left.name;
    const symbolName = getSymbolName(varName);
    path.node.left = t.arrayPattern([t.identifier(varName), t.identifier(symbolName)]);
    getMutateExistingSymbolStatement(symbolName, mutationPos).forEach(statement => path.parentPath.insertAfter(statement));
}

function addSymbolForFunctionResult(path: any) {
    const mutationPos: number = path.node?.loc?.start?.line;
    const varName = path?.node?.id?.name;
    const symbolName = getSymbolName(varName);
    const arrayDeclaration = t.arrayPattern([t.identifier(varName), t.identifier(symbolName)]);
    path.node.id = arrayDeclaration;
    getMutateExistingSymbolStatement(symbolName, mutationPos).forEach(statement => path.parentPath.insertAfter(statement));
}

function addSymbolForClassAssignment(path: any, mutationPos: number) {
    const operator = path.node.operator;
    const reference = { mutations: [mutationPos] };
    const symbolName = getSymbolName(path.node.left.property.name);
    const doSymbolExists = doSymbolAlreadyExists(path, symbolName);
    if (doSymbolExists) {
        getMutateExistingSymbolStatement(symbolName, mutationPos).forEach(statement => path.parentPath.insertAfter(statement));
    } else {
        const mutatedLeftVal = t.memberExpression(t.thisExpression(), t.identifier(symbolName));
        const assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, getSymbol(JSON.stringify(reference)));
        path.getStatementParent().insertAfter(t.expressionStatement(assignmentExpression));
    }
}

function addSymbolForObjectAssignment(path: any, mutationPos: number) {
    const operator = path.node.operator;
    const reference = { mutations: [mutationPos] };
    const right = t.stringLiteral(JSON.stringify(reference));
    const objectId = t.identifier(path.node.left.object.name);
    const symbol = getSymbol(path.node.left.property.name, true);
    const mutatedLeftVal = t.memberExpression(objectId, symbol, true);
    const assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
    path.getStatementParent().insertAfter(t.expressionStatement(assignmentExpression));
}

function addSymbolForPrimitiveAssignment(path: any, mutationPos: number) {
    const symbolName = getSymbolName(path.node.left.name);
    const doSymbolExists = doSymbolAlreadyExists(path, symbolName); // todo apply this to member expression 
    if (doSymbolExists) {
        getMutateExistingSymbolStatement(symbolName, mutationPos).forEach(statement => path.parentPath.insertAfter(statement));
    } else {
        addSymbol(path, path.node.left.name, mutationPos);
    }
}

function appendArgumentsToArrowFunctionDeclaration(path: any) {
    R.clone(path.node.init.params).forEach((param: any) => {
        const paramNode = path?.context?.scope?.bindings[param?.name];
        if (isPrimitiveVariable(paramNode) && t.isIdentifier(param)) {
            path.node.init.params.push(t.identifier(getSymbolName(param?.name)));
        }
    });
}

function appendArgumentsToFunctionCall(path: NodePath<t.ExpressionStatement>) {
    if (t.isCallExpression(path?.node?.expression)) {
        R.clone(path?.node?.expression?.arguments).forEach((argument: any) => {
            const paramNode = path?.context?.scope?.bindings[argument?.name];
            if ((<any>paramNode?.path?.node)?.init?.type !== 'ObjectExpression' && t.isIdentifier(argument)) {
                (<t.CallExpression>path.node.expression).arguments.push(t.identifier(getSymbolName(argument?.name)));
            }
        });
    }
}


function addSymbolToObject(path: any) {
    const mutationPos = path.node?.loc?.start?.line;
    const reference = { mutations: [mutationPos] };
    R.clone(path.node.properties).forEach((property: any) => {
        path.unshiftContainer("properties", addObjectProperty(property.key.name, JSON.stringify(reference)));
    });
}

function appendSymbolsIntoReturnOfFunctionDeclaration(path: any) {
    const returnNode: t.ReturnStatement = path?.node?.body?.body?.find((node: any) => t.isReturnStatement(node));
    if (returnNode) {
        const symbolName = getSymbolName((<any>returnNode.argument)?.name);
        returnNode.argument = t.arrayExpression([returnNode.argument, t.identifier(symbolName)]);
    }
}

function appendArgumentsToFunctionDeclaration(path: any) {
    R.clone(path.node.params).forEach((param: any) => {
        const paramNode = path?.context?.scope?.bindings[param?.name];
        if (isPrimitiveVariable(paramNode) && t.isIdentifier(param)) {
            path.node.params.push(t.identifier(getSymbolName(param?.name)));
        }
    });
}

function addSymbol(path: any, forVarName: string, mutationPos: number) {
    const symbolName = getSymbolName(forVarName);
    const isDeclaredVariableName = `is${symbolName?.charAt(0).toUpperCase() + symbolName?.slice(1)}Declared`;
    const errorTestExpression = t.binaryExpression('===', t.memberExpression(t.identifier('e'), t.identifier('name')), t.stringLiteral('ReferenceError'));
    const disableIsDeclaredVariableBlock = t.blockStatement([t.expressionStatement(t.assignmentExpression('=', t.identifier(isDeclaredVariableName), t.booleanLiteral(false)))]);
    const ifStatement = t.ifStatement(errorTestExpression, disableIsDeclaredVariableBlock);
    const catchBlock = t.catchClause(t.identifier('e'), t.blockStatement([ifStatement]));
    path.parentPath.insertAfter(
        [
            t.variableDeclaration('let', [t.variableDeclarator(t.identifier(isDeclaredVariableName), t.booleanLiteral(true))]),
            t.tryStatement(t.blockStatement([t.expressionStatement(t.identifier(symbolName))], []), catchBlock),
            t.ifStatement(
                t.identifier(isDeclaredVariableName),
                t.blockStatement(getMutateExistingSymbolStatement(symbolName, mutationPos).reverse()),
                t.blockStatement([declareSymbol('var', mutationPos, forVarName)])
            )
        ]
    );
}

function getMutateExistingSymbolStatement(symbolName: string, mutationPos: number) {
    return [
        getAParsedJsonStoredInSymbol(symbolName),
        pushNewPositionToJson(symbolName, mutationPos),
        stringifyTheNewSymbolIntoJson(symbolName)
    ];
}

function getAParsedJsonStoredInSymbol(symbolName: string): t.ExpressionStatement {
    const left = t.identifier(symbolName);
    const parameters = [t.callExpression(t.memberExpression(t.identifier('JSON'), t.identifier('stringify')), [t.identifier(`${symbolName}_parsed`)])];
    const right = t.callExpression(t.identifier('Symbol'), parameters);
    return t.expressionStatement(t.assignmentExpression('=', left, right));
}

function pushNewPositionToJson(symbolName: string, mutationPos: number) {
    const left = t.identifier(`${symbolName}_parsed`);
    const memberExpression = t.memberExpression(t.memberExpression(left, t.identifier('mutations')), t.identifier('push'));
    const parameters = [t.numericLiteral(mutationPos)];
    return t.expressionStatement(t.callExpression(memberExpression, parameters));
}

function stringifyTheNewSymbolIntoJson(symbolName: string) {
    const left = t.identifier(`${symbolName}_parsed`);
    const memberExpression = t.memberExpression(t.identifier('JSON'), t.identifier('parse'));
    const parameters = [t.memberExpression(t.identifier(symbolName), t.identifier('description'))];
    const right = t.callExpression(memberExpression, parameters);
    return t.variableDeclaration('let', [t.variableDeclarator(left, right)]);
}

function doSymbolAlreadyExists(path: any, symbolName: string) {
    return path.getStatementParent()?.container?.some((node: any) => {
        return node?.declarations?.some((varDeclaration: any) => {
            return varDeclaration?.id?.name === symbolName;
        });
    });
}

function isPrimitiveVariable(binding: any) {
    return binding?.path?.node?.init?.type !== 'ObjectExpression' && binding?.path?.node?.init?.type !== 'Identifier';
}

function declareSymbol(kind: "var" | "let" | "const", startLine: number, name: string): t.VariableDeclaration {
    const reference = { mutations: [startLine] };
    const symbolName = getSymbolName(name);
    const declarator = t.variableDeclarator(t.identifier(symbolName), getSymbol(JSON.stringify(reference)));
    return t.variableDeclaration(kind, [declarator]);
}

function addObjectProperty(keyName: string, value: string): t.ObjectProperty {
    return t.objectProperty(
        getSymbol(keyName, true),
        t.stringLiteral(value), true
    );
}

function getSymbol(description: string, forObject: boolean = false): t.CallExpression {
    if (forObject) {
        return t.callExpression(t.memberExpression(t.identifier('Symbol'), t.identifier('for'), false), [t.stringLiteral(description)]);
    } else {
        return t.callExpression(t.identifier('Symbol'), [t.stringLiteral(description)]);
    }
}

function getSymbolName(name: string): string {
    if (!name) { throw new Error('unable to generate symbol name'); }
    return `${name}_MyLib`;
}