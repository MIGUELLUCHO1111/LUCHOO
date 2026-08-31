import getUserProfiles from '../atx/get-user-profiles.js';

export default class Services {
  constructor() {
    this.getUserProfiles = getUserProfiles;
  }
}
