import { parse } from '@babel/parser';
import traverse, { Node, NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as R from 'ramda';


export function transform(code: string): string {
    const ast = parse(code, {
        sourceFilename: "test.js", sourceType: "module"
    });
    traverse(ast, {
        ObjectExpression(path: any) {
            const reference = { mutations: [path.node?.loc?.start?.line] };
            R.clone(path.node.properties).forEach((property: any) => {
                // TODO use Symbol.for("ta") instead of normal Symbol
                path.unshiftContainer("properties", addObjectProperty(property.key.name, JSON.stringify(reference)));
            });
        },
        VariableDeclarator(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            if (path?.node?.init?.type === "ObjectExpression") { return; }
            if (path?.parentPath.parentPath?.type === "ForStatement") { return; }
            path?.parentPath?.insertAfter(addSymbol(path?.node?.loc?.start?.line, path?.node?.id?.name));
        },
        AssignmentExpression(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            const reference = { mutations: [path.node?.loc?.start?.line] };
            let assignmentExpression;
            if (t.isIdentifier(path.node.left)) {
                const operator = path.node.operator;
                const left = t.identifier(getSymbolName(path.node.left.name));
                assignmentExpression = t.assignmentExpression(operator, left, getSymbolCallExpression([t.stringLiteral(JSON.stringify(reference))]));
            } else if (t.isMemberExpression(path.node.left)) {
                const operator = path.node.operator;
                const right = t.stringLiteral(JSON.stringify(reference));
                const objectId = t.identifier(path.node.left.object.name);
                const objectValue = t.callExpression(t.identifier('Symbol'), [t.stringLiteral(path.node.left.property.name)]);
                const mutatedLeftVal = t.memberExpression(objectId, objectValue, true);

                assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
            }
            if (assignmentExpression) {
                path.parentPath.insertAfter(t.expressionStatement(assignmentExpression));
            }
        },
        FunctionDeclaration(path: any) {
            R.clone(path.node.params).forEach((param: any) => {
                const paramNode = path?.context?.scope?.bindings[param?.name];
                if (paramNode?.path?.node?.init?.type !== 'ObjectExpression' && t.isIdentifier(param)) {
                    path.node.params.push(t.identifier(getSymbolName(param?.name)));
                }
            });
        },
        CallExpression(path) {
            if (path?.node?.callee?.type === 'Identifier' && path?.node?.callee?.name !== 'Symbol') {
                R.clone(path?.node?.arguments).forEach((argument: any) => {
                    const paramNode = path?.context?.scope?.bindings[argument?.name];
                    if ((<any>paramNode?.path?.node)?.init?.type !== 'ObjectExpression' && t.isIdentifier(argument)) {
                        path.node.arguments.push(t.identifier(getSymbolName(argument?.name)));
                    }
                });
            }
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    return result.code;
}

function addSymbol(startLine: number, name: string): t.VariableDeclaration {
    const reference = { mutations: [startLine] };
    const symbolName = getSymbolName(name);
    const declarator = t.variableDeclarator(t.identifier(symbolName), getSymbolCallExpression([t.stringLiteral(JSON.stringify(reference))]));
    return t.variableDeclaration('let', [declarator]);
}

function addObjectProperty(keyName: string, value: string): t.ObjectProperty {
    return t.objectProperty(
        t.callExpression(t.identifier('Symbol'), [t.stringLiteral(keyName)]),
        t.stringLiteral(value), true
    );
}

function getSymbolCallExpression(args: any[]) {
    return t.callExpression(t.identifier('Symbol'), args);
}

function getSymbolName(name: string) {
    if (!name) { throw new Error('unable to generate symbol name') }
    return `${name}_MyLib`;
}