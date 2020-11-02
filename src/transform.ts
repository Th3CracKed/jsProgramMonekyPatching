import { parse } from '@babel/parser';
import  traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';


export function transform(code: string): string {
    const ast = parse(code, {
        plugins: ['typescript']
    });
    traverse(ast, {
        FunctionDeclaration(path){
            path.replaceWith(toArrowFunction(path.node))
        }
    });
    const result = generate(ast);
    console.log(result.map)
    return result.code;
}

function toArrowFunction(node: t.FunctionDeclaration): t.VariableDeclaration {
    const name = node?.id?.name || "converted";
    const identifier = t.identifier(name);
    const arrowFunctionExpression = t.arrowFunctionExpression(
        node.params,
        node.body,
        node.async
    );
    const declarator = t.variableDeclarator(identifier, arrowFunctionExpression);
    return t.variableDeclaration('const', [declarator]);
}