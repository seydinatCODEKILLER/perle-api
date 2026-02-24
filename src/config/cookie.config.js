export const COOKIE_CONFIG = {
  ACCESS_TOKEN: {
    name: "accessToken",
    maxAge: 15 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
  },
  REFRESH_TOKEN: {
    name: "refreshToken",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    path: "/",
  },
};