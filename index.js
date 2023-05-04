const express = require('express');
const app = express();
const jwt = require('jsonwebtoken'); // added import
const { User, Kitten } = require('./db');

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.get('/', async (req, res, next) => {
  try {
    res.send(`
      <h1>Welcome to Cyber Kittens!</h1>
      <p>Cats are available at <a href="/kittens/1">/kittens/:id</a></p>
      <p>Create a new cat at <b><code>POST /kittens</code></b> and delete one at <b><code>DELETE /kittens/:id</code></b></p>
      <p>Log in via POST /login or register via POST /register</p>
    `);
  } catch (error) {
    console.error(error);
    next(error)
  }
});

// Authentication middleware

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) {
      res.sendStatus(401);
      return;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { // modified line
      if (err) {
        res.sendStatus(401);
        return;
      }
      return decoded;
    });
    const user = await User.findById(decoded.id);
    if (!user) {
      res.sendStatus(401);
      return;
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// GET /kittens/:id
app.get('/kittens/:id', authenticateToken, async (req, res, next) => {
  try {
    const kitten = await Kitten.findById(req.params.id);
    if (!kitten) {
      res.sendStatus(404);
      return;
    }
    if (kitten.ownerId !== req.user.id) {
      res.sendStatus(401);
      return;
    }
    res.send(kitten);
  } catch (error) {
    next(error);
  }
});

// POST /kittens
app.post('/kittens', authenticateToken, async (req, res, next) => {
  try {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }
    const kitten = new Kitten({
      name: req.body.name,
      age: req.body.age,
      color: req.body.color,
      ownerId: req.user.id,
    });
    await kitten.save();
    res.status(201).send({ name: kitten.name, age: kitten.age, color: kitten.color });
  } catch (error) {
    next(error);
  }
});

// DELETE /kittens/:id
app.delete('/kittens/:id', authenticateToken, async (req, res, next) => {
  try {
    if (!req.user) {
      res.sendStatus(401);
      return;
    }
    const kitten = await Kitten.findById(req.params.id);
    if (!kitten) {
      res.sendStatus(404);
      return;
    }
    if (kitten.ownerId !== req.user.id) {
      res.sendStatus(401);
      return;
    }
    await kitten.delete();
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

// error handling middleware, so failed tests receive them
app.use((error, req, res, next) => {
  console.error('SERVER ERROR: ', error);
  if(res.statusCode < 400) res.status(500);
  res.send({error: error.message, name: error.name, message: error.message});
});

// we export the app, not listening in here, so that we can run tests
module.exports = app;
