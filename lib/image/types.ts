export type ImageGenerateInput = {
  prompt: string;
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9" | "21:9";
  style?: string;
  seed?: number;
};

export type ImageJobResult = {
  status: "pending" | "running" | "succeeded" | "failed";
  imageUrl?: string;
  error?: string;
};

export interface ImageProvider {
  readonly id: string;
  readonly displayName: string;
  generate(input: ImageGenerateInput): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<ImageJobResult>;
}
