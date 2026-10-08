import { Person } from './classes/person.js';
import { Profile } from './classes/profile.js';
import { Option } from './classes/option.js';
import { Actividad } from './classes/actividad.js';

export class Security {
  constructor() {
    this.Person = Person;
    this.Profile = Profile;
    this.Option = Option;
    this.Actividad = Actividad;
  }
}

export default Security;
