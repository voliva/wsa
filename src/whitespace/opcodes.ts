export interface StackOp {
  imp: "stack";
  op:
    | {
        type: "push" | "copy" | "slide";
        value: bigint;
      }
    | {
        type: "doub" | "swap" | "pop";
      };
}
export interface ArithmeticOp {
  imp: "arithmetic";
  op: {
    type: "add" | "sub" | "mul" | "div" | "mod";
  };
}
export interface HeapOp {
  imp: "heap";
  op: { type: "store" | "retrieve" };
}
export interface FlowOp {
  imp: "flow";
  op:
    | { type: "mark" | "call" | "jmp" | "jmpz" | "jmpn"; value: string }
    | { type: "ret" | "exit" | "dbg" };
}
export interface IoOp {
  imp: "io";
  op: {
    type: "outc" | "outn" | "readc" | "readn";
  };
}

export type WhitespaceOp = StackOp | ArithmeticOp | HeapOp | FlowOp | IoOp;
