export type EmbeddingStatus = "pending" | "processing" | "ready" | "failed";

export interface ImageRecord {
  id: string;
  filename: string;
  width: number;
  height: number;
  file_size_bytes?: number;
  embedding_status: EmbeddingStatus;
  thumbnail_url: string;
  original_url?: string;
  created_at?: string;
}

export interface SearchResult extends ImageRecord {
  similarity_score: number;
}

export interface SearchResponse {
  query_image_id: string;
  query_thumbnail_url: string;
  total_results: number;
  results: SearchResult[];
}

export interface ClusterMember {
  id: string;
  filename: string;
  thumbnail_url: string;
}

export interface Cluster {
  cluster_id: number;
  size: number;
  representative: ClusterMember | null;
  members: ClusterMember[];
}

export interface ClustersResponse {
  n_clusters: number;
  image_count: number;
  clusters: Cluster[];
}

export interface SystemStatus {
  total: number;
  indexed: number;
  processing: number;
  pending: number;
  failed: number;
  index_size: number;
}