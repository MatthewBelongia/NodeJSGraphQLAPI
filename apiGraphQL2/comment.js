// If Comment had any complex fields, we'd put them on this object.
class Comment {
  constructor(id, post,name, email, body) {
    this.id = id;
    this.post = post;
    this.name = name;
    this.email = email;
    this.body = body;
  }
}

module.exports = Comment
