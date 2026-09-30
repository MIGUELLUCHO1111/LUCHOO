import Ficha from './classes/ficha.js';
import Catalogo from './classes/catalogo.js';
import Encargado from './classes/encargado.js';
import Lectura from './classes/lectura.js';

export class Flota {
  constructor() {
    this.Ficha = Ficha;
    this.Catalogo = Catalogo;
    this.Encargado = Encargado;
    this.Lectura = Lectura;
  }
}

export default Flota;
