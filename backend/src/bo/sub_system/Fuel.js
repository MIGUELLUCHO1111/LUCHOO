import Vehiculo from './classes/vehiculo.js';
import Carga from './classes/carga.js';
import Pesada from './classes/pesada.js';
import Tanque from './classes/tanque.js';
import Reporte from './classes/fuelReporte.js';

export class Fuel {
  constructor() {
    this.Vehiculo = Vehiculo;
    this.Carga = Carga;
    this.Pesada = Pesada;
    this.Tanque = Tanque;
    this.Reporte = Reporte;
  }
}

export default Fuel;
