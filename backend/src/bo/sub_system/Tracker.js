import Unidad from './classes/unidad.js';
import Snapshot from './classes/snapshot.js';
import Alerta from './classes/alerta.js';
import Reporte from './classes/reporte.js';
import ReporteArchivo from './classes/reporteArchivo.js';
import Archivo from './classes/archivo.js';
import Comportamiento from './classes/comportamiento.js';
import Notificador from './classes/notificador.js';
import Recorrido from './classes/recorrido.js';
import Suscriptor from './classes/suscriptor.js';

export class Tracker {
  constructor() {
    this.Unidad = Unidad;
    this.Snapshot = Snapshot;
    this.Alerta = Alerta;
    this.Reporte = Reporte;
    this.ReporteArchivo = ReporteArchivo;
    this.Archivo = Archivo;
    this.Comportamiento = Comportamiento;
    this.Notificador = Notificador;
    this.Recorrido = Recorrido;
    this.Suscriptor = Suscriptor;
  }
}

export default Tracker;
