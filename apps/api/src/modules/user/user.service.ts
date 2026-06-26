import { Injectable } from "@nestjs/common";
import { UserRepository } from "./repositories/user.repository";

@Injectable()
export class UserService {
  constructor(private readonly users: UserRepository) {}

  findByEmail(email: string) {
    return this.users.findByEmail(email);
  }

  capabilities() {
    return { resource: "users", mode: "repository-ready" };
  }
}
