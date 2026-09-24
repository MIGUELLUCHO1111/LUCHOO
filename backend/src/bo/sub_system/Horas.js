import Empresa from './classes/empresa.js';
import Proyecto from './classes/proyecto.js';
import Equipo from './classes/equipo.js';
import Registro from './classes/registro.js';
import Reporte from './classes/horasReporte.js';

export class Horas {
  constructor() {
    this.Empresa = Empresa;
    this.Proyecto = Proyecto;
    this.Equipo = Equipo;
    this.Registro = Registro;
    this.Reporte = Reporte;
  }
}

export default Horas;
