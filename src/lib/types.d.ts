export type Apartment = {
  description: string;
  title: string;
  street?: string;
  surface: number;
  rooms: number;
  roomSurface: number;
  rent: number;
  travelTimeBikeToComedie?: number;
  travelTimeBikeToPolytech?: number;
  link: string;
};

export type NotionAnnounce = {
  url: string;
  fees: number;
  notes: string;
  address: string;
  rent: number;
  surface: number;
  roomSurface: number;
  rooms: number;
  caution: number;
  local: boolean;
  living: boolean;
  terrace: boolean;
};

export type Mode = 'walking' | 'bicycling' | 'driving' | 'transit';
