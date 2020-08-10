// If User had any complex fields, we'd put them on this object.
class User {
  constructor(id, name,username, email, phone, website, address) {
    this.id = id;
    this.name = name;
    this.username = username;
    this.email = email;
    this.phone = phone;
    this.website = website;
    this.address = address;
  }
}

module.exports = User
