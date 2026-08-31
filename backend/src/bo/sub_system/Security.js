import { Person } from './classes/person.js';
import { Profile } from './classes/profile.js';

export class Security {
  constructor() {
    this.Person = Person;
    this.Profile = Profile;
  }
}

export default Security;
