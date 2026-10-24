import { z } from "zod";
import { ProviderSchema } from "./schema";
export const PrivateStartSchema = z
  .object({
    type: z.literal("vault-signin-start"),
    provider: ProviderSchema,
    method: z.enum(["private", "current"]),
    nickname: z.string().trim().max(60),
  })
  .strict();
export const PrivateSaveSchema = z
  .object({
    type: z.literal("vault-signin-save"),
    setupId: z.string().uuid(),
    accountId: z.string().min(1).max(240),
    consent: z.literal(true),
    nickname: z.string().trim().max(60).optional(),
  })
  .strict();
export const PrivateCancelSchema = z
  .object({
    type: z.literal("vault-signin-cancel"),
    setupId: z.string().uuid(),
  })
  .strict();
export const PrivateCheckSchema = z
  .object({ type: z.literal("vault-signin-check"), setupId: z.string().uuid() })
  .strict();
export const PRIVATE_ALARM = "mylimits:vault-signin-timeout";
export const PRIVATE_JOURNAL = "mylimits:vault-signin:v1";
export const PrivateJournalSchema = z
  .object({
    version: z.literal(1),
    id: z.string().uuid(),
    slot: z.string().uuid(),
    provider: ProviderSchema,
    method: z.enum(["private", "current"]),
    expiresAt: z.number().int().min(0).max(8.64e15),
    windowId: z.number().int().min(0).optional(),
    tabId: z.number().int().min(0).optional(),
  })
  .strict();
export type PrivateJournal = z.infer<typeof PrivateJournalSchema>;
export function privateSenderAllowed(
  sender: {
    id?: string;
    url?: string;
    frameId?: number;
    tab?: { incognito?: boolean };
  },
  id: string,
  origin: string,
) {
  try {
    const url = new URL(sender.url ?? ""),
      expected = new URL(origin);
    return (
      sender.id === id &&
      url.protocol === expected.protocol &&
      url.host === expected.host &&
      url.pathname === "/dashboard.html" &&
      !url.search &&
      sender.frameId === 0 &&
      sender.tab?.incognito === false
    );
  } catch {
    return false;
  }
}
