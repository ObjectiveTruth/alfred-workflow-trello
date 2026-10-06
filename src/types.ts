export interface TrelloCredentials {
  apiKey: string;
  token: string;
}

export interface Config {
  credentials: TrelloCredentials;
  listId: string;
}

export interface Card {
  id: string;
  name: string;
  url: string;
}

export type Result =
  | { success: true; card: Card }
  | { success: false; error: { code: string; message: string } };
