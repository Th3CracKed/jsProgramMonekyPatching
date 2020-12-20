import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as R from 'ramda';


export function transform(code: string): string {
    const ast = parse(code, {
        sourceFilename: "test.js", sourceType: "module"
    });
    traverse(ast, {
        ObjectExpression(path: any) {
            addSymbolToObject(path);
        },
        VariableDeclarator(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            if (path?.node?.init?.type === "ObjectExpression") { return; }
            if (path?.parentPath.parentPath?.type === "ForStatement") { return; }
            if (path?.node?.init?.type === 'ArrowFunctionExpression') {
                appendArgumentsToArrowFunctionDeclaration(path);
            } else {
                path?.parentPath?.insertAfter(addSymbol(path?.node?.loc?.start?.line, path?.node?.id?.name));
            }
        },
        AssignmentExpression(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            const mutationPos = path.node?.loc?.start?.line;
            const reference = { mutations: [mutationPos] };
            if (t.isIdentifier(path.node.left)) {
                const operator = path.node.operator;
                const symbolName = getSymbolName(path.node.left.name);
                const left = t.identifier(symbolName);
                const symbolAlreadyExists = doSymbolAlreadyExists(path, symbolName); // todo apply this to member expression 
                if (symbolAlreadyExists) {
                    const statementsToAdd = addMutationPositionToExistingSymbol(symbolName, mutationPos);
                    statementsToAdd.forEach(statement => path.parentPath.insertAfter(statement));
                } else {
                    const assignmentExpression = t.assignmentExpression(operator, left, getSymbol([t.stringLiteral(JSON.stringify(reference))]));
                    path.parentPath.insertAfter(t.expressionStatement(assignmentExpression));
                }
            } else if (t.isMemberExpression(path.node.left)) {
                const operator = path.node.operator;
                const right = t.stringLiteral(JSON.stringify(reference));
                const objectId = t.identifier(path.node.left.object.name);
                const objectValue = t.callExpression(t.identifier('Symbol'), [t.stringLiteral(path.node.left.property.name)]);
                const mutatedLeftVal = t.memberExpression(objectId, objectValue, true);
                const assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
                path.parentPath.insertAfter(t.expressionStatement(assignmentExpression));
            }
        },
        FunctionDeclaration(path: any) {
            appendArgumentsToFunctionDeclaration(path);
            appendSymbolsIntoReturnOfFunctionDeclaration(path);
        },
        CallExpression(path: any) {
            appendArgumentsToFunctionCall(path);
            // const resultVariableNode: any = path?.parentPath?.parentPath?.node;
            // const resultVariableName = resultVariableNode?.declarations[0]?.id?.name;
            // const symbolName = getSymbolName(resultVariableName);
            // path?.replaceWith(t.memberExpression(path?.node, t.numericLiteral(0), true));
            // const symbolDeclarator = t.variableDeclarator(t.identifier(symbolName), t.memberExpression(path?.node, t.numericLiteral(1), true));
            // path?.parentPath?.parentPath.insertAfter(t.variableDeclaration('let', [symbolDeclarator]));
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    return result.code;
}

function checkIfFunctionReturnValue(path: any): boolean {
    const nameOfTheFunctionToCheck = path?.node?.callee?.name;
    if (nameOfTheFunctionToCheck === 'Symbol') { return false; }
    const functionNode = path?.parentPath?.parentPath?.container?.find((node: any) =>
        node?.type === 'FunctionDeclaration' && node?.id?.name === nameOfTheFunctionToCheck);
    return hasReturnValue(functionNode);
}

function hasReturnValue(functionNode: t.FunctionExpression): boolean {
    return functionNode?.body?.body.some((node: any) => node?.type === 'ReturnStatement');
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

function addSymbolToObject(path: any) {
    const mutationPos = path.node?.loc?.start?.line;
    const reference = { mutations: [mutationPos] };
    R.clone(path.node.properties).forEach((property: any) => {
        // TODO use Symbol.for("ta") instead of normal Symbol
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

function addMutationPositionToExistingSymbol(symbolName: string, mutationPos: number) {
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
    return t.expressionStatement(t.assignmentExpression('=', left, right));
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
    const declarator = t.variableDeclarator(t.identifier(symbolName), getSymbol([t.stringLiteral(JSON.stringify(reference))]));
    return t.variableDeclaration('let', [declarator]);
}

function addObjectProperty(keyName: string, value: string): t.ObjectProperty {
    return t.objectProperty(
        t.callExpression(t.identifier('Symbol'), [t.stringLiteral(keyName)]),
        t.stringLiteral(value), true
    );
}

function getSymbol(args: any[]): t.CallExpression {
    return t.callExpression(t.identifier('Symbol'), args);
}

function getSymbolName(name: string): string {
    if (!name) { throw new Error('unable to generate symbol name'); }
    return `${name}_MyLib`;
}