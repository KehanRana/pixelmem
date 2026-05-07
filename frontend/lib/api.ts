import type {
    ClustersResponse,
    ImageRecord,
    SearchResponse,
    SystemStatus,
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
  
    listImages: (status?: string) =>
      request<ImageRecord[]>(`/images${status ? `?status=${status}` : ""}`),
  
    getImage: (id: string) => request<ImageRecord>(`/images/${id}`),
  
    search: (imageId: string, k = 20) =>
      request<SearchResponse>(`/search/${imageId}?k=${k}`),
  
    clusters: (n = 12, force = false) =>
      request<ClustersResponse>(
        `/clusters?n=${n}${force ? "&force=true" : ""}`,
        { method: "POST" }
      ),
  
    status: () => request<SystemStatus>("/status"),
  };