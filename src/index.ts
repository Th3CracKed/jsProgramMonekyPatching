import { transform as customTransform } from './transform';
import { transform } from '@babel/core';

// const code = `/**
// * Required External Modules
// */
// import * as express from 'express';
// import * as helmet from 'helmet';
// import * as rateLimit from 'express-rate-limit';
// import * as cors from 'cors';

// /**
// * App Variables
// */

// const app = express();

// app.use(helmet());

// // Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
// // see https://expressjs.com/en/guide/behind-proxies.html
// // app.set('trust proxy', 1);

// //  apply to all requests
// app.use(rateLimit({
//  windowMs: 15 * 60 * 1000, // 15 minutes
//  max: 100 // limit each IP to 100 requests per windowMs
// }));

// app.use(cors());

// app.disable('x-powered-by');

// app.get('/', (req, res) => {
//  let result;
//  if(req.query.userInput){
//    result = 'userTypedSomething';
//  }else{
//    result = 'userDidntTypeAnything';
//  }
//  res.send(result);
// });
// app.listen(3000, () => {
//  console.log(\`Server started on server ${3000}\`);
// });`;

const code = `let a = 2;
const obj = { a: "not_a", b: "note_b"};
obj.ta = "a";
a = 3;
(function() {
    obj.ta = "b";
  })()
const x = 2n ** 53n;
let foo = 42;
let bar = 'bar';
let bool = true;
let somethingUndefined = undefined;
let somethingNull = null;
let symbol = Symbol();
function passMeParams(foo){
  console.log('Imagine i want to know where foo was assigned')
}
passMeParams(foo);
for(let i = 0; i < 10; i++){
  console.log('iteration = ' + i);
}
/*
function doStuff(){
  let bq2 = 'l';
  bq2 = 'pff'
  return bq2;
}

let returnVar = doStuff();

function doStuff() {
    let bq2 = 'l';
    let bq2_MyLib = Symbol("{\"mutations\":[16]}");
    bq2 = 'pff';
    bq2_MyLib = Symbol("{\"mutations\":[17]}");
    return [bq2, bq2_MyLib];
}

let returnVar = doStuff()[0];
let returnVar_MyLib = doStuff()[1];
let returnVar_MyLib1 = JSON.parse(returnVar_MyLib.description);
returnVar_MyLib1.mutations.push(22);
returnVar_MyLib = Symbol(JSON.stringify(returnVar_MyLib1));
*/
`;
const transformedCode = customTransform(code);
console.log(transformedCode);
console.log('-----------------');
// const result = transform(transformedCode, {
//     filename: 'test2.js', presets: ["@babel/preset-typescript"], sourceMaps: true,
// });
//console.log(result);
//console.log(result?.code);
// console.log(result?.map);