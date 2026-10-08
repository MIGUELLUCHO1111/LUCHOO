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
    const hashedPassword = await bcrypt.hash(password, 12);
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

  // getUserByEmail / updatePasswordById / resetPasswordByUsername se quitaron
  // junto con "olvidé mi contraseña" (08/10/2026): las contraseñas solo las
  // cambia un administrador desde Seguridad > Usuarios (Users.Usuario).
}

export default Session;
