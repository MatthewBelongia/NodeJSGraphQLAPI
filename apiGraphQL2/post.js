

// If Post had any complex fields, we'd put them on this object.
class Post {
  constructor(id, user,title, body, comments) {
    this.id = id;
    this.user = user;
    this.title = title;
    this.body = body;
    this.comments = comments;
  }
}

module.exports = Post
