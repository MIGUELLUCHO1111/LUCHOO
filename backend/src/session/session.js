import bcrypt from 'bcrypt';
import DBMS from '../dbms/dbms.js';

class Session {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Registro de usuario
  async register({ username, password, person_id }) {
    await this.dbmsReady;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'registerUser',
        params: {
          username,
          password: hashedPassword,
          person_id,
        },
      });
      return res?.rows?.[0];
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Login
  async login({ username, password }) {
    try {
      await this.dbmsReady;
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'getUser',
        params: { username },
      });
      const user = res?.rows?.[0];
      if (!user) return null;

      const match = await bcrypt.compare(password, user.password);
      if (!match) return null;

      // No devolvemos la contraseña
      delete user.password;
      return user;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Obtener usuario por ID
  async getUserById(id) {
    await this.dbmsReady;
    const res = await this.dbms.executeNamedQuery({
      nameQuery: 'getUserById',
      params: id,
    });
    return res?.rows?.[0];
  }

  // Obtener usuario por email
  async getUserByEmail(email) {
    await this.dbmsReady;
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'getUserByEmail',
        params: { email },
      });
      return res?.rows?.[0] || null;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Actualizar contraseña por ID
  async updatePasswordById({ userId, password }) {
    await this.dbmsReady;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'updateUserPassword',
        params: { password: hashedPassword, userId },
      });
      return res?.rows?.[0] || null;
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Recuperar contraseña por usuario
  async resetPasswordByUsername({ username, password }) {
    await this.dbmsReady;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'updateUserPasswordByUsername',
        params: { password: hashedPassword, username },
      });
      return res?.rows?.[0] || null;
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

export default Session;
