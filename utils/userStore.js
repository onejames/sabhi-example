class UserStore {
  constructor() {
    this.users = new Map(); // username -> { password, permissions }
  }

  get(username) {
    return this.users.get(username);
  }

  set(username, password, permissions = ['billing.manage']) {
    this.users.set(username, { password, permissions });
  }

  clear() {
    this.users.clear();
  }
}

module.exports = new UserStore();
