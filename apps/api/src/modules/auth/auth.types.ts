export interface JwtPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

export interface AuthUserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponse;
}
