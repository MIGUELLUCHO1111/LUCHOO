import Ficha from './classes/ficha.js';
import Catalogo from './classes/catalogo.js';
import Encargado from './classes/encargado.js';

export class Flota {
  constructor() {
    this.Ficha = Ficha;
    this.Catalogo = Catalogo;
    this.Encargado = Encargado;
  }
}

export default Flota;
