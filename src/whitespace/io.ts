export interface IO {
  input: {
    char: () => Promise<string>;
    number: () => Promise<bigint>;
  };
  output: {
    char: (c: string) => void;
    number: (n: bigint) => void;
  };
}

export function callbackOutput(cb: (output: string) => void): IO["output"] {
  return {
    char: (v) => cb(v),
    number: (v) => cb(v.toString()),
  };
}

export function arrayOutput(): IO["output"] & { result: string[] } {
  const result: string[] = [];
  return {
    ...callbackOutput((v) => result.push(v)),
    result,
  };
}

export function stringOutput(): IO["output"] & {
  getAll: () => string;
  getNew: () => string;
} {
  const inner = arrayOutput();
  let lastRead = 0;
  return {
    ...inner,
    getAll: () => inner.result.join(""),
    getNew: () => {
      const start = lastRead;
      lastRead = inner.result.length;
      return inner.result.slice(start).join("");
    },
  };
}

export function callbackInput(morePlease: () => Promise<string>): IO["input"] {
  let buffer = "";

  const reload = async () => {
    const batch = await morePlease();
    if (batch === "") {
      throw new Error("IO: End of input");
    }
    buffer += batch;
  };

  return {
    char: async () => {
      if (buffer.length === 0) {
        await reload();
      }
      const result = buffer.charAt(0);
      buffer = buffer.slice(1);
      return result;
    },
    number: async () => {
      let i = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (buffer.length <= i) {
          await reload();
        }
        const c = buffer.charAt(i);
        if (c == " " || c == "\n" || c == "\t") break;
        if (isNaN(Number(c))) {
          const error = new Error(
            "IO: Expected number, got " + buffer.slice(0, i + 1)
          );
          buffer = "";
          throw error;
        }

        i++;
      }

      const result = BigInt(buffer.slice(0, i + 1));
      buffer = buffer.slice(i + 1);
      return result;
    },
  };
}

export function staticInput(value = ""): IO["input"] {
  let handedOver = false;

  return callbackInput(async () => {
    if (handedOver) {
      return "";
    }
    handedOver = true;
    return value;
  });
}
