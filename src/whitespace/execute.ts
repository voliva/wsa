import { IO } from "./io";
import {
  ArithmeticOp,
  FlowOp,
  HeapOp,
  IoOp,
  StackOp,
  WhitespaceOp,
} from "./opcodes";

export interface MachineState {
  stack: bigint[];
  heap: bigint[];
  callStack: number[];
  pc: number;
  halted: boolean;
  paused: boolean;
  steps_taken: number;
}

export interface Program {
  instructions: WhitespaceOp[];
  labels: Record<string, number>;
  breakpoints: Set<number>;
}

export function loadProgram(instructions: WhitespaceOp[]): Program {
  const labels: Record<string, number> = {};
  const breakpoints = new Set<number>();
  instructions.forEach((instr, idx) => {
    if (instr.imp === "flow") {
      if (instr.op.type === "mark") {
        labels[instr.op.value] = idx + 1;
      } else if (instr.op.type === "dbg") {
        breakpoints.add(idx);
      }
    }
  });

  return {
    instructions,
    labels,
    breakpoints,
  };
}

export function initializeState(): MachineState {
  return {
    stack: [],
    heap: [],
    callStack: [],
    pc: 0,
    halted: false,
    paused: true,
    steps_taken: 0,
  };
}

export function step(
  program: Program,
  state: MachineState,
  io: IO
): MachineState | Promise<MachineState> {
  const instruction = program.instructions[state.pc];
  const result = state;
  result.steps_taken++;

  const resultPromise = (() => {
    switch (instruction.imp) {
      case "arithmetic":
        return stepArithmetic(result, instruction);
      case "flow":
        return stepFlow(result, instruction, program.labels);
      case "heap":
        return stepHeap(result, instruction);
      case "io":
        return stepIo(result, instruction, io);
      case "stack":
        return stepStack(result, instruction);
    }
  })();

  const finalize = () => {
    if (program.breakpoints.has(result.pc)) {
      result.paused = true;
    }

    return result;
  };

  if (resultPromise instanceof Promise) {
    return resultPromise.then(finalize);
  }
  return finalize();
}

export async function execute(program: Program, io: IO): Promise<MachineState> {
  let state = initializeState();
  while (!state.halted) {
    const stepResult = step(program, state, io);
    state = stepResult instanceof Promise ? await stepResult : stepResult;
  }
  return state;
}

export async function runUntilPause(
  program: Program,
  state: MachineState,
  io: IO
): Promise<MachineState> {
  state.paused = false;
  while (!state.halted && !state.paused) {
    const stepResult = step(program, state, io);
    state = stepResult instanceof Promise ? await stepResult : stepResult;
  }
  return state;
}

const isRet = (program: Program, state: MachineState) => {
  const instruction = program.instructions[state.pc];
  return instruction.imp === "flow" && instruction.op.type === "ret";
};
const isCall = (program: Program, state: MachineState) => {
  const instruction = program.instructions[state.pc];
  return instruction.imp === "flow" && instruction.op.type === "call";
};

export async function stepOut(
  program: Program,
  state: MachineState,
  io: IO
): Promise<MachineState> {
  let calls = 1;
  state.paused = false;
  while (!state.halted && !state.paused && calls > 0) {
    if (isCall(program, state)) {
      calls++;
    } else if (isRet(program, state)) {
      calls--;
    }
    const stepResult = step(program, state, io);
    state = stepResult instanceof Promise ? await stepResult : stepResult;
  }
  return state;
}

export async function stepOver(program: Program, state: MachineState, io: IO) {
  if (isCall(program, state)) {
    state = await step(program, state, io);
    return stepOut(program, state, io);
  }
  return step(program, state, io);
}

function stepArithmetic(
  state: MachineState,
  instruction: ArithmeticOp
): MachineState {
  if (state.stack.length < 2) {
    throw new Error(
      `Arithmetic op ${state.pc} failed: needs at least 2 values in the stack`
    );
  }

  const result =
    instruction.op.type === "not"
      ? ~state.stack.pop()!
      : (() => {
          const b = state.stack.pop()!;
          const a = state.stack.pop()!;

          switch (instruction.op.type) {
            case "add":
              return a + b;
            case "div": {
              if (b === 0n) {
                throw new Error("Division by zero");
              }
              const result = a / b;
              // In the original, the negative result is rounded down (towards more negative)
              if (((a < 0 && b > 0) || (a > 0 && b < 0)) && a % b !== 0n) {
                return result - 1n;
              }
              return result;
            }
            case "mod": {
              if (b === 0n) {
                throw new Error("Mod by zero");
              }
              const result = a % b;

              // The original implementation with haskell always gives back a number with the same symbol as b.
              return result < 0 && b > 0
                ? result + b
                : result > 0 && b < 0
                ? result - b
                : result;
            }
            case "mul":
              return a * b;
            case "sub":
              return a - b;
            case "and":
              return a & b;
            case "or":
              return a | b;
          }
        })();

  state.stack.push(result);

  state.pc++;
  return state;
}

