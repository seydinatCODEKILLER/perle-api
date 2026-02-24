import { COOKIE_CONFIG } from "../config/cookie.config.js";

export class CookieManager {
  /**
   * Définir le cookie d'access token
   */
  static setAccessToken(res, token) {
    res.cookie(COOKIE_CONFIG.ACCESS_TOKEN.name, token, {
      maxAge: COOKIE_CONFIG.ACCESS_TOKEN.maxAge,
      httpOnly: COOKIE_CONFIG.ACCESS_TOKEN.httpOnly,
      secure: COOKIE_CONFIG.ACCESS_TOKEN.secure,
      sameSite: COOKIE_CONFIG.ACCESS_TOKEN.sameSite,
      path: COOKIE_CONFIG.ACCESS_TOKEN.path,
    });
  }

  /**
   * Définir le cookie de refresh token
   */
  static setRefreshToken(res, token) {
    res.cookie(COOKIE_CONFIG.REFRESH_TOKEN.name, token, {
      maxAge: COOKIE_CONFIG.REFRESH_TOKEN.maxAge,
      httpOnly: COOKIE_CONFIG.REFRESH_TOKEN.httpOnly,
      secure: COOKIE_CONFIG.REFRESH_TOKEN.secure,
      sameSite: COOKIE_CONFIG.REFRESH_TOKEN.sameSite,
      path: COOKIE_CONFIG.REFRESH_TOKEN.path,
    });
  }

  /**
   * Définir les deux tokens
   */
  static setAuthTokens(res, accessToken, refreshToken) {
    this.setAccessToken(res, accessToken);
    this.setRefreshToken(res, refreshToken);
  }

  /**
   * Supprimer tous les cookies d'authentification
   */
  static clearAuthCookies(res) {
    res.clearCookie(COOKIE_CONFIG.ACCESS_TOKEN.name, {
      path: COOKIE_CONFIG.ACCESS_TOKEN.path,
    });
    res.clearCookie(COOKIE_CONFIG.REFRESH_TOKEN.name, {
      path: COOKIE_CONFIG.REFRESH_TOKEN.path,
    });
  }

  /**
   * Récupérer l'access token depuis les cookies
   */
  static getAccessToken(req) {
    return req.cookies?.[COOKIE_CONFIG.ACCESS_TOKEN.name] || null;
  }

  /**
   * Récupérer le refresh token depuis les cookies
   */
  static getRefreshToken(req) {
    return req.cookies?.[COOKIE_CONFIG.REFRESH_TOKEN.name] || null;
  }
}