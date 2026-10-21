export class ProbeError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
