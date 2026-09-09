export interface TourHelpEntry { title: string; description: string; usage?: string; warning?: string; related?: string[]; }
export type TourHelpResources = Record<string, TourHelpEntry>;
