import DBMS from '../src/dbms/dbms.js';

class ProfileService {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Asignar un perfil a un usuario
  async assignProfileToUser({ user_id, profile_id }) {
    await this.dbmsReady;
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'insertUserProfile',
        params: {
          user_id,
          profile_id,
        },
      });
      return res?.rows?.[0];
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Crear un perfil nuevo
  async createProfile({ profile_name }) {
    await this.dbmsReady;
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'insertProfile',
        params: { profile_name },
      });
      return res?.rows?.[0];
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Obtener perfil por nombre
  async getProfileByName(profile_name) {
    await this.dbmsReady;
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'getProfileByName',
        params: { profile_name },
      });
      return res?.rows?.[0];
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

export default ProfileService;
