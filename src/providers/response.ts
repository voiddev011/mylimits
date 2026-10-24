import { responseMetadata } from "../platform/diagnostics";
import { isChallengeResponse, type ResponseInfo } from "./errors";
export interface JsonResponse extends ResponseInfo {
  body: unknown;
}
/** Preserve the HTTP result and never parse a challenge page as quota JSON. */
export async function readJsonResponse(
  response: Response,
): Promise<JsonResponse> {
  const metadata = responseMetadata(response);
  if (!response.ok || isChallengeResponse(metadata))
    return { ...metadata, body: null };
  try {
    return { ...metadata, body: await response.json() };
  } catch {
    return { ...metadata, body: null, parseFailed: true };
  }
}
