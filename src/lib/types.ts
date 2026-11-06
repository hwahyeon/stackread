export interface TextBlock {
  id: string;
  type: "text";
  html: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  file: string;
  caption: string;
  source_url?: string;
}

export type Block = TextBlock | ImageBlock;

/** Contents of meta.json. */
export interface ArticleMeta {
  title: string;
  author: string;
  published_at: string;
  source_url: string;
  language: string;
  read_at: string;
  blocks: Block[];
}
