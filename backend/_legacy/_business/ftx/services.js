import getUserProfiles from '../atx/get-user-profiles.js';
import getUsersProfiles from '../atx/get-users-profiles.js';
import getMenuOptions from '../atx/get-menu-options.js';

export default class Services {
  constructor() {
    this.getUserProfiles = getUserProfiles;
    this.getUsersProfiles = getUsersProfiles;
    this.getMenuOptions = getMenuOptions;
  }
}
