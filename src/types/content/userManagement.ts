// Types for User Management and RBAC implementation
// Fully versions without overriding content/index.ts

export interface RoleAccessType {
  id: number;
  name: string;
}

export interface RoleType {
  id: number;
  name: string;
  accessList?: RoleAccessType[] | string[];
  owner?: any;
  users?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserType {
  id: number;
  username: string;
  email: string;
  name: string;
  phone: string;
  type: string;
  is_active: boolean;
  roles: RoleType[];
}

export interface CreateAdminUserPayload {
  username?: string;
  password?: string;
  name: string;
  email: string;
  phone: string;
  roles: number[];
}

export interface UpdateAdminUserPayload {
  username?: string;
  password?: string;
  name?: string;
  email?: string;
  phone?: string;
  roles?: number[];
}
