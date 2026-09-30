import Ficha from './classes/ficha.js';
import Catalogo from './classes/catalogo.js';

export class Flota {
  constructor() {
    this.Ficha = Ficha;
    this.Catalogo = Catalogo;
  }
}

export default Flota;
