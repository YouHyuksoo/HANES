import { Request } from 'express';

export interface RequestUser {
  id?: string;
  email?: string;
  role?: string;
  company?: string;
  plant?: string;
}

export type RequestWithUser = Request & { user?: RequestUser };

export function getRequestUser(request: RequestWithUser): RequestUser | undefined {
  return request.user;
}

export function setRequestUser(request: RequestWithUser, user: RequestUser): void {
  request.user = user;
}
