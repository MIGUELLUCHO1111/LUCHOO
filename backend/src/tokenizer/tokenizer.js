import jwt from 'jsonwebtoken';

/**
 * Genera y verifica tokens JWT.
 * El secreto DEBE venir del entorno (sin fallback inseguro).
 */
export default class Tokenizer {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'JWT_SECRET no está definido en el entorno. Configúralo en .env antes de iniciar el servidor.',
      );
    }
    this.secret = secret;
  }

  /**
   * @param {Object} userData - Payload del token
   * @param {string} expiresIn - Duración (default '5min'; login usa AUTH_TOKEN_EXPIRES)
   * @returns {string} Token JWT firmado
   */
  generateToken(userData, expiresIn = process.env.AUTH_TOKEN_EXPIRES || '5min') {
    return jwt.sign(userData, this.secret, { expiresIn });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      return null;
    }
  }
}
