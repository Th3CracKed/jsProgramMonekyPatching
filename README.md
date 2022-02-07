# Js monkeyPatching README

The idea of the project is to track the mutation location of variables by adding instrumentation at compile time without changing the semantic of the program. 

`let a = 2;`

is transformed to 

`let a = 2;
let a_MyLib = Symbol("{\\"mutations\\":[1]}");`

The new generated program contains a symbol with an array of mutation position.

Symbol are particallarly usefull for js objects since they can be hidden and therefore doesn't impact the program semantically