function stepFlow(
  state: MachineState,
  instruction: FlowOp,
  labels: Record<string, number>
): MachineState {
  if ("value" in instruction.op && !(instruction.op.value in labels)) {
    throw new Error(
      `Flow op ${state.pc} failed: label "${instruction.op.value}" not found`
    );
  }

  switch (instruction.op.type) {
    case "call":
      state.callStack.push(state.pc + 1);
      state.pc = labels[instruction.op.value];
      break;
    case "dbg":
      state.pc++;
      break;
    case "exit":
      state.halted = true;
      break;
    case "jmp":
      state.pc = labels[instruction.op.value];
      break;
    case "jmpn":
    case "jmpz": {
      if (state.stack.length < 1) {
        throw new Error(
          `Flow op ${state.pc} failed: conditional jump needs one value in the stack`
        );
      }
      const value = state.stack.pop()!;
      const passes =
        (instruction.op.type === "jmpn" && value < 0n) ||
        (instruction.op.type === "jmpz" && value === 0n);
      state.pc = passes ? labels[instruction.op.value] : state.pc + 1;
      break;
    }
    case "mark":
      state.pc++;
      break;
    case "ret":
      if (state.callStack.length < 1) {
        throw new Error(`Flow op ${state.pc} failed: can't ret without a call`);
      }
      state.pc = state.callStack.pop()!;
      break;
  }
  return state;
}

function stepHeap(state: MachineState, instruction: HeapOp): MachineState {
  if (instruction.op.type === "retrieve") {
    if (state.stack.length < 1) {
      throw new Error(
        `Heap op ${state.pc} failed: retrieve needs the address in the stack`
      );
    }
    const addr = state.stack.pop()!;
    if (addr > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        `Heap op ${state.pc} failed: Heap not large enough. addr = ${addr}`
      );
    }
    if (addr < 0n) {
      throw new Error(
        `Heap op ${state.pc} failed: Can't access a negative address. addr = ${addr}`
      );
    }
    const value = state.heap[Number(addr)];
    if (value === undefined) {
      throw new Error(
        `Heap op ${state.pc} failed: Access to uninitialized heap address ${addr}`
      );
    }
    state.stack.push(value);
  } else {
    if (state.stack.length < 2) {
      throw new Error(
        `Heap op ${state.pc} failed: store needs the address and the value in the stack`
      );
    }
    const value = state.stack.pop()!;
    const addr = state.stack.pop()!;
    if (addr > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(
        `Heap op ${state.pc} failed: Heap not large enough. addr = ${addr}`
      );
    }
    if (addr < 0n) {
      throw new Error(
        `Heap op ${state.pc} failed: Can't store on a negative address. addr = ${addr}`
      );
    }
    state.heap[Number(addr)] = value;
  }

  state.pc++;
  return state;
}

function stepStack(state: MachineState, instruction: StackOp): MachineState {
  switch (instruction.op.type) {
    case "copy": {
      const pos = state.stack.length - 1 - Number(instruction.op.value);
      if (pos < 0) {
        throw new Error(`Stack op ${state.pc} failed: Stack underflow`);
      }
      state.stack.push(state.stack[pos]);
      break;
    }
    case "dup":
      if (state.stack.length === 0) {
        throw new Error(
          `Stack op ${state.pc} failed: Can't duplicate on empty stack`
        );
      }
      state.stack.push(state.stack[state.stack.length - 1]);
      break;
    case "pop":
      if (state.stack.length === 0) {
        throw new Error(
          `Stack op ${state.pc} failed: Can't pop on empty stack`
        );
      }
      state.stack.pop();
      break;
    case "push":
      state.stack.push(instruction.op.value);
      break;
    case "slide": {
      const start = state.stack.length - 1 - Number(instruction.op.value);
      if (start < 0) {
        throw new Error(
          `Stack op ${state.pc} failed: Not enough elements to slide`
        );
      }
      state.stack.splice(start, Number(instruction.op.value));
      break;
    }
    case "swap": {
      if (state.stack.length < 2) {
        throw new Error(`Stack op ${state.pc} failed: Swap needs 2 elements`);
      }
      const a = state.stack.pop()!;
      const b = state.stack.pop()!;
      state.stack.push(a);
      state.stack.push(b);
      break;
    }
  }

  state.pc++;
  return state;
}

async function stepIo(
  state: MachineState,
  instruction: IoOp,
  io: IO
): Promise<MachineState> {
  if (state.stack.length === 0) {
    throw new Error(`IO op ${state.pc} failed: IO needs a value in the stack`);
  }

  switch (instruction.op.type) {
    case "outc":
      io.output.char(String.fromCharCode(Number(state.stack.pop())));
      break;
    case "outn":
      io.output.number(state.stack.pop()!);
      break;
    case "readc":
      // TODO address overflow
      state.heap[Number(state.stack.pop()!)] = BigInt(
        (await io.input.char()).charCodeAt(0)
      );
      break;
    case "readn":
      // TODO address overflow
      state.heap[Number(state.stack.pop()!)] = await io.input.number();
      break;
  }

  state.pc++;
  return state;
}
