export interface InterLog {
  id: string;
  direction: string;
  messageType: string;
  interfaceId: string;
  status: string;
  retryCount: number;
  errorMsg: string | null;
  createdAt: string;
  sendAt: string | null;
  recvAt: string | null;
}
