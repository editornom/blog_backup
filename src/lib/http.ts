export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function fail(message: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

/** JSON 본문과 폼 전송(application/x-www-form-urlencoded) 둘 다 받습니다. */
export async function readBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object") return {};
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [
          key,
          String(value ?? ""),
        ]),
      );
    }
    const form = await request.formData();
    return Object.fromEntries(Array.from(form.entries(), ([key, value]) => [key, String(value)]));
  } catch {
    return {};
  }
}
