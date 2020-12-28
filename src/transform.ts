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
            if (path?.node?.init?.type === "ObjectExpression") { return; }
            if (path?.parentPath.parentPath?.type === "ForStatement") { return; }
            if (path?.node?.init?.type === 'ArrowFunctionExpression') {
                appendArgumentsToArrowFunctionDeclaration(path);
            } else if (
                t.isCallExpression(path?.node?.init) &&
                path?.node?.init?.callee?.name !== 'Symbol' &&
                t.isIdentifier(path?.node?.id)
            ) {
                addSymbolForFunctionResult(path);
            } else {
                path?.parentPath?.insertAfter(addSymbol(path?.node?.loc?.start?.line, path?.node?.id?.name));
            }
        },
        AssignmentExpression(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            const mutationPos: number = path.node?.loc?.start?.line;
            const reference = { mutations: [mutationPos] };
            if (t.isIdentifier(path.node.left)) {
                if (t.isCallExpression(path.node.right)) {
                    assignSymbolForFunctionResult(path, mutationPos);
                } else {
                    addSymbolForPrimitiveAssignment(path, reference, mutationPos);
                }
            } else if (t.isMemberExpression(path.node.left)) {
                addSymbolForObjectAssignment(path, reference);
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
            appendArgumentsToFunctionCallInsideObject(path);
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    return result.code;
}

function appendArgumentsToFunctionInsideAnObject(path: any) {
    if (t.isArrowFunctionExpression(path?.node?.value) ||
        t.isFunctionExpression(path?.node?.value)
    ) {
        const functionLike = path?.node?.value;
        R.clone(functionLike?.params)?.forEach((param: any) => {
            const paramNode = path?.context?.scope?.bindings[param?.name];
            if (isPrimitiveVariable(paramNode, param)) {
                functionLike.params.push(t.identifier(getSymbolName(param?.name)));
            }
        });
    }
}

function assignSymbolForFunctionResult(path: any, mutationPos: number) {
    const varName = path.node.left.name;
    const symbolName = getSymbolName(varName);
    path.node.left = t.arrayPattern([t.identifier(varName), t.identifier(symbolName)]);
    addMutationPositionToExistingSymbol(path.parentPath, symbolName, mutationPos);
}

function addSymbolForFunctionResult(path: any) {
    const mutationPos: number = path.node?.loc?.start?.line;
    const varName = path?.node?.id?.name;
    const symbolName = getSymbolName(varName);
    const arrayDeclaration = t.arrayPattern([t.identifier(varName), t.identifier(symbolName)]);
    path.node.id = arrayDeclaration;
    addMutationPositionToExistingSymbol(path.parentPath, symbolName, mutationPos);
}

function addSymbolForObjectAssignment(path: any, reference: { mutations: any[]; }) {
    const operator = path.node.operator;
    const right = t.stringLiteral(JSON.stringify(reference));
    const objectId = t.identifier(path.node.left.object.name);
    const symbol = getSymbol(path.node.left.property.name, true);
    const mutatedLeftVal = t.memberExpression(objectId, symbol, true);
    const assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
    const parentStatementPath = path.getStatementParent();
    parentStatementPath.insertAfter(t.expressionStatement(assignmentExpression));
}

function addSymbolForPrimitiveAssignment(path: any, reference: { mutations: number[]; }, mutationPos: number) {
    const operator = path.node.operator;
    const symbolName = getSymbolName(path.node.left.name);
    const left = t.identifier(symbolName);
    const doSymbolExists = doSymbolAlreadyExists(path, symbolName); // todo apply this to member expression 
    if (doSymbolExists) {
        addMutationPositionToExistingSymbol(path.parentPath, symbolName, mutationPos);
    } else {
        const assignmentExpression = t.assignmentExpression(operator, left, getSymbol(JSON.stringify(reference)));
        path.parentPath.insertAfter(t.expressionStatement(assignmentExpression));
    }
}

function appendArgumentsToArrowFunctionDeclaration(path: any) {
    R.clone(path.node.init.params).forEach((param: any) => {
        const paramNode = path?.context?.scope?.bindings[param?.name];
        if (isPrimitiveVariable(paramNode, param)) {
            path.node.init.params.push(t.identifier(getSymbolName(param?.name)));
        }
    });
}

function appendArgumentsToFunctionCall(path: any) {
    if (path?.node?.callee?.type === 'Identifier' && path?.node?.callee?.name !== 'Symbol') {
        R.clone(path?.node?.arguments).forEach((argument: any) => {
            const paramNode = path?.context?.scope?.bindings[argument?.name];
            if ((<any>paramNode?.path?.node)?.init?.type !== 'ObjectExpression' && t.isIdentifier(argument)) {
                path.node.arguments.push(t.identifier(getSymbolName(argument?.name)));
            }
        });
    }
}


function appendArgumentsToFunctionCallInsideObject(path: NodePath<t.ExpressionStatement>) {
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
    const returnNode: t.ReturnStatement = path?.node?.body?.body?.find((node: any) => node?.type === 'ReturnStatement');
    if (returnNode) {
        const symbolName = getSymbolName((<any>returnNode.argument)?.name);
        returnNode.argument = t.arrayExpression([returnNode.argument, t.identifier(symbolName)]);
    }
}

function appendArgumentsToFunctionDeclaration(path: any) {
    R.clone(path.node.params).forEach((param: any) => {
        const paramNode = path?.context?.scope?.bindings[param?.name];
        if (isPrimitiveVariable(paramNode, param)) {
            path.node.params.push(t.identifier(getSymbolName(param?.name)));
        }
    });
}

function addMutationPositionToExistingSymbol(path: any, symbolName: string, mutationPos: number) {
    [
        getAParsedJsonStoredInSymbol(symbolName),
        pushNewPositionToJson(symbolName, mutationPos),
        stringifyTheNewSymbolIntoJson(symbolName)
    ].forEach(statement => path.insertAfter(statement));
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
    return path?.parentPath?.container?.some((node: any) => {
        return node?.declarations?.some((varDeclaration: any) => {
            return varDeclaration?.id?.name === symbolName;
        });
    });
}

function isPrimitiveVariable(paramNode: any, param: any) {
    return paramNode?.path?.node?.init?.type !== 'ObjectExpression' && t.isIdentifier(param);
}

function addSymbol(startLine: number, name: string): t.VariableDeclaration {
    const reference = { mutations: [startLine] };
    const symbolName = getSymbolName(name);
    const declarator = t.variableDeclarator(t.identifier(symbolName), getSymbol(JSON.stringify(reference)));
    return t.variableDeclaration('let', [declarator]);
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