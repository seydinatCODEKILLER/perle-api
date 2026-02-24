import jwt from "jsonwebtoken";
import { env } from "./env.js";

export default class TokenGenerator {
  sign(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_DURATION,
    });
  }

  verify(token) {
    return jwt.verify(token, env.JWT_SECRET);
  }

  signRefresh(payload) {
    console.log("JWT_REFRESH_SECRET =", env.JWT_REFRESH_SECRET);
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_DURATION,
    });
  }
}
