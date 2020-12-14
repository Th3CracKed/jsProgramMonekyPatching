import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as R from 'ramda';


export function transform(code: string): string {
    const ast = parse(code, {
        plugins: ['typescript'], sourceFilename: "test.js", sourceType: "module"
    });
    let rootNode: NodePath<t.Program>;
    traverse(ast, {
        Program(path) {
            rootNode = path;
        },
        ObjectExpression(path: any) {
            const startLine = '' + path.node?.loc?.start?.line;
            R.clone(path.node.properties).forEach((property: any) => {
                path.unshiftContainer("properties", addObjectProperty(property.key.name, startLine));
            });
        },
        VariableDeclarator(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            if (path?.node?.init?.type === "ObjectExpression") {
                return;
            } else {
                path?.parentPath?.insertAfter(addSymbol(path.node));
            }
        },
        AssignmentExpression(path: any) {
            if (!path?.node?.loc) { return; } // todo maybe extract this to separate variable and loop through variables to visit manually to avoid infinite recursive instead of this hack
            const startLine = path?.node?.loc?.start?.line;
            let assignmentExpression;
            if (t.isIdentifier(path.node.left)) {
                const operator = path.node.operator;
                const left = t.identifier(getSymbolName(path.node.left.name));
                assignmentExpression = t.assignmentExpression(operator, left, getSymbolCallExpression([t.stringLiteral(`${startLine}`)]));
            } else if (t.isMemberExpression(path.node.left)) {
                const operator = path.node.operator;
                const right = t.stringLiteral(`${startLine}`);
                const objectId = t.identifier(path.node.left.object.name);
                const objectValue = t.callExpression(t.identifier('Symbol'), [t.stringLiteral(path.node.left.property.name)]);
                const mutatedLeftVal = t.memberExpression(objectId, objectValue, true);

                assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
            }
            if (assignmentExpression) {
                path.parentPath.insertAfter(t.expressionStatement(assignmentExpression));
            }
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    //console.log(result.map)
    return result.code;
}

function addSymbol(node: t.VariableDeclaration): t.VariableDeclaration {
    const startLine = node?.loc?.start?.line;
    const name = (<any>node).id ? getSymbolName((<any>node).id.name) : "tmp_MyLib";
    const declarator = t.variableDeclarator(t.identifier(name), getSymbolCallExpression([t.stringLiteral(`${startLine}`)]));
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
    return `${name}_MyLib` || "tmp_MyLib";
}