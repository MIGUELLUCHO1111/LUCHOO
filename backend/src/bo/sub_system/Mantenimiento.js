import OrdenTrabajo from './classes/ordenTrabajo.js';
import Incidencia from './classes/incidencia.js';
import Criticidad from './classes/criticidad.js';
import PlanPreventivo from './classes/planPreventivo.js';
import CatalogoMnt from './classes/catalogoMnt.js';

export class Mantenimiento {
  constructor() {
    this.OrdenTrabajo = OrdenTrabajo;
    this.Incidencia = Incidencia;
    this.Criticidad = Criticidad;
    this.PlanPreventivo = PlanPreventivo;
    this.CatalogoMnt = CatalogoMnt;
  }
}

export default Mantenimiento;
