import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const lines = [];
for (const file of (await readdir(".output"))
  .filter((n) => n.startsWith(`mylimits-${version}-`) && n.endsWith(".zip"))
  .sort())
  lines.push(
    `${createHash("sha256")
      .update(await readFile(".output/" + file))
      .digest("hex")}  ${file}`,
  );
if (!lines.length) throw Error("No extension ZIPs to checksum.");
await writeFile(".output/SHA256SUMS", lines.join("\n") + "\n");
console.log(`${lines.length} extension ZIP checksums written`);
