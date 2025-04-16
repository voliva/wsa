import lib_bitwise from "./lib/bitwise.wsa?raw" with { type: "text" };
import lib_bitwise_extensions from "./lib/bitwise.extensions.wsa?raw" with { type: "text" };
import lib_io from "./lib/io.wsa?raw" with { type: "text" };
import lib_math from "./lib/math.wsa?raw" with { type: "text" };
import lib_memcontainer from "./lib/memcontainer.wsa?raw" with { type: "text" };
import lib_memory from "./lib/memory.wsa?raw" with { type: "text" };
import lib_memory_stack from "./lib/memory_stack.wsa?raw" with { type: "text" };
import lib_vector from "./lib/vector.wsa?raw" with { type: "text" };
import { Token, tokenizeLine } from "./tokens";

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

async function* lineStreamToAsyncIterator(stream: LineStream) {
  let waiting = () => {};
  const wait = () => {
    let bumped = false;
    waiting = () => {
      bumped = true;
    };
    return new Promise<void>((resolve) => {
      if (bumped) resolve();
      else waiting = resolve;
    });
  };

  let ended = false;
  let lastEmission = 0;
  const content: string[] = [];

  stream((line) => {
    if (line == null) {
      ended = true;
      return;
    }
    content.push(line);
    waiting();
  });

  while (!ended || lastEmission < content.length) {
    if (content.length <= lastEmission) {
      await wait();
    }
    yield content[lastEmission++];
  }
}

const libraries: Record<string, string> = {
  lib_bitwise_extensions,
  lib_bitwise,
  lib_io,
  lib_math,
  lib_memory,
  lib_memory_stack,
  lib_vector,
  lib_memcontainer,
};

const includedFiles = new Set<string>();
function include(
  filename: string,
  getIncludedStream: (filename: string) => LineStream,
  extensions: boolean
) {
  if (includedFiles.has(filename)) return [];
  includedFiles.add(filename);

  const libName = `lib_${filename}`;
  const sourceStream =
    libName in libraries
      ? stringToLineStream(
          extensions && `${libName}_extensions` in libraries
            ? libraries[`${filename}_extensions`]
            : libraries[libName]
        )
      : getIncludedStream(filename);

  return load(sourceStream, getIncludedStream, extensions, filename);
}

export interface Instruction {
  source: string;
  line: number;
  tokens: Token[];
}

export async function load(
  inputStream: LineStream,
  getIncludedStream: (filename: string) => LineStream,
  extensions: boolean,
  source: string
) {
  let program: Array<Instruction> = [];

  let lineNum = 0;
  try {
    for await (const line of lineStreamToAsyncIterator(inputStream)) {
      lineNum++;
      const tokens = tokenizeLine(line);

      if (tokens.length == 0) continue;
      const [op, ...args] = tokens;
      if (op.type === "word" && op.value.toLowerCase() === "include") {
        if (
          args.length !== 1 ||
          !(
            args[0].type === "word" ||
            args[0].type === "string" ||
            args[0].type === "variable"
          )
        ) {
          throw new Error(
            `expected filename argument, but got ${formatArgTypes(args)}`
          );
        }
        const filename = args[0].value;
        const included = await include(filename, getIncludedStream, extensions);
        program = [...program, ...included];
      } else {
        program.push({
          line: lineNum,
          source,
          tokens,
        });
      }
    }
  } catch (ex) {
    console.error(ex);
    throw new Error(
      `failed loading ${source} at line ${lineNum}: ${(ex as any)?.message}`
    );
  }

  return program;
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
