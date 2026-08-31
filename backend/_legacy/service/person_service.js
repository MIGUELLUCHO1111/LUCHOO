import DBMS from '../src/dbms/dbms.js';

class PersonService {
  constructor() {
    this.dbms = new DBMS();
    this.dbmsReady = this.dbms.init();
  }

  // Crear una nueva persona
  async createPerson({ ci, name, lastname, email, phone }) {
    await this.dbmsReady;
    try {
      const res = await this.dbms.executeNamedQuery({
        nameQuery: 'insertPerson',
        params: {
          ci,
          name,
          lastname: lastname || '',
          email,
          phone: phone || '',
        },
      });
      return res?.rows?.[0];
    } catch (err) {
      throw new Error(err.message);
    }
  }
}

export default PersonService;
