class TokenBlacklist {
  constructor() {
    this.blacklist = new Set();
  }

  add(token) {
    this.blacklist.add(token);
  }

  has(token) {
    return this.blacklist.has(token);
  }

  clear() {
    this.blacklist.clear();
  }
}

module.exports = new TokenBlacklist();
