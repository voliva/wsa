import { compiledLabels } from "../wsa/wsa";
import {
  StackOp,
  ArithmeticOp,
  HeapOp,
  FlowOp,
  IoOp,
  WhitespaceOp,
} from "./opcodes";

export function parseWhitespaceProgram(program: string) {
  program = program.replaceAll(/[^ \n\t]/g, "");
  const c = (idx: number) => program.charAt(idx);

  function readUnsignedNumber(idx: number): [bigint, number] {
    let result = 0n;

    let i;
    for (i = idx; i < program.length && c(i) !== "\n"; i++) {
      result = (result << 1n) + (c(i) === " " ? 0n : 1n);
    }
    if (i == program.length) {
      throw new Error(
        `Error while reading number: program ended without terminating number`
      );
    }

    return [result, i + 1];
  }
  function readNumber(idx: number): [bigint, number] {
    const signChar = c(idx);
    if (signChar === "\n") {
      throw new Error(
        `Error while reading number: expected space or tab, got new line`
      );
    }
    const sign = signChar === " " ? 1n : -1n;

    const [result, i] = readUnsignedNumber(idx + 1);
    return [result * sign, i];
  }
  function readLabel(idx: number): [string, number] {
    const [result, i] = readUnsignedNumber(idx);
    const label = compiledLabels[Number(result)] ?? `label_${result}`;
    return [label, i];
  }
  function readStack(idx: number): [StackOp, number] {
    if (c(idx) == " ") {
      const [result, i] = readNumber(idx + 1);
      return [
        {
          imp: "stack",
          op: {
            type: "push",
            value: result,
          },
        },
        i,
      ];
    }

    const op = program.slice(idx, idx + 2);
    const opToType: Record<string, Exclude<StackOp["op"]["type"], "push">> = {
      "\t ": "copy",
      "\t\n": "slide",
      "\n ": "dup",
      "\n\t": "swap",
      "\n\n": "pop",
    };
    const type = opToType[op];
    if (!type) {
      throw new Error("Error while reading stack op. Opcode: " + readable(op));
    }

    if (type === "copy" || type === "slide") {
      const [result, i] = readNumber(idx + 2);
      return [
        {
          imp: "stack",
          op: {
            type,
            value: result,
          },
        },
        i,
      ];
    }

    return [
      {
        imp: "stack",
        op: {
          type,
        },
      },
      idx + 2,
    ];
  }
  function readArithmetic(idx: number): [ArithmeticOp, number] {
    const op = program.slice(idx, idx + 2);
    const opToType: Record<string, ArithmeticOp["op"]["type"]> = {
      "  ": "add",
      " \t": "sub",
      " \n": "mul",
      "\t ": "div",
      "\t\t": "mod",
      "\n ": "or",
      "\n\t": "not",
      "\n\n": "and",
    };
    const type = opToType[op];
    if (!type) {
      throw new Error(
        "Error while reading arithmetic op. Opcode: " + readable(op)
      );
    }
    return [
      {
        imp: "arithmetic",
        op: {
          type,
        },
      },
      idx + 2,
    ];
  }
  function readHeap(idx: number): [HeapOp, number] {
    if (c(idx) === "\n") {
      throw new Error(
        "Error while reading stack op. Expected space or tab, got linefeed"
      );
    }

    return [
      {
        imp: "heap",
        op: {
          type: c(idx) === " " ? "store" : "retrieve",
        },
      },
      idx + 1,
    ];
  }
  function readFlow(idx: number): [FlowOp, number] {
    const op = program.slice(idx, idx + 2);
    const opToType: Record<string, FlowOp["op"]["type"]> =
      {
        "  ": "mark",
        " \t": "call",
        " \n": "jmp",
        "\t ": "jmpz",
        "\t\t": "jmpn",
        "\t\n": "ret",
        "\n ": "dbg",
        "\n\n": "exit",
      };
    const type = opToType[op];
    if (!type) {
      throw new Error("Error while reading flow op. Opcode: " + readable(op));
    }

    if (type === "ret" || type === "dbg" || type === "exit") {
      return [
        {
          imp: "flow",
          op: {
            type,
          },
        },
        idx + 2,
      ];
    }

    const [result, i] = readLabel(idx + 2);
    return [
      {
        imp: "flow",
        op: {
          type,
          value: result,
        },
      },
      i,
    ];
  }
  function readIo(idx: number): [IoOp, number] {
    const op = program.slice(idx, idx + 2);
    const opToType: Record<string, IoOp["op"]["type"]> = {
      "  ": "outc",
      " \t": "outn",
      "\t ": "readc",
      "\t\t": "readn",
    };
    const type = opToType[op];
    if (!type) {
      throw new Error("Error while reading IO op. Opcode: " + readable(op));
    }
    return [
      {
        imp: "io",
        op: {
          type,
        },
      },
      idx + 2,
    ];
  }

  const result: WhitespaceOp[] = [];
  let idx = 0;

  while (idx < program.length) {
    const single = c(idx);
    const double = program.slice(idx, idx + 2);

    const error = (): never => {
      throw new Error("Unable to parse IMP: " + readable(double));
    };
    // console.log(idx, readable(single), readable(double));
    const [op, next] =
      single === " "
        ? readStack(idx + 1)
        : single === "\n"
        ? readFlow(idx + 1)
        : double === "\t "
        ? readArithmetic(idx + 2)
        : double === "\t\t"
        ? readHeap(idx + 2)
        : double === "\t\n"
        ? readIo(idx + 2)
        : error();
    result.push(op);
    idx = next;
  }

  return result;
}

function readable(code: string) {
  return code
    .replaceAll(" ", "S ")
    .replaceAll("\t", "T\t")
    .replaceAll("\n", "N\n");
}
