import bcrypt from "bcryptjs";

export default class PasswordHasher {
  async hash(password) {
    return bcrypt.hash(password, 10);
  }

  async compare(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}
