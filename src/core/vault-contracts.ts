import { z } from "zod";
import { ProviderSchema } from "./schema";
import type { ProviderId } from "./model";
import { providers } from "../providers/catalog";
export const VAULT_KEY = "mylimits:vault:v1";
export const VAULT_LIMIT = 16384;
export const VaultSlotSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
export const CookieNameSchema = z
  .string()
  .regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/);
const time = z.number().finite().min(0).max(8.64e15);
export const VaultPayloadSchema = z
  .object({
    v: z.literal(1),
    origin: z.string().max(200),
    cookies: z
      .array(
        z
          .object({
            name: CookieNameSchema,
            value: z
              .string()
              .max(VAULT_LIMIT)
              .regex(/^[\x21-\x3A\x3C-\x7E]*$/),
            expirationDate: z.number().finite().min(0).max(8.64e12).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();
export type VaultPayload = z.infer<typeof VaultPayloadSchema>;
export const VaultEntrySchema = z
  .object({
    provider: ProviderSchema,
    capturedAt: time,
    notAfter: time.nullable(),
    cookieNames: z.array(CookieNameSchema).min(1).max(40),
    nonce: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
    ciphertext: z
      .string()
      .min(24)
      .max(22000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export const VaultEnvelopeSchema = z
  .object({
    version: z.literal(1),
    entries: z
      .record(VaultSlotSchema, VaultEntrySchema)
      .refine((e) => Object.keys(e).length <= 100),
  })
  .strict();
export type VaultEnvelope = z.infer<typeof VaultEnvelopeSchema>;
export type VaultMetadata = {
  slot: string;
  provider: ProviderId;
  capturedAt: number;
  notAfter: number | null;
  cookieNames: string[];
};
export class VaultError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Saved sign-in ${code}.`);
    this.code = code;
  }
}
export function validateVaultPayload(
  provider: ProviderId,
  raw: unknown,
  allowlist: readonly string[],
): VaultPayload {
  const result = VaultPayloadSchema.safeParse(raw, { jitless: true });
  if (!result.success) throw new VaultError("invalid-payload");
  const p = result.data,
    names = p.cookies.map((c) => c.name);
  if (
    p.origin !== providers[provider].home ||
    new Set(names).size !== names.length ||
    !allowlist.length ||
    names.some((n) => !allowlist.includes(n)) ||
    new TextEncoder().encode(JSON.stringify(p)).length > VAULT_LIMIT
  )
    throw new VaultError("invalid-payload");
  return p;
}
export function vaultNotAfter(p: VaultPayload) {
  const times = p.cookies.flatMap((c) =>
    c.expirationDate === undefined ? [] : [c.expirationDate * 1000],
  );
  return times.length ? Math.min(...times) : null;
}
export function vaultCookieHeader(p: VaultPayload, now: number) {
  if (!VaultPayloadSchema.safeParse(p, { jitless: true }).success)
    throw new VaultError("invalid-payload");
  const value = p.cookies
    .filter(
      (c) => c.expirationDate === undefined || c.expirationDate > now / 1000,
    )
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  if (!value || new TextEncoder().encode(value).length > VAULT_LIMIT)
    throw new VaultError("expired");
  return value;
}
