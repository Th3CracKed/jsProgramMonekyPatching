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

  test('Expect transformation to add nothing when encountering a primitive variable declaration undefined', () => {
    const transformedCode = transform(`let somethingUndefined = undefined;`);
    const expectedResult = `let somethingUndefined = undefined;`;
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

  test('Expect transformation to add symbol when encountering a primitive variable assignment without a previous variable declaration', () => {
    const transformedCode = transform(`a = 3;`);
    const expectedResult = `a = 3;
let isA_MyLibDeclared = true;

try {
  a_MyLib;
} catch (e) {
  if (e.name === "ReferenceError") {
    isA_MyLibDeclared = false;
  }
}

if (isA_MyLibDeclared) {
  let a_MyLib_parsed = JSON.parse(a_MyLib.description);
  a_MyLib_parsed.mutations.push(1);
  a_MyLib = Symbol(JSON.stringify(a_MyLib_parsed));
} else {
  var a_MyLib = Symbol("{\\"mutations\\":[1]}");
}`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering a primitive variable assignment without a previous variable declaration', () => {
    const transformedCode = transform(`a = 3;
a = 4`);
    const expectedResult = `a = 3;
let isA_MyLibDeclared = true;

try {
  a_MyLib;
} catch (e) {
  if (e.name === "ReferenceError") {
    isA_MyLibDeclared = false;
  }
}

if (isA_MyLibDeclared) {
  let a_MyLib_parsed = JSON.parse(a_MyLib.description);
  a_MyLib_parsed.mutations.push(1);
  a_MyLib = Symbol(JSON.stringify(a_MyLib_parsed));
} else {
  var a_MyLib = Symbol("{\\"mutations\\":[1]}");
}

a = 4;
let isA_MyLibDeclared = true;

try {
  a_MyLib;
} catch (e) {
  if (e.name === "ReferenceError") {
    isA_MyLibDeclared = false;
  }
}

if (isA_MyLibDeclared) {
  let a_MyLib_parsed = JSON.parse(a_MyLib.description);
  a_MyLib_parsed.mutations.push(2);
  a_MyLib = Symbol(JSON.stringify(a_MyLib_parsed));
} else {
  var a_MyLib = Symbol("{\\"mutations\\":[2]}");
}`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add push mutation position when encountering a primitive variable assignment with a previous variable declaration', () => {
    const transformedCode = transform(`let a = 2;
a = 3;`);
    const expectedResult = `let a = 2;
let a_MyLib = Symbol("{\\"mutations\\":[1]}");
a = 3;
let a_MyLib_parsed = JSON.parse(a_MyLib.description);
a_MyLib_parsed.mutations.push(2);
a_MyLib = Symbol(JSON.stringify(a_MyLib_parsed));`;
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
  [Symbol.for("b")]: "{\\"mutations\\":[1]}",
  [Symbol.for("a")]: "{\\"mutations\\":[1]}",
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

  test('Expect transformation to add symbol when encountering an object assignation without a variable declaration into the same object', () => {
    const transformedCode = transform(`obj.ta = "a";`);
    const expectedResult = `obj.ta = "a";
obj[Symbol.for("ta")] = "{\\"mutations\\":[1]}";`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbol when encountering an object assignation without a variable declaration into the same object inside an IIFE', () => {
    const transformedCode = transform(`(function() { obj.ta = "b"; })()`);
    const expectedResult = `(function () {
  obj.ta = "b";
  obj[Symbol.for("ta")] = "{\\"mutations\\":[1]}";
})();`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to push nothing when encountering an empty object declaration', () => {
    const transformedCode = transform(`const obj = {};`);
    const expectedResult = `const obj = {};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to copy symbols according to copied properties', () => {
    const transformedCode = transform(`const obj = {a: 2, b: 3};
const obj2 = {};
obj2.a = obj.a;`);
    const expectedResult = `const obj = {
  [Symbol.for("b")]: "{\\"mutations\\":[1]}",
  [Symbol.for("a")]: "{\\"mutations\\":[1]}",
  a: 2,
  b: 3
};
const obj2 = {};
obj2.a = obj.a;
obj2[Symbol.for("a")] = "{\\"mutations\\":[3]}";`;
    expect(transformedCode).toEqual(expectedResult);
  });
});

test('Expect transformation to copy symbols when object is referenced and dont add symbols outside the object', () => {
  const transformedCode = transform(`const obj = {a: 2, b: 3};
const obj2 = obj;`);
  const expectedResult = `const obj = {
  [Symbol.for("b")]: "{\\"mutations\\":[1]}",
  [Symbol.for("a")]: "{\\"mutations\\":[1]}",
  a: 2,
  b: 3
};
const obj2 = obj;`;
  expect(transformedCode).toEqual(expectedResult);
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

  test('Expect transformation to add symbols in the return result of functions declaration', () => {
    const transformedCode = transform(`function doStuff(){
      let bq2 = 'l';
      return bq2;
    }`);
    const expectedResult = `function doStuff() {
  let bq2 = 'l';
  let bq2_MyLib = Symbol("{\\"mutations\\":[2]}");
  return [bq2, bq2_MyLib];
}`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbols in the return result of functions declaration and in the call that store the return type in new variable', () => {
    const transformedCode = transform(`function doStuff(){
      let bq2 = 'l';
      return bq2;
    }
    let returnVar = doStuff();`);
    const expectedResult = `function doStuff() {
  let bq2 = 'l';
  let bq2_MyLib = Symbol("{\\"mutations\\":[2]}");
  return [bq2, bq2_MyLib];
}

let [returnVar, returnVar_MyLib] = doStuff();
let returnVar_MyLib_parsed = JSON.parse(returnVar_MyLib.description);
returnVar_MyLib_parsed.mutations.push(5);
returnVar_MyLib = Symbol(JSON.stringify(returnVar_MyLib_parsed));`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transformation to add symbols in the return result of functions declaration and in the call that store the return type in existing variable', () => {
    const transformedCode = transform(`function doStuff(){
      let bq2 = 'l';
      return bq2;
    }
    returnVar = doStuff();`);
    const expectedResult = `function doStuff() {
  let bq2 = 'l';
  let bq2_MyLib = Symbol("{\\"mutations\\":[2]}");
  return [bq2, bq2_MyLib];
}

[returnVar, returnVar_MyLib] = doStuff();
let returnVar_MyLib_parsed = JSON.parse(returnVar_MyLib.description);
returnVar_MyLib_parsed.mutations.push(5);
returnVar_MyLib = Symbol(JSON.stringify(returnVar_MyLib_parsed));`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transform to pass argument to arrow function inside the object', () => {
    const transformedCode = transform(`const obj = {
      doStuff: aVariable => {}
    };`);

    const expectedResult = `const obj = {
  [Symbol.for("doStuff")]: "{\\"mutations\\":[1]}",
  doStuff: (aVariable, aVariable_MyLib) => {}
};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transform to pass argument to function inside the object', () => {
    const transformedCode = transform(`const obj = {
      doStuff: function aFunction(aVariable) {}
    };`);

    const expectedResult = `const obj = {
  [Symbol.for("doStuff")]: "{\\"mutations\\":[1]}",
  doStuff: function aFunction(aVariable, aVariable_MyLib) {}
};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transform to pass argument to function call inside the object', () => {
    const transformedCode = transform(`const obj = {
      doStuff: function aFunction(aVariable) {}
    };
    const myVariable = 2;
    obj.doStuff(myVariable);
`);

    const expectedResult = `const obj = {
  [Symbol.for("doStuff")]: "{\\"mutations\\":[1]}",
  doStuff: function aFunction(aVariable, aVariable_MyLib) {}
};
const myVariable = 2;
let myVariable_MyLib = Symbol("{\\"mutations\\":[4]}");
obj.doStuff(myVariable, myVariable_MyLib);`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transform to pass append symbol to function return inside the object', () => {
    const transformedCode = transform(`const obj = {
      doStuff: function aFunction() {
        const wow = 'wow'; 
        return wow;
      }
    };
`);

    const expectedResult = `const obj = {
  [Symbol.for("doStuff")]: "{\\"mutations\\":[1]}",
  doStuff: function aFunction() {
    const wow = 'wow';
    let wow_MyLib = Symbol("{\\"mutations\\":[3]}");
    return [wow, wow_MyLib];
  }
};`;
    expect(transformedCode).toEqual(expectedResult);
  });

  test('Expect transform to append symbol to function return inside the object and transform the variable that receive it', () => {
    const transformedCode = transform(`const obj = {
      doStuff: function aFunction() {
        const wow = 'wow'; 
        return wow;
      }
    };
    
    returnVar = obj.doStuff();
`);

    const expectedResult = `const obj = {
  [Symbol.for("doStuff")]: "{\\"mutations\\":[1]}",
  doStuff: function aFunction() {
    const wow = 'wow';
    let wow_MyLib = Symbol("{\\"mutations\\":[3]}");
    return [wow, wow_MyLib];
  }
};
[returnVar, returnVar_MyLib] = obj.doStuff();
let returnVar_MyLib_parsed = JSON.parse(returnVar_MyLib.description);
returnVar_MyLib_parsed.mutations.push(8);
returnVar_MyLib = Symbol(JSON.stringify(returnVar_MyLib_parsed));`;
    expect(transformedCode).toEqual(expectedResult);
  });

  describe('Expect transform to add symbol for array manipulation', () => {
    test('Expect transform to add symbol for array creation', () => {
      const transformedCode = transform(`const array = [1, 3, 4, 5];`);
      const expectedResult = `const array = [1, 3, 4, 5];
let array_MyLib = Symbol("{\\"mutations\\":[1]}");`;
      expect(transformedCode).toEqual(expectedResult);
    });

    test('Expect transform to add symbol for array push', () => {
      const transformedCode = transform(`const array = [1, 3, 4, 5];
array.push(3);`);
      const expectedResult = `const array = [1, 3, 4, 5];
let array_MyLib = Symbol("{\\"mutations\\":[1]}");
array.push(3);
let array_MyLib_parsed = JSON.parse(array_MyLib.description);
array_MyLib_parsed.mutations.push(2);
array_MyLib = Symbol(JSON.stringify(array_MyLib_parsed));`;
      expect(transformedCode).toEqual(expectedResult);
    });

  });

  describe('Expect transform to add symbol when class property change', () => {
    test('add symbol for constructor properties assignments', () => {
      const transformedCode = transform(`class Rectangle {
        constructor(height, width) {
          this.height = height;
          this.width = width;
        }
      }`);
      const expectedResult = `class Rectangle {
  constructor(height, width) {
    this.height = height;

    if (this.height_MyLib) {
      let height_MyLib_parsed = JSON.parse(height_MyLib.description);
      height_MyLib_parsed.mutations.push(3);
      this.height_MyLib = Symbol(JSON.stringify(height_MyLib_parsed));
    } else {
      this.height_MyLib = Symbol("{\\"mutations\\":[3]}");
    }

    this.width = width;

    if (this.width_MyLib) {
      let width_MyLib_parsed = JSON.parse(width_MyLib.description);
      width_MyLib_parsed.mutations.push(4);
      this.width_MyLib = Symbol(JSON.stringify(width_MyLib_parsed));
    } else {
      this.width_MyLib = Symbol("{\\"mutations\\":[4]}");
    }
  }

}`;
      expect(transformedCode).toEqual(expectedResult);
    });

    test('add symbol for method properties assignments', () => {
      const transformedCode = transform(`class Rectangle {
            constructor(height, width) {
              this.height = height;
              this.width = width;
            }

          makeSquare() {
            this.height = this.width;
          }
    }`);
      const expectedResult = `class Rectangle {
  constructor(height, width) {
    this.height = height;

    if (this.height_MyLib) {
      let height_MyLib_parsed = JSON.parse(height_MyLib.description);
      height_MyLib_parsed.mutations.push(3);
      this.height_MyLib = Symbol(JSON.stringify(height_MyLib_parsed));
    } else {
      this.height_MyLib = Symbol("{\\"mutations\\":[3]}");
    }

    this.width = width;

    if (this.width_MyLib) {
      let width_MyLib_parsed = JSON.parse(width_MyLib.description);
      width_MyLib_parsed.mutations.push(4);
      this.width_MyLib = Symbol(JSON.stringify(width_MyLib_parsed));
    } else {
      this.width_MyLib = Symbol("{\\"mutations\\":[4]}");
    }
  }

  makeSquare() {
    this.height = this.width;

    if (this.height_MyLib) {
      let height_MyLib_parsed = JSON.parse(height_MyLib.description);
      height_MyLib_parsed.mutations.push(8);
      this.height_MyLib = Symbol(JSON.stringify(height_MyLib_parsed));
    } else {
      this.height_MyLib = Symbol("{\\"mutations\\":[8]}");
    }
  }

}`;
      expect(transformedCode).toEqual(expectedResult);
    });
  });

});