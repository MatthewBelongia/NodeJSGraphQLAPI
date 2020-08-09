var express = require('express');
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const request = require('graphql-request');

let currentUser;


// access env CONSTANTS in .env file
dotenv.config();

// If Message had any complex fields, we'd put them on this object.
class Message {
  constructor(id, {content, author}) {
    this.id = id;
    this.content = content;
    this.author = author;
  }
}

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

// Maps username to content
var fakeDatabase = {};


// Construct a schema, using GraphQL schema language
var schema = buildSchema(`
  type User {
    id: Int!
    name: String!
    username: String
    email: String
    phone: String
    website: String
    address: UserAddress
  }

  type UserAddress {
    street: String
    suite: String
    city: String
    zipcode: String
  }

  type Post {
    id: Int
    user: User
    title: String
    body: String
    comments: [Comment]
  }

  type Comment {
    id: Int
    post: Post
    name: String
    email: String
    body: String
  }

  input MessageInput {
    content: String
    author: String
  }

  type Message {
    id: ID!
    content: String
    author: String
  }

  type Query {
    getMessage(id: ID!): Message
    githubLoginUrl: String!
    getUser(id: ID!): User
    getPost(id: ID): Post
    getComment(id: ID): Comment
    getCommentFromPost(id: ID): Comment
    queryRequest(query: String): String
  }

  type AuthPayload {
    githubToken: String!
    user: GitUser!
  }

  type GitUser {
    githubLogin: String
    name: String
    avatar: String
  }

  type Mutation {
    createMessage(input: MessageInput): Message
    updateMessage(id: ID!, input: MessageInput): Message
    deleteMessage(id: String): String
    authorizeWithGithub(code: String!): AuthPayload!
    updatePost(id: ID): Post
    deletePost(id: ID): Post
  }
`);

var root = {

/// Messages


  getMessage: ({id}) => {
    if (!fakeDatabase[id]) {
      throw new Error('no message exists with id ' + id);
    }
    return new Message(id, fakeDatabase[id]);
  },
  createMessage: ({input}) => {
    // Create a random id for our "database".
    var id = require('crypto').randomBytes(10).toString('hex');

    fakeDatabase[id] = input;
    return new Message(id, input);
  },
  updateMessage: ({id, input}) => {
    if (!fakeDatabase[id]) {
      throw new Error('no message exists with id ' + id);
    }
    // This replaces all old data, but some apps might want partial update.
    fakeDatabase[id] = input;
    return new Message(id, input);
  },
  deleteMessage: ({id}) => {
    if (!fakeDatabase[id]) {
      throw new Error('no message exists with id ' + id);
    }
    // This replaces all old data, but some apps might want partial update.
    delete fakeDatabase[id];
    return "Message with id :" + id + " removed from database";
  },


/// GitHub Auth Data


  githubLoginUrl: () => {
      return `https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}&scope=user`;
  },



  // custom query with library?
  queryRequest: ({queryInput}) => {
    request("https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/db", queryInput)
      .then(console.log)
      .catch(console.error);
  },




  //  helper async fetch functions
  async getUser ({id}) {
      let userResult =  await requestUser(id);
      console.log(userResult);

      return new User(userResult[0].id,
         userResult[0].name,
         userResult[0].username,
         userResult[0].email,
         userResult[0].phone,
         userResult[0].website,
         userResult[0].address); ;
  },

  async getComment({id}) {
    let commentResult = await requestComment(id);
    console.log(commentResult);

      return new Comment( commentResult[0].id,
                          commentResult[0].post,
                          commentResult[0].name,
                          commentResult[0].email,
                          commentResult[0].body
                        );
  },

  async getPost({id}) {
    let postResult = await requestPost(id);
    console.log(postResult);

      return new Post( postResult[0].id,
                          postResult[0].user,
                          postResult[0].title,
                          postResult[0].body,
                          postResult[0].comments
                        );
  },



  // Acquiring auth data from github

  async authorizeWithGithub({code}) {

  // 1. Obtain data from GitHub
    let githubUser = await requestGithubUser({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code
    })

  // 2. Package the results in a single object, write the value to currentUser global variable
    currentUser = {
      name: githubUser.name,
      githubLogin: githubUser.login,
      githubToken: githubUser.access_token,
      avatar: githubUser.avatar_url
    }

  // 3. Return user data and their token
    return { githubToken: currentUser.githubToken, user: currentUser };
  },

};


//
// Backend http calls to my json server as fake database
//


// get post comment data with fetch
const requestPost = id =>
  fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/posts?id=${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });



    /// TODO
    /////// write the GraphQL Queries in a file, have the api consume string or named api calls
    /// with simple String or number  parameter inputs that is then inserted into the
    //////  graphQL structured language



//get comment json data
const requestComment = id =>
  fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/comments?id=${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });

// get all comments from a particular Post with fetch
const requestCommentsFromPost = id =>
    fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/post?id=${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
      })
        .then(res => res.json())
        .catch(error => {
          throw new Error(JSON.stringify(error));
  });


//get user json data
const requestUser = id =>
  fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/users?id=${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });


// http call to github api for token auth code
const requestGithubToken = credentials =>
  fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(credentials)
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });

// http call to github api for user account details
 const requestGithubUserAccount = token =>
   fetch(`https://api.github.com/user?access_token=${token}`, {
     method: "GET",
     headers: {
       "Content-Type": "application/json",
       "Authorization": `token ${token}`,
       Accept: "application/json"
     },
   })
     .then(res => res.json())
     //.then(res => console.log(res))
     .catch(error => {
       throw new Error(JSON.stringify(error));
     });


// Helper functoin to call for token and GitHub user data and place in one obj
const requestGithubUser = async credentials => {

    const { access_token } = await requestGithubToken(credentials);
    const githubUser = await requestGithubUserAccount(access_token)
    return { ...githubUser, access_token };
  };


// helper library for browser text editor at /graphql for custom query and autofill
var app = express();
app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));
app.listen(4000, () => {
  console.log('Running a GraphQL API server at localhost:4000/graphql');
});
