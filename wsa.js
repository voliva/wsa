#!/usr/bin/env node

import readline from "readline";
import fs from "fs";

function parseFile(filename) {
  const file = readline.createInterface({
    input: fs.createReadStream(filename),
  });

  let results = [];

  let lineNum = 0;
  file.on("line", (line) => {
    lineNum++;
    line = line.trim();
    if (line.startsWith(";") || line.length == 0) {
      return;
    }
    const [opcode, ...args] = line.split(" ");

    try {
      results.push(
        opcodes[opcode.toLocaleLowerCase()](args.join(" ")) ??
          Promise.resolve(`{${opcode} ${args.join(" ")}}`)
      );
    } catch (ex) {
      console.error(ex);
      console.error(`failed at line ${lineNum}: "${line}"`);
      process.exit(-1);
    }
  });

  return new Promise((resolve) => {
    file.on("close", () =>
      Promise.all(results).then((r) => resolve(r.join("")))
    );
  });
}

const opcodes = {
  push,
  pushs,
  pop,
  label,
  doub,
  swap,
  add,
  sub,
  mul,
  div,
  mod,
  store,
  retrive,
  call,
  jump,
  jumpz,
  jumpn,
  jumpp,
  jumpnz,
  jumppz,
  jumppn,
  jumpnp: jumppn,
  include,
  ret,
  exit,
  outn,
  outc,
  inn,
  inc,
  test,
  valuestring,
  valueinteger,
};

const valueMap = {};
const resolveValue = (value) => {
  if (value in valueMap) {
    return valueMap[value];
  }
  if (
    String(value).length === 3 &&
    String(value).startsWith("'") &&
    value.endsWith("'")
  ) {
    return value.charCodeAt(1);
  }
  return value;
};

const labelMap = {};
let labelIdx = 0;
function numToStr(num) {
  return num
    .toString(2)
    .split("")
    .map((v) => (v == "0" ? " " : "\t"))
    .join("");
}
function getTranslatedLabel(label) {
  if (!(label in labelMap)) {
    labelMap[label] = labelIdx++;
  }
  return numToStr(labelMap[label]) + "\n";
}

let internalLabel = 0;
function getInternalLabel() {
  return `__internal_label_` + internalLabel++;
}

function number(num) {
  num = Number(num);
  const sign = Number(num) >= 0 ? " " : "\t";
  num = Math.abs(num);
  return sign + numToStr(num) + "\n";
}

function push(value) {
  return "  " + number(resolveValue(value));
}
function pushs(arg) {
  return (
    push(0) +
    resolveValue(arg)
      .split("")
      .map((v) => push(v.charCodeAt(0)))
      .reverse()
      .join("")
  );
}
function pop() {
  return ` \n\n`;
}
function label(label) {
  return `\n  ${getTranslatedLabel(label)}`;
}
function doub() {
  return ` \n `;
}
function swap() {
  return " \n\t";
}
function add(value) {
  return (value ? push(value) : "") + "\t   ";
}
function sub(value) {
  return (value ? push(value) : "") + "\t  \t";
}
function mul(value) {
  return (value ? push(value) : "") + "\t  \n";
}
function div(value) {
  return (value ? push(value) : "") + "\t \t ";
}
function mod(value) {
  return (value ? push(value) : "") + "\t \t\t";
}
function store(value) {
  return (value ? push(value) : "") + "\t\t ";
}
function retrive(value) {
  return (value ? push(value) : "") + "\t\t\t";
}
function call(label) {
  return `\n \t${getTranslatedLabel(label)}`;
}
function jump(label) {
  return `\n \n${getTranslatedLabel(label)}`;
}
function jumpz(label) {
  return `\n\t ${getTranslatedLabel(label)}`;
}
function jumpn(label) {
  return `\n\t\t${getTranslatedLabel(label)}`;
}
function jumpp(label) {
  return [push(0), swap(), sub(), jumpn(label)].join("");
}
function jumpnz(jmpLabel) {
  const s1 = getInternalLabel();
  return [jumpp(s1), jump(jmpLabel), label(s1)].join("");
}
function jumppz(jmpLabel) {
  const s1 = getInternalLabel();
  return [jumpn(s1), jump(jmpLabel), label(s1)].join("");
}
function jumppn(jmpLabel) {
  const s1 = getInternalLabel();
  return [jumpz(s1), jump(jmpLabel), label(s1)].join("");
}

async function include(filename) {
  const content = await (() => {
    if (filename == "io") {
      // TODO relative to wsa.mjs
      return parseFile("./lib/io.wsa");
    }
  })();
  const includeLabel = getInternalLabel();

  return [jump(includeLabel), content, label(includeLabel)].join("");
}
function ret() {
  return `\n\t\n`;
}
function exit() {
  return `\n\n\n`;
}
function outn() {
  return "\t\n \t";
}
function outc() {
  return "\t\n  ";
}
function inn() {
  return "\t\n\t\t";
}
function inc() {
  return "\t\n\t ";
}
function test(value) {
  return [doub(), sub(value)].join("");
}
function valuestring(args) {
  const [name, ...rest] = args.split(" ");
  if (!name.startsWith("_")) {
    throw new Error(`${name} doesn't start with _`);
  }

  const value = rest.join(" ");
  valueMap[name] = value;
  return "";
}
function valueinteger() {
  const [name, ...rest] = args.split(" ");
  if (!name.startsWith("_")) {
    throw new Error(`${name} doesn't start with _`);
  }

  const value = Number(rest.join(" "));
  valueMap[name] = value;
  return "";
}

if (!process.argv[2]) {
  console.log("needs file argument");
  process.exit(1);
}

const withAnnotations = false;
parseFile(process.argv[2]).then((res) => {
  const withExit = `${res}${exit()}`;
  if (withAnnotations) {
    process.stdout.write(
      withExit
        .replaceAll("\n", "L\n")
        .replaceAll("\t", "T\t")
        .replaceAll(" ", "S ")
    );
  } else {
    process.stdout.write(withExit);
  }
});
