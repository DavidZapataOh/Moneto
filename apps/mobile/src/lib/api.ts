import { createLogger } from "@moneto/utils";
import { getAccessToken } from "@privy-io/expo";
import { z } from "zod";

const log = createLogger("api.client");

const API_URL = process.env["EXPO_PUBLIC_API_URL"] ?? "";

/**
 * Shape común de errores que devuelve `apps/api` (definido por el
 * `errorHandler` middleware del backend).
 */
const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export class ApiError extends Error {
  override readonly name = "ApiError";
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId: string | undefined,
  ) {
    super(message);
  }
}

interface RequestOptions<T> {
  /** HTTP method. Default GET. */
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Body — JSON-serializado automáticamente. */
  body?: unknown;
  /** Schema Zod opcional para validar la response. */
  schema?: z.ZodType<T>;
  /** Override del Privy token (default: get from Privy SDK). Útil para tests. */
  token?: string | null;
  /** AbortSignal para cancelar (e.g., navegación). */
  signal?: AbortSignal;
}

/**
 * Cliente tipado para `apps/api`. Inyecta automáticamente el Privy access
 * token + un X-Request-Id (correlation con el server log).
 *
 * Validation opcional con Zod schema — si pasas `schema`, la response se
 * parsea + valida; si falla, throw ApiError con `code: "schema_mismatch"`.
 *
 * @example
 *   const api = new ApiClient();
 *   const me = await api.request("/api/me", {
 *     schema: z.object({ userId: z.string() }),
 *   });
 *   console.log(me.userId);
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string = API_URL,
    private readonly tokenProvider: () => Promise<string | null> = getAccessToken,
  ) {}

  async request<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new ApiError(0, "config_missing", "EXPO_PUBLIC_API_URL not set", undefined);
    }

    const token =
      options.token === undefined ? await this.tokenProvider().catch(() => null) : options.token;
    const requestId = generateRequestId();

    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Request-Id": requestId,
      Accept: "application/json",
    });
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err) {
      log.warn("api network error", { path, err: String(err) });
      throw new ApiError(0, "network", "No se pudo conectar al servidor.", requestId);
    }

    const responseRequestId = response.headers.get("X-Request-Id") ?? requestId;

    if (!response.ok) {
      const errorPayload = await safeParseJson(response);
      const parsed = ApiErrorSchema.safeParse(errorPayload);
      const code = parsed.success ? parsed.data.error.code : `http_${response.status}`;
      const message = parsed.success
        ? parsed.data.error.message
        : `Request failed (${response.status})`;
      log.warn("api error response", {
        path,
        status: response.status,
        code,
        requestId: responseRequestId,
      });
      throw new ApiError(response.status, code, message, responseRequestId);
    }

    const data = await safeParseJson(response);

    if (options.schema) {
      const parsed = options.schema.safeParse(data);
      if (!parsed.success) {
        log.error("api schema mismatch", {
          path,
          requestId: responseRequestId,
          issues: parsed.error.issues.length,
        });
        throw new ApiError(
          response.status,
          "schema_mismatch",
          "La respuesta del servidor no coincide con el formato esperado.",
          responseRequestId,
        );
      }
      return parsed.data;
    }

    return data as T;
  }

  // Convenience helpers — más legible para handlers comunes.

  async get<T = unknown>(
    path: string,
    options: Omit<RequestOptions<T>, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions<T>, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    options: Omit<RequestOptions<T>, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  async delete<T = unknown>(
    path: string,
    options: Omit<RequestOptions<T>, "method" | "body"> = {},
  ): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}

async function safeParseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Generador de request ID. Prefiere `crypto.randomUUID()` si está disponible
 * (RN 0.81+ lo expone), sino fallback a base64 random.
 */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback — 16 bytes hex = 32 chars, suficiente entropy.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── React hooks ─────────────────────────────────────────────────────────

let cachedClient: ApiClient | null = null;

/**
 * Hook para consumir el `ApiClient` desde React. Singleton — el cliente
 * es stateless (cada request lee Privy token fresh), no hace falta
 * recrearlo por componente.
 *
 * @example
 *   function MyScreen() {
 *     const api = useApi();
 *     useEffect(() => {
 *       api.get("/api/me", { schema: MeSchema }).then(setMe);
 *     }, [api]);
 *   }
 */
export function useApi(): ApiClient {
  if (!cachedClient) {
    cachedClient = new ApiClient();
  }
  return cachedClient;
}

/**
 * Reset del singleton — usar en logout para forzar nuevo client.
 * (Por ahora es no-op porque no hay state en el client, pero queda
 * como hook por symmetry con resetSupabaseClient.)
 */
export function resetApiClient(): void {
  cachedClient = null;
}
