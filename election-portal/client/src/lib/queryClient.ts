import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiUrl } from "@/lib/apiUrl";

// Parse JSON response or throw an error
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    
    try {
      // Try to parse error message from JSON response
      const errorData = await res.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // If JSON parsing fails, use text
      try {
        errorMessage = await res.text();
      } catch (textError) {
        // If all fails, use status text
        errorMessage = res.statusText;
      }
    }
    
    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

// Helper function to add authorization header if token exists
function getAuthHeaders(includeContentType = false) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
  
  if (includeContentType) {
    headers["Content-Type"] = "application/json";
  }
  
  // Get token from localStorage if available
  const token = localStorage.getItem('authToken');
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

const noStoreFetchInit: RequestInit = {
  credentials: "include",
  cache: "no-store",
};

// API request function for mutations
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(apiUrl(url), {
    ...noStoreFetchInit,
    method,
    headers: getAuthHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

/** Multipart/form-data uploads (do not set Content-Type — browser sets boundary). */
export async function apiFormRequest(
  method: string,
  url: string,
  formData: FormData,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(apiUrl(url), {
      ...noStoreFetchInit,
      method,
      headers: getAuthHeaders(false),
      body: formData,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network error";
    throw new Error(`Failed to fetch: ${detail}`);
  }

  await throwIfResNotOk(res);
  return res;
}

// Query function for useQuery hooks
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    
    const res = await fetch(apiUrl(url), {
      ...noStoreFetchInit,
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const responseData = await res.json();
    
    // Our API returns data in a nested structure, usually with 'user' or similar fields
    // For some endpoints like /me, data is in responseData.user
    // For other endpoints, it might be in responseData.data
    // If neither exists, return the whole response
    if (responseData.data !== undefined) return responseData.data;
    if (responseData.user !== undefined) return responseData.user;
    return responseData;
  };

// Configure QueryClient with defaults for our API
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds before considering data stale
      retry: 1, // Retry failed queries once
    },
    mutations: {
      retry: 0, // Don't retry mutations
    },
  },
});
