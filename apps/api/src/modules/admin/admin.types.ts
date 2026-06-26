export interface AdminJwtPayload {
  adminUserId: string;
  email: string;
  role: "SUPER_ADMIN";
  tokenUse: "admin";
}

export interface AdminPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "SUPER_ADMIN";
}
