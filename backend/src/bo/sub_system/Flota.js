import Ficha from './classes/ficha.js';
import Catalogo from './classes/catalogo.js';
import Encargado from './classes/encargado.js';
import Lectura from './classes/lectura.js';
import Conductor from './classes/conductor.js';

export class Flota {
  constructor() {
    this.Ficha = Ficha;
    this.Catalogo = Catalogo;
    this.Encargado = Encargado;
    this.Lectura = Lectura;
    this.Conductor = Conductor;
  }
}

export default Flota;
