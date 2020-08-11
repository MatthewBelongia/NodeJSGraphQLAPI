var express = require('express');
var { graphqlHTTP } = require('express-graphql');
var { buildSchema } = require('graphql');
const fetch = require('node-fetch');
const dotenv = require('dotenv');
const request = require('graphql-request');
const User = require('./user.js');
const Message = require('./message.js');
const Post = require('./post.js');
const Comment = require('./comment.js');
const passport = require('passport');
var GitHubStrategy = require('passport-github2').Strategy;
var session = require('express-session');
var cookieParser = require('cookie-parser');

// access env CONSTANTS in .env file
dotenv.config();

// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and GitHub
//   profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.AUTH_HOST_IP + "/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {

    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

let currentUser;

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

  input PostInput {
    id: Int
    user: UserInput
    title: String
    body: String
    comments: [CommentInput]
  }

  input UserInput {
    id: Int!
    name: String!
    username: String
    email: String
    phone: String
    website: String
    address: UserAddressInput
  }

  input CommentInput {
    id: Int
    post: Int
    name: String
    email: String
    body: String
  }

  input UserAddressInput {
    street: String
    suite: String
    city: String
    zipcode: String
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
    getCommentsFromPost(id: ID): [Comment]
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
    updatePost(id: ID, input: PostInput): Post
    deletePost(id: ID): Post
  }
`);

var root = {

/// GitHub Auth Data
  githubLoginUrl: () => {
      return `https://github.com/login/oauth/authorize?client_id=${process.env.CLIENT_ID}&scope=user`;
  },

  // custom query with library?
  // come back to this
  queryRequest: ({queryInput}) => {
    request("https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/db", queryInput)
      .then(console.log)
      .catch(console.error);
  },

  //  helper async fetch functions
  async getUser ({id}) {
      let userResult =  await requestUserWithFetch(id);
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
    let commentResult = await requestCommentWithFetch(id);
    console.log(commentResult);

      return new Comment( commentResult[0].id,
                          commentResult[0].post,
                          commentResult[0].name,
                          commentResult[0].email,
                          commentResult[0].body
                        );
  },

  async getPost({id}) {
    console.log("getPost called");
    let postResult = await requestPostWithFetch(id);
    console.log(postResult);

      return new Post( postResult[0].id,
                          postResult[0].user,
                          postResult[0].title,
                          postResult[0].body,
                          postResult[0].comments
                        );
  },

  async getCommentsFromPost ({id}) {
    console.log("getCommentsFromPost called");
    console.log(id);
    const query = JSON.stringify({
      query: `query {
                    	getPost(id: ${id})
                    		{
                    			id
                          comments{
                            id
                            body
                            email
                            name
                          }
                    		}
                      }
               `
             })

      const response = await fetch(
        process.env.AUTH_HOST_IP + "/graphql",
          {
              headers: {'Content-Type': 'application/json'},
              method: 'POST',
              body: query,
          });

          const responseJson = await response.json();
          console.log("responseJson::");
          console.log(responseJson.data);
          return responseJson.data.getPost.comments;


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

  async updatePost({id, input}) {
      let updatedPost = await updatePostWithFetch(id, input)
      return { updatedPost };
  },
  async deletePost({id}){
    await deletePostWithFetch(id);
  },

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
};

//
// Backend http calls to my json server as fake database
//

// http call to update Posts
function updatePostWithFetch(id, input) {
  const response = fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/posts/id=${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(input)
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });
    return response;
}

// http call to delete Posts
function deletePostWithFetch(id) {
  fetch(`https://my-json-server.typicode.com/MatthewBelongia/jsonPlaceHolder/posts/id=${id}`, {
    method: "DELETE",
  })
    .then(res => res.json())
    .catch(error => {
      throw new Error(JSON.stringify(error));
    });
}

// get post comment data with fetch
const requestPostWithFetch = id =>
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
const requestCommentWithFetch = id =>
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
const requestUserWithFetch = id =>
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


// Helper function to call for token and GitHub user data and place in one obj
const requestGithubUser = async credentials => {

    const { access_token } = await requestGithubToken(credentials);
    const githubUser = await requestGithubUserAccount(access_token)
    return { ...githubUser, access_token };
  };


passport.serializeUser(function(user, done) {
    done(null, user);
  });

passport.deserializeUser(function(user, done) {
    done(null, user);
  });


// helper library for browser text editor at /graphql for custom query and autofill
var app = express();
app.use(cookieParser());
app.use(session({secret: "secretpw"}));


app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/github',
  passport.authenticate('github', { scope: [ 'user:email' ] }));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    console.log('after github callback');
    if (req.user) {
        console.log('redirected to /graphql');
        res.redirect('/graphql')
        //res.status(200).end('something');
    } else {
        res.status(500).end('Not authenticated by GitHub, please log in');
        next();
    }
  });

app.use('/graphql',
ensureAuthenticated,
 graphqlHTTP({
    schema: schema,
    rootValue: root,
    graphiql: true,
  }));

app.listen(4000, () => {
  console.log('Running a GraphQL API server at localhost:4000/graphql');
});


function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth/github')
}
