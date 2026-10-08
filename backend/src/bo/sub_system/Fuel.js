import Vehiculo from './classes/vehiculo.js';
import Carga from './classes/carga.js';
import Pesada from './classes/pesada.js';
import Tanque from './classes/tanque.js';
import Reporte from './classes/fuelReporte.js';
import Transferencia from './classes/transferencia.js';

export class Fuel {
  constructor() {
    this.Vehiculo = Vehiculo;
    this.Carga = Carga;
    this.Pesada = Pesada;
    this.Tanque = Tanque;
    this.Reporte = Reporte;
    this.Transferencia = Transferencia;
  }
}

export default Fuel;
