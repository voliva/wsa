import lib_io from "./lib/io.wsa?raw" with { type: "text" };
import lib_memory from "./lib/memory.wsa?raw" with { type: "text" };
import lib_bitwise from "./lib/bitwise.wsa?raw" with { type: "text" };
import lib_bitwise_extensions from "./lib/bitwise.extensions.wsa?raw" with { type: "text" };
import lib_math from "./lib/math.wsa?raw" with { type: "text" };

type Opcode =
  | { params: "none"; constr: () => string }
  | { params: "integer"; constr: (x: bigint) => string }
  | { params: "integer?"; constr: (x?: bigint) => string }
  | { params: "index"; constr: (x: bigint) => string }
  | { params: "string"; constr: (x: string) => string }
  | { params: "label"; constr: (x: number) => string }
  | { params: "variable,integer"; constr: (x: string, y: bigint) => string }
  | { params: "variable,string"; constr: (x: string, y: string) => string };

const opcodes: { [key: string]: Opcode } = {
  push: { constr: push, params: "integer" },
  dup: { constr: dup, params: "none" },
  swap: { constr: swap, params: "none" },
  pop: { constr: pop, params: "none" },
  copy: { constr: copy, params: "index" },
  slide: { constr: slide, params: "index" },
  label: { constr: label, params: "label" },
  add: { constr: add, params: "integer?" },
  sub: { constr: sub, params: "integer?" },
  mul: { constr: mul, params: "integer?" },
  div: { constr: div, params: "integer?" },
  mod: { constr: mod, params: "integer?" },
  and: { constr: and, params: "integer?" },
  or: { constr: or, params: "integer?" },
  not: { constr: not, params: "none" },
  store: { constr: store, params: "integer?" },
  storestr: { constr: storestr, params: "string" },
  retrieve: { constr: retrieve, params: "integer?" },
  call: { constr: call, params: "label" },
  jump: { constr: jump, params: "label" },
  jumpz: { constr: jumpz, params: "label" },
  jumpn: { constr: jumpn, params: "label" },
  jumpp: { constr: jumpp, params: "label" },
  jumpnz: { constr: jumpnz, params: "label" },
  jumppz: { constr: jumppz, params: "label" },
  jumppn: { constr: jumppn, params: "label" },
  jumpnp: { constr: jumppn, params: "label" },
  ret: { constr: ret, params: "none" },
  exit: { constr: exit, params: "none" },
  outn: { constr: outn, params: "none" },
  outc: { constr: outc, params: "none" },
  readn: { constr: readn, params: "none" },
  readc: { constr: readc, params: "none" },
  valuestring: { constr: valuestring, params: "variable,string" },
  valueinteger: { constr: valueinteger, params: "variable,integer" },
  debugger: { constr: _debugger, params: "none" },
};

export type LineStream = (onLine: (line: string | null) => void) => () => void;
export const stringToLineStream =
  (str: string): LineStream =>
  (onLine) => {
    let stopped = false;

    setTimeout(() => {
      const lines = str.split("\n");
      for (let i = 0; i < lines.length && !stopped; i++) {
        onLine(lines[i]);
      }
      onLine(null);
    });

    return () => {
      stopped = true;
    };
  };

const valueMap: Record<string, string | bigint> = {};

const labelMap: Record<string, number> = {};
export const compiledLabels: string[] = [];
let labelIdx = 0;
function numToStr(num: bigint | number) {
  return (
    num
      .toString(2)
      .split("")
      .map((v) => (v == "0" ? " " : "\t"))
      .join("") + "\n"
  );
}
function getTranslatedLabel(labelID: number) {
  return numToStr(labelID);
}
function getLabel(label: string) {
  if (!(label in labelMap)) {
    labelMap[label] = labelIdx++;
    compiledLabels.push(label);
  }
  return labelMap[label];
}

let internalLabel = 0;
function getInternalLabel() {
  compiledLabels.push(`__internal_label_` + internalLabel++);
  return labelIdx++;
}

function number(num: bigint) {
  const sign = num >= 0n ? " " : "\t";
  num = num < 0n ? -num : num;
  return sign + numToStr(num);
}

