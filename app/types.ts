export interface Token {
  id: string;
  type: string;
  attributes: Record<string, any>;
  relationships: Record<string, any>;
  requestor_fid?: string;
}

export type CreatorProfile = Record<
  string,
  {
    name: string;
    score: number;
    recasts: number;
    likes: number;
    profileImage: string;
  }
>;
