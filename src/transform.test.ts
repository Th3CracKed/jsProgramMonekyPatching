import { transform } from './transform';

describe('Code transformation for primitives', () => {

  test('Expect transformation to add symbol when encountering a primitive variable declaration nu;ber', () => {
    const transformedCode = transform(`let a = 2;`);
    const expectedResult = `let a = 2;
let a_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });


  test('Expect transformation to add symbol when encountering a primitive variable declaration string', () => {
    const transformedCode = transform(`let bar = 'bar';`);
    const expectedResult = `let bar = 'bar';
let bar_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable declaration boolean', () => {
    const transformedCode = transform(`let bool = true;`);
    const expectedResult = `let bool = true;
let bool_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable declaration undefined', () => {
    const transformedCode = transform(`let somethingUndefined = undefined;`);
    const expectedResult = `let somethingUndefined = undefined;
let somethingUndefined_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable declaration bigInt', () => {
    const transformedCode = transform(`const x = 2n ** 53n;`);
    const expectedResult = `const x = 2n ** 53n;
let x_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable declaration symbol', () => {
    const transformedCode = transform(`let symbol = Symbol();`);
    const expectedResult = `let symbol = Symbol();
let symbol_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable assignment', () => {
    const transformedCode = transform(`a = 3;`);
    const expectedResult = `a = 3;
a_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

});

describe('Code transformation for Objects', () => {

  // null is considered an object according to https://developer.mozilla.org/en-US/docs/Glossary/Primitive so keep it here :)
  test('Expect transformation to add symbol when encountering a null variable declaration', () => {
    const transformedCode = transform(`let somethingNull = null;`);
    const expectedResult = `let somethingNull = null;
let somethingNull_MyLib = Symbol("{\\"mutations\\":[1]}");`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbols when encountering an object declaration into the same object', () => {
    const transformedCode = transform(`const obj = { a: "not_a", b: "note_b"};`);
    const expectedResult = `const obj = {
  [Symbol("b")]: "{\\"mutations\\":[1]}",
  [Symbol("a")]: "{\\"mutations\\":[1]}",
  a: "not_a",
  b: "note_b"
};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add nothing when encountering an empty object declaration', () => {
    const transformedCode = transform(`const obj = {};`);
    const expectedResult = `const obj = {};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering an object assignation into the same object', () => {
    const transformedCode = transform(`obj.ta = "a";`);
    const expectedResult = `obj.ta = "a";
obj[Symbol("ta")] = "{\\"mutations\\":[1]}";`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering an object assignation into the same object', () => {
    const transformedCode = transform(`(function() { obj.ta = "b"; })()`);
    const expectedResult = `(function () {
  obj.ta = "b";
  obj[Symbol("ta")] = "{\\"mutations\\":[1]}";
})();`;
    expect(transformedCode).toEqual(expectedResult);
  });

});

describe('Code transformation for functions', () => {

  test('Expect transformation to add symbols arguments to the function declaration', () => {
    const transformedCode = transform(`
    function passMeParams(foo){
      console.log('Imagine i want to know where foo was assigned');
    }
  `);
    const expectedResult = `function passMeParams(foo, foo_MyLib) {
  console.log('Imagine i want to know where foo was assigned');
}`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbols arguments to the function call', () => {
    const transformedCode = transform(`passMeParams(foo);`);
    const expectedResult = `passMeParams(foo, foo_MyLib);`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbols argument to lambda functions declaration', () => {
    const transformedCode = transform(`
    const passMeParams = (foo) => {
      console.log('Imagine i want to know where foo was assigned');
    };
  `);
    const expectedResult = `const passMeParams = (foo, foo_MyLib) => {
  console.log('Imagine i want to know where foo was assigned');
};`;
    expect(transformedCode).toEqual(expectedResult);
  });

});