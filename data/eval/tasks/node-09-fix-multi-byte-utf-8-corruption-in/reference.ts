import { Readable } from "node:stream";
import { StringDecoder } from "node:string_decoder";

export function readUtf8Stream(stream: Readable): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const decoder = new StringDecoder("utf8");
    let out = "";
    stream.on("data", (chunk: Buffer | string) => {
      out += typeof chunk === "string" ? chunk : decoder.write(chunk);
    });
    stream.on("end", () => resolve(out + decoder.end()));
    stream.on("error", reject);
  });
}
