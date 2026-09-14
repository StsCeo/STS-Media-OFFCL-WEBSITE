import { headers } from "next/headers";
import { siteUrl } from "@/lib/config";
export { allowedFile } from "./files";

export async function assertSameOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  const referer = headerList.get("referer");
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const allowedHost = safeHost(siteUrl()) || host.split(":")[0];

  if (origin) {
    const originHost = safeHost(origin);
    if (originHost && originHost !== allowedHost && originHost !== host.split(":")[0]) {
      throw new Error("Cross-origin request blocked.");
    }
    return;
  }

  if (referer) {
    const refererHost = safeHost(referer);
    if (refererHost && refererHost !== allowedHost && refererHost !== host.split(":")[0]) {
      throw new Error("Cross-origin request blocked.");
    }
  }
}

function safeHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

