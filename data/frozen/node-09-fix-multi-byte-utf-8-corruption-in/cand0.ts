import { Readable } from "node:stream";

export function readUtf8Stream(stream: Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let out = "";
    let buffer = Buffer.alloc(0);

    stream.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const codePoint = buffer.readUInt32BE(0);
        if (codePoint >= 0x10000) {
          out += String.fromCodePoint(codePoint);
          buffer = buffer.slice(4);
        } else {
          break;
        }
      }
    });

    stream.on("end", () => {
      out += buffer.toString("utf8");
      resolve(out);
    });

    stream.on("error", reject);
  });
}
