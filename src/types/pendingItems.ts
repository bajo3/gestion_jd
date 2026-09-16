export type PendingItem = {
  id: string;
  title: string;
  details: string;
  createdAt: string;
  completedAt: string | null;
  styleIndex: number;
};

export type PendingItemInput = Pick<PendingItem, "title" | "details" | "styleIndex">;
