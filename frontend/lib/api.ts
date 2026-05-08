import type {
    ClustersResponse,
    ImageRecord,
    ImagesPage,
    SearchResponse,
    SystemStatus,
    TextSearchResponse,
  } from "./types";
  
  const BASE = "/api";
  
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, init);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API ${path} → ${res.status}: ${body}`);
    }
    return res.json() as Promise<T>;
  }
  
  export const api = {
    upload: async (files: File[]) => {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return request<{ uploaded: number; failed: number; images: ImageRecord[] }>(
        "/upload",
        { method: "POST", body: form }
      );
    },
  
    listImages: (opts: { status?: string; offset?: number; limit?: number } = {}) => {
      const params = new URLSearchParams();
      if (opts.status) params.set("status", opts.status);
      if (opts.offset != null) params.set("offset", String(opts.offset));
      if (opts.limit != null) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return request<ImagesPage>(`/images${qs ? `?${qs}` : ""}`);
    },

    getImage: (id: string) => request<ImageRecord>(`/images/${id}`),

    search: (imageId: string, k = 20) =>
      request<SearchResponse>(`/search/${imageId}?k=${k}`),

    searchText: (q: string, k = 24) =>
      request<TextSearchResponse>(
        `/search/text?q=${encodeURIComponent(q)}&k=${k}`
      ),
  
    clusters: (n = 12, force = false) =>
      request<ClustersResponse>(
        `/clusters?n=${n}${force ? "&force=true" : ""}`,
        { method: "POST" }
      ),
  
    status: () => request<SystemStatus>("/status"),
  };