import Validator from '../../validator/validator.js';
import DBMS from '../../dbms/dbms.js';
import create_event from '../atx/create_event.js';
import update_event from '../atx/update_event.js';
import list_event from '../atx/list_events.js';
import delete_event from '../atx/delete_event.js';

export default class Evento {
  constructor() {
    if (!Evento.instance) {
      this.className = 'evento';
      Evento.instance = this;
      this.dbms = new DBMS();
      this.validator = new Validator();
      this.create_event = create_event.bind(this);
      this.update_event = update_event.bind(this);
      this.list_event = list_event.bind(this);
      this.delete_event = delete_event.bind(this);
    }
    return Evento.instance;
  }
}
