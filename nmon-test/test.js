#!/usr/bin/env node --harmony --es_staging
"use strict";
let assert = require('assert');
if (process.argv.indexOf('-h') !== -1) {
  console.log('usage: ' + (process.env._ || process.argv[1]) + ' -h | [<iterations>]');
  process.exit(2);
}
let iterations = parseInt(process.argv[2]);
if (isNaN(iterations) || iterations < 1) { iterations = 1000000; }
function time(f) {
  console.time(f.name);
  for (let i = iterations; i--;) { f(); }
  console.timeEnd(f.name);
}
// -----------------------------------------------------------------------------------------------

let Foo0 = { a: 1, b: 2, c: 3, d: 4 };

function Foo1() {}
for (let k of Object.keys(Foo0)) {
  Foo1.prototype[k] = Foo0[k];
}

function Foo2(a, b, c, d) {
  if (a !== undefined) { this.a = a; }
  if (b !== undefined) { this.b = b; }
  if (c !== undefined) { this.c = c; }
  if (d !== undefined) { this.d = d; }
}
for (let k of Object.keys(Foo0)) {
  Foo2.prototype[k] = Foo0[k];
}

function Foo2b(a, b, c, d) {
  this.a = a;
  this.b = b;
  this.c = c;
  this.d = d;
}

function Foo3(props) {
  for (var k in props) { this[k] = props[k] }
}
for (let k of Object.keys(Foo0)) {
  Foo3.prototype[k] = Foo0[k];
}

function assertobj(o) {
  assert(o.a === 10);
  assert(o.b === 20);
  assert(o.c === 3);
  assert(o.d === 40);
}

function new_cons() {
  let o = new Foo2(10, 20, undefined, 40);
  assertobj(o);
}

function new_cons2() {
  let o = new Foo2b(10, 20, 3, 40);
  assertobj(o);
}

function new_cons_props() {
  let o = new Foo3({a:10, b:20, d:40});
  assertobj(o);
}

function new_setprop() {
  let o = new Foo1;
  o.a = 10;
  o.b = 20;
  o.d = 40;
  assertobj(o);
}

function objlit() {
  let o = {a:10, b:20, c:Foo0.c, d:40};
  assertobj(o);
}

function objlit_proto() {
  let o = {__proto__:Foo0, a:10, b:20, d:40}; // Note: Prevents function opt in v8 (node v3.1.0)
  assertobj(o);
}

function objlit_proto2() {
  let o = {a:10, b:20, d:40}; o.__proto__ = Foo0;
  assertobj(o);
}

function object_create() {
  let o = Object.create(Foo0, {
    a:{value:10, enumerable:true},
    b:{value:20, enumerable:true},
    d:{value:40, enumerable:true},
  });
  assertobj(o);
}

time(new_cons);
time(new_cons2);
time(new_cons_props);
time(new_setprop);
time(objlit);
time(objlit_proto);
time(objlit_proto2);
time(object_create);