function push(value: bigint) {
  return "  " + number(value);
}
function pop() {
  return ` \n\n`;
}
function dup() {
  return ` \n `;
}
function swap() {
  return " \n\t";
}
function copy(value: bigint) {
  return " \t " + number(value);
}
function slide(value: bigint) {
  return " \t\n" + number(value);
}
function label(label: number) {
  return `\n  ${getTranslatedLabel(label)}`;
}

function pushIfDefined(value?: bigint) {
  if (value != undefined) {
    return push(value);
  }
  return "";
}
function add(value?: bigint) {
  if (value === 0n) {
    return "";
  }
  return pushIfDefined(value) + "\t   ";
}
function sub(value?: bigint) {
  if (value == 0n) {
    return "";
  }
  return pushIfDefined(value) + "\t  \t";
}
function mul(value?: bigint) {
  if (value == 1n) {
    return "";
  }
  return pushIfDefined(value) + "\t  \n";
}
function div(value?: bigint) {
  if (value == 1n) {
    return "";
  }
  return pushIfDefined(value) + "\t \t ";
}
function mod(value?: bigint) {
  return pushIfDefined(value) + "\t \t\t";
}
function and(value?: bigint) {
  if (!debugExtensions) {
    throw new Error("Can't use `and`: Extensions not enabled");
  }
  return pushIfDefined(value) + `\t \n\n`;
}
function or(value?: bigint) {
  if (!debugExtensions) {
    throw new Error("Can't use `or`: Extensions not enabled");
  }
  return pushIfDefined(value) + `\t \n `;
}
function not() {
  if (!debugExtensions) {
    throw new Error("Can't use `not`: Extensions not enabled");
  }
  return `\t \n\t`;
}

function store(value?: bigint) {
  let result = "";
  if (value != undefined) {
    result += push(value);
    result += swap();
  }
  return result + "\t\t ";
}
function storestr(value: string) {
  return (
    (value + "\0")
      .split("")
      .map((v) => dup() + push(BigInt(v.charCodeAt(0))) + store() + add(1n))
      .join("") + pop()
  );
}
function retrieve(value?: bigint) {
  return pushIfDefined(value) + "\t\t\t";
}
function call(label: number) {
  return `\n \t${getTranslatedLabel(label)}`;
}
function jump(label: number) {
  return `\n \n${getTranslatedLabel(label)}`;
}
function jumpz(label: number) {
  return `\n\t ${getTranslatedLabel(label)}`;
}
function jumpn(label: number) {
  return `\n\t\t${getTranslatedLabel(label)}`;
}
function jumpp(label: number) {
  return [push(0n), swap(), sub(), jumpn(label)].join("");
}
function jumpnz(jmpLabel: number) {
  return [sub(1n), jumpn(jmpLabel)].join("");
}
function jumppz(jmpLabel: number) {
  const s1 = getInternalLabel();
  return [jumpn(s1), jump(jmpLabel), label(s1)].join("");
}
function jumppn(jmpLabel: number) {
  const s1 = getInternalLabel();
  return [jumpz(s1), jump(jmpLabel), label(s1)].join("");
}

const includedFiles = new Set<string>();
async function include(
  filename: string,
  getIncludedStream: (filename: string) => LineStream
) {
  if (includedFiles.has(filename)) return "";
  includedFiles.add(filename);

  if (filename === "io") {
    return compile(stringToLineStream(lib_io), getIncludedStream);
  }
  if (filename === "memory") {
    return compile(stringToLineStream(lib_memory), getIncludedStream);
  }
  if (filename === "bitwise") {
    return compile(
      stringToLineStream(
        debugExtensions ? lib_bitwise_extensions : lib_bitwise
      ),
      getIncludedStream
    );
  }
  if (filename === "math") {
    return compile(stringToLineStream(lib_math), getIncludedStream);
  }
  return compile(getIncludedStream(filename), getIncludedStream);
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
function readn() {
  return "\t\n\t\t";
}
function readc() {
  return "\t\n\t ";
}
function valuestring(name: string, value: string) {
  valueMap[name] = value;
  return "";
}
function valueinteger(name: string, value: bigint) {
  valueMap[name] = value;
  return "";
}

let debugExtensions = false;
export function enableDebugExtensions() {
  debugExtensions = true;
}
function _debugger() {
  return debugExtensions ? "\n\n " : "";
}

type Token = WordToken | IntegerToken | StringToken | CharToken | VariableToken | DecorationToken;
type WordToken = { type: "word"; value: string };
type IntegerToken = { type: "integer"; value: bigint };
type StringToken = { type: "string"; value: string };
type CharToken = { type: "char"; value: bigint };
type VariableToken = { type: "variable"; value: string };
type DecorationToken = { type: "decoration", value: string };

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let match;
  while (line) {
    line = line.replace(/^\s+/, "");
    if (!line) {
      break;
    }
    if (line.startsWith(";#;")) {
      tokens.push({
        type: 'decoration',
        value: line.replace(/^;#; ?/, "")
      })
      break;
    } else if (line.startsWith(";")) {
      break;
    }
    if (line.startsWith('"')) {
      if (!(match = line.match(/^"((?:[^"\\\n]|\\.)*)"/))) {
        throw "unterminated string";
      }
      const value = unescape(match[1], '"').join("");
      tokens.push({ type: "string", value } as StringToken);
    } else if (line.startsWith("'")) {
      if (!(match = line.match(/^'((?:[^'\\\n]|\\.)*)'/))) {
        throw "unterminated char";
      }
      const char = unescape(match[1], "'");
      if (char.length === 0) {
        throw "empty char";
      } else if (char.length != 1) {
        throw "more than one char";
      }
      const value = BigInt(char[0].codePointAt(0)!);
      tokens.push({ type: "char", value } as CharToken);
    } else if (line.startsWith("_")) {
      if (!(match = line.match(/^(_[^\s;"']+)/))) {
        throw "empty variable name";
      }
      tokens.push({ type: "variable", value: match[1] } as VariableToken);
    } else {
      match = line.match(/^([^\s;"']+)/)!;
      try {
        tokens.push({
          type: "integer",
          value: BigInt(match[1]),
        } as IntegerToken);
      } catch (ex) {
        tokens.push({ type: "word", value: match[1] } as WordToken);
      }
    }
    line = line.slice(match[0].length);
  }
  return tokens;
}

function unescape(stringLiteral: string, quote: string) {
  const chars = [...stringLiteral];
  const unescaped = [];
  let i = 0;
  while (i < chars.length) {
    let char;
    if (chars[i] == "\\") {
      switch (chars[i + 1]) {
        case quote:
        case "\\":
          char = chars[i + 1];
          break;
        case "b":
          char = "\b";
          break;
        case "f":
          char = "\f";
          break;
        case "n":
          char = "\n";
          break;
        case "r":
          char = "\r";
          break;
        case "t":
          char = "\t";
          break;
        case "v":
          char = "\v";
          break;
        default:
          throw "invalid escape";
      }
      i++;
    } else {
      char = chars[i];
    }
    unescaped.push(char);
    i++;
  }
  return unescaped;
}

function parseArgs(opcode: string, args: Token[]): string {
  if (!(opcode in opcodes)) {
    throw new Error(`invalid opcode ${opcode}`);
  }
  const op = opcodes[opcode];
  let arg;
  switch (op.params) {
    case "none":
      if (args.length !== 0) {
        throw `expected no arguments, but got ${formatArgTypes(args)}`;
      }
      return op.constr();
    case "integer":
      if (args.length === 1 && (arg = resolveInteger(args[0])) != undefined) {
        return op.constr(arg);
      }
      throw `expected an integer argument, but got ${formatArgTypes(args)}`;
    case "integer?":
      if (args.length === 0) {
        return op.constr();
      } else if (
        args.length === 1 &&
        (arg = resolveInteger(args[0])) != undefined
      ) {
        return op.constr(arg);
      }
      throw `expected an optional integer argument, but got ${formatArgTypes(
        args
      )}`;
    case "index":
      if (args.length === 1 && (arg = resolveIndex(args[0])) != undefined) {
        return op.constr(arg);
      }
      throw `expected an index argument, but got ${formatArgTypes(args)}`;
    case "string":
      if (args.length === 1 && (arg = resolveString(args[0])) != undefined) {
        return op.constr(arg);
      }
      throw `expected a string argument, but got ${formatArgTypes(args)}`;
    case "label":
      if (
        args.length === 1 &&
        (args[0].type === "word" || args[0].type === "variable")
      ) {
        return op.constr(getLabel(args[0].value));
      }
      throw `expected a label argument, but got ${formatArgTypes(args)}`;
    case "variable,integer":
      if (
        args.length === 2 &&
        args[0].type === "variable" &&
        (arg = resolveInteger(args[1])) != undefined
      ) {
        return op.constr(args[0].value, arg);
      }
      throw `expected variable and integer arguments, but got ${formatArgTypes(
        args
      )}`;
    case "variable,string":
      if (
        args.length === 2 &&
        args[0].type === "variable" &&
        (arg = resolveString(args[1])) != undefined
      ) {
        return op.constr(args[0].value, arg);
      }
      throw `expected variable and string arguments, but got ${formatArgTypes(
        args
      )}`;
  }
}

function resolveInteger(arg: Token): bigint | undefined {
  if (arg.type === "integer" || arg.type === "char") {
    return arg.value;
  }
  if (arg.type === "variable") {
    const name = arg.value;
    if (!(name in valueMap)) {
      throw `variable ${name} not defined`;
    }
    if (typeof valueMap[name] !== "bigint") {
      throw `expected an integer, but variable ${name} is a string`;
    }
    return valueMap[name];
  }
  return undefined;
}
function resolveString(arg: Token): string | undefined {
  if (arg.type === "string" || arg.type === "word") {
    return arg.value;
  }
  if (arg.type === "variable") {
    const name = arg.value;
    if (!(name in valueMap)) {
      throw `variable ${name} not defined`;
    }
    if (typeof valueMap[name] !== "string") {
      throw `expected a string, but variable ${name} is an integer`;
    }
    return valueMap[name];
  }
  return undefined;
}
function resolveIndex(arg: Token): bigint | undefined {
  if (arg.type === "char") {
    return undefined;
  }
  return resolveInteger(arg);
}

function formatArgTypes(args: Token[]): string {
  const types = args.map((arg) => arg.type as string);
  if (types.length === 2) {
    return types.join(" and ");
  }
  if (types.length >= 3) {
    types[types.length - 1] = "and " + types[types.length - 1];
  }
  return types.join(", ");
}

export async function compile(
  inputStream: LineStream,
  getIncludedStream: (filename: string) => LineStream
) {
  const results: (Promise<string> | string)[] = [];

  let lineNum = 0;
  let onEnd: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    onEnd = resolve;
  });

  let prevInclude: Promise<string> = Promise.resolve("");
  const decorationLines: string[] = [];
  inputStream((line) => {
    if (line == null) {
      onEnd();
      return;
    }

    lineNum++;
    try {
      const tokens = tokenizeLine(line);
      if (tokens.length === 0) {
        return;
      }
      if (tokens[0].type === 'decoration') {
        decorationLines.push(tokens[0].value);
        return;
      }
      if (tokens[0].type !== "word") {
        throw `expected opcode, but got ${tokens[0].type}`;
      }
      const opcode = tokens[0].value.toLowerCase();
      const args = tokens.slice(1);
      if (opcode == "include") {
        if (
          args.length !== 1 ||
          !(
            args[0].type === "word" ||
            args[0].type === "string" ||
            args[0].type === "variable"
          )
        ) {
          throw `expected filename argument, but got ${formatArgTypes(args)}`;
        }
        const filename = args[0].value;
        prevInclude = prevInclude.then(() =>
          include(filename, getIncludedStream)
        );
        results.push(prevInclude);
      } else {
        results.push(prevInclude.then(() => parseArgs(opcode, args)));
      }
    } catch (ex) {
      console.error(ex);
      if (typeof ex === "string") {
        throw new Error(`${ex} at line ${lineNum}: \`${line}\``);
      }
      throw new Error(`failed at line ${lineNum}: \`${line}\``);
    }
  });

  await ended;
  const r = await Promise.all(results);
  const joined = r.join("");

  if (decorationLines.length) {
    const split = joined.split("\n");

    decorationLines.forEach((d, i) => {
      if (split.length <= i) return;
      split[i] = d
        .replaceAll("\t", "  ")
        .replaceAll(" ", "\u00A0")
        .replaceAll("\n", "") + split[i];
    })

    return split.join("\n");
  }

  return joined;
}

export async function compileAndExit(
  inputStream: LineStream,
  getIncludedStream: (filename: string) => LineStream
) {
  return (await compile(inputStream, getIncludedStream)) + exit();
}
