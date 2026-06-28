export interface MoldMaster {
  moldCode: string;
  moldName: string;
  moldType: string;
  itemCode: string;
  cavity: number;
  currentShots: number;
  guaranteedShots: number;
  status: string;
  maintenanceCycle: number;
  lastMaintenanceDate: string | null;
  nextMaintenanceDate: string | null;
  location: string;
  maker: string;
  purchaseDate: string | null;
  remark: string;
}
