const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

// Middleware per la gestione delle richieste in entrata
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

const config = {
  PORT: 3000,
  TOKEN_SIGN_KEY: 'SecretKey123!', 
  MONGODB_URI: `mongodb+srv://Admin:Admin@cluster0.vcqdtqb.mongodb.net/`,
  MONGODB_DB: 'sample_mflix'
};

// Creazione oggetto di connessione a MongoDB
const client = new MongoClient(config.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Middleware per il controllo della validità del token
app.use(function (req, res, next) {
  if (req.originalUrl === '/login' || req.originalUrl === '/addUser') {
    return next();
  }
  if (req.headers.authorization && req.headers.authorization.length > 0 && req.headers.authorization.split(' ')[0] === 'Bearer') {
    const token = req.headers.authorization.split(' ')[1];
    //console.log('Received token:', token); // Log del token
    try {
      const decoded = jwt.verify(token, config.TOKEN_SIGN_KEY);
      req.user = decoded; // Salvo il contenuto del token nella richiesta
      next();
    } catch (err) {
      //console.error('Token verification error:', err); // Log dell'errore
      res.status(403).json({ rc: 1, msg: err.toString() });
    }
  } else {
    res.status(400).json({ rc: 1, msg: 'Missing token in request' });
  }
});

// Effettua il login con le credenziali fornite nel body della richiesta 
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    // connessione a mongodb
    await client.connect()
    // imposto il db in cui devo effettuare la query
    const db = client.db(config.MONGODB_DB)
    // cerco se esite già un utente con lo username che ho ricevuto
    const user = await db.collection('users').findOne({ username: username });
    // in caso non esiste rispondo alla richiesta indicando che l'utente non esiste
    if (!user) return res.status(404).json({ rc: 1, msg: `User ${username} not found` });
    
    // Controllo che la password fornita corrisponda a quella salvata nel database
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ rc: 1, msg: 'Invalid credentials' });
    
    // Genero un token e imposto una durata di validità (1 ora)
    const content = { username };
    const token = jwt.sign(content, config.TOKEN_SIGN_KEY, { expiresIn: '1h' });
    
    // Invio la risposta alla richiesta con il token
    res.status(200).json({ rc: 0, msg: 'Login successful', token: token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ rc: 1, msg: err.toString() });
  } finally {
    await client.close();
  }
})

// Creazione di un nuovo utente con le credenziali fornite nel body della richiesta
app.put('/addUser', async (req, res) => {
  try {
    // leggo i parametri (obbligatori) username, password e email ricevuti nel body della richiesta
    // apro la connessione a mongodb
    await client.connect()
    // controllo se esiste già un utente con lo stesso username e se esiste rispondo con un messaggio di errore adeguato
    // effettuo lo stesso controllo anche per il campo email
    // se supero i controlli precedenti allora posso inserire il nuovo utente nel database
    // effettua la insert sulla collection users e invia la risposta alla richiesta 
    res.status(201).send({ rc: 0, msg: `User ${username} added successfully` })
  } catch (err) {
    console.error(err);
    res.status(500).json({ rc: 1, msg: err.toString() });
  } finally {
    await client.close();
  }
});

// Aggiunta di un nuovo film con i dati forniti nel body della richiesta
app.post('/addFilm', async (req, res) => {
  const { title, director, year } = req.body;
  if (!title || !director || !year) {
    return res.status(400).json({ rc: 1, msg: 'Title, director e year are required' });
  }

  try {
    await client.connect();
    const db = client.db(config.MONGODB_DB);

    // Controlla se il titolo esiste già
    const existing = await db.collection('movies').findOne({ title });
    if (existing) {
      return res.status(409).json({ rc: 1, msg: `Movie with title ${title} already present` });
    }

    const newFilm = { title, director, year };
    await db.collection('movies').insertOne(newFilm);

    res.status(201).json({ rc: 0, msg: `Movie ${title} successfully added` });
  } catch (err) {
    res.status(500).json({ rc: 1, msg: 'Server error: ' + err.message });
  } finally {
    await client.close();
  }
});

app.get('/listMovies', async (req, res) => {
  try {
    const filters = req.query || {};
    await client.connect();
    const db = client.db(config.MONGODB_DB);
    let query = {};
    if (filters.title)
      query.title = { $regex: filters.title, $options: "i" };
    if (filters.director)
      query.director = { $regex: filters.director, $options: "i" };

    if (filters.year)
      query.year = parseInt(filters.year, 10);

    const movies = await db.collection('movies')
      .find(query)
      .sort({ _id: -1 })
      .limit(50)
      .toArray();

    res.status(200).json({ rc: 0, data: movies });

  } catch (err) {
    res.status(500).json({ rc: 1, msg: err.message });
  } finally {
    await client.close();
  }
});



// Attivazione web server in ascolto sulla porta indicata
app.listen(config.PORT, () => {
  console.log(`Movie Manager app listening on port ${config.PORT}`);
});