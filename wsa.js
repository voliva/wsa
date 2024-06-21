import readline from "readline";

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

function pushIfDefined(value) {
  if (value !== "" && value != undefined) {
    return push(value);
  }
  return "";
}
function add(value) {
  return pushIfDefined(value) + "\t   ";
}
function sub(value) {
  return pushIfDefined(value) + "\t  \t";
}
function mul(value) {
  return pushIfDefined(value) + "\t  \n";
}
function div(value) {
  return pushIfDefined(value) + "\t \t ";
}
function mod(value) {
  return pushIfDefined(value) + "\t \t\t";
}

function pushAddress(addr) {
  if (
    typeof addr == "string" &&
    (addr.startsWith("+") || addr.startsWith("-"))
  ) {
    return retrive(0) + add(Number(addr));
  } else {
    return pushIfDefined(addr);
  }
}

function store(value) {
  let result = "";
  if (value) {
    result += pushAddress(value);
    result += swap();
  }
  return result + "\t\t ";
}
function retrive(value) {
  return pushAddress(value) + "\t\t\t";
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

async function include(filename, getIncludedStream) {
  const content = await (() => {
    if (filename == "io") {
      // TODO relative to wsa.mjs
      return compile(getIncludedStream("./lib/io.wsa"), getIncludedStream);
    }
    return "TODO";
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

export function compile(inputStream, getIncludedStream) {
  const file = readline.createInterface({
    input: inputStream,
  });

  let results = [];

  let lineNum = 0;
  file.on("line", (line) => {
    lineNum++;
    line = line.trim();
    if (line.startsWith(";") || line.length == 0) {
      return;
    }
    let [opcode, ...args] = line.split(" ");
    opcode = opcode.toLocaleLowerCase();
    args = args.join(" ");

    try {
      if (opcode == "include") {
        results.push(include(args, getIncludedStream));
      } else {
        results.push(
          opcodes[opcode](args) ?? Promise.resolve(`{${opcode} ${args}}`)
        );
      }
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

export async function compileAndExit(inputStream, getIncludedStream) {
  return (await compile(inputStream, getIncludedStream)) + exit();
}
