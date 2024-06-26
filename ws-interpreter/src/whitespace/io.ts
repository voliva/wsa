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

export function arrayOutput(): IO["output"] & { result: string[] } {
  const result: string[] = [];
  return {
    char: (v) => result.push(v),
    number: (v) => result.push(v.toString()),
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
      // TODO
    },
  };
}

export function staticInput(value: string): IO["input"] {
  let handedOver = false;

  return callbackInput(async () => {
    if (handedOver) {
      return "";
    }
    handedOver = true;
    return value;
  });
}
