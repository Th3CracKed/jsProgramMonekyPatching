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

const code = `
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