export type Token =
  | WordToken
  | IntegerToken
  | StringToken
  | CharToken
  | VariableToken
  | DecorationToken;
type WordToken = { type: "word"; value: string };
type IntegerToken = { type: "integer"; value: bigint };
type StringToken = { type: "string"; value: string };
type CharToken = { type: "char"; value: bigint };
type VariableToken = { type: "variable"; value: string };
type DecorationToken = { type: "decoration"; value: string };

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let match;
  while (line) {
    line = line.replace(/^\s+/, "");
    if (!line) {
      break;
    }
    if (line.startsWith(";#;")) {
      tokens.push({
        type: "decoration",
        value: line.replace(/^;#; ?/, ""),
      });
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
          value: BigInt(match[1].replaceAll("_", "")),
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
