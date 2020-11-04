import { transform } from './transform';


const code = `
let a = 2;

let Sym1 = Symbol()

let b,c = 2;

a = 2;
const obj = { a: "not_a", b: "note_b"};

obj.ta = "a"


function dostuff(variable){
  console.log(variable);
}

dostuff(a) // TODO maybe just passing  symbols as args solve the problem ?`;


const transformedCode = transform(code);

console.log(transformedCode);