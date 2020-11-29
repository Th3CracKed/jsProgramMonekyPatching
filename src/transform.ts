import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';


export function transform(code: string): string {
    const ast = parse(code, {
        plugins: ['typescript'], sourceFilename: "test.js", sourceType: "module"
    });
    const variableDeclarator = {
        VariableDeclarator(path: any) {
            if (path.node.init && path.node.init.type === "ObjectExpression") {
                const startLine = '' + path.node?.loc?.start?.line;
                path.node.init.properties.forEach((property: { key: { name: any; }; value: { value: any; }; }) => {
                    path.node.init.properties.push(addExpression(property.key.name, startLine));
                });

            } else if (path.node) {

                if (path.parentPath && path.parentPath.parent && path.parentPath.parent.body) {
                    path.parentPath.parent.body.push(addSymbol(path.node));
                }

            }

        }
    };
    traverse(ast, {
        VariableDeclaration(path) {
            path.traverse(variableDeclarator);
        },
        ExpressionStatement(path) {
            const startLine = path?.node?.loc?.start?.line;
            let assignmentExpression;
            // TODO replace with switch case !
            if (!(<any>path.node.expression).left) { return; }
            if (t.isIdentifier((<any>path.node.expression).left)) {
                const operator = (<any>path.node.expression).operator;
                const left = t.identifier(getSymbolName((<any>path.node.expression).left.name));
                assignmentExpression = t.assignmentExpression(operator, left, getSymbolCallExpression([t.stringLiteral(`${startLine}`)]));
            } else if (t.isMemberExpression((<any>path.node.expression).left)) {
                const operator = (<any>path.node.expression).operator;
                const right = (<any>path.node.expression).right;
                const objectId = t.identifier((<any>path.node.expression).left.object.name);
                const objectValue = t.callExpression(t.identifier('Symbol'), [t.stringLiteral((<any>path.node.expression).left.property.name)]);
                const mutatedLeftVal = t.memberExpression(objectId, objectValue, true);

                assignmentExpression = t.assignmentExpression(operator, mutatedLeftVal, right);
            }
            if (assignmentExpression) {
                (<any>path.parent).body.push(t.expressionStatement(assignmentExpression));
            }
        }
    });
    const result = generate(ast, { sourceMaps: true, filename: 'filename.txt' }, { "test.js": code });
    console.log(result.map)
    return result.code;
}

function addSymbol(node: t.VariableDeclaration): t.VariableDeclaration {
    const startLine = node?.loc?.start?.line;
    const name = (<any>node).id ? getSymbolName((<any>node).id.name) : "tmp_MyLib";
    const declarator = t.variableDeclarator(t.identifier(name), getSymbolCallExpression([t.stringLiteral(`${startLine}`)]));
    return t.variableDeclaration('let', [declarator]);
}

function addExpression(keyName: string, value: string): t.ObjectProperty {
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