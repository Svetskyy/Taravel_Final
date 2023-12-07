const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const zlib = require("zlib");
const NodeCache = require("node-cache");

const cache = new NodeCache({ stdTTL: 3600 }); // Set expiration time to 1 hour

const db = mysql.createPool({
  connectionLimit: 100,
  host: "154.41.240.230",
  user: "u532639681_root",
  password: "W@2915djkq#",
  database: "u532639681_mydatabase",
  compress: true, // Enable compression
  stream: function (options, callback) {
    return zlib.createGzip(options, callback);
  },
});

db.on('connection', (connection) => {
  console.log('New connection made to the database');
});

db.on('error', (err) => {
  console.error('Error in MySQL connection pool:', err);
});

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.use(express.static("./"));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "." });
});

app.get("/api/check-connection", (req, res) => {
  if (db.state === 'disconnected') {
    res.json({ connected: false });
  } else {
    res.json({ connected: true });
  }
});

app.post("/api/check", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;

  const cacheKey = `${JSON.stringify(sourceCoordinates)}_${JSON.stringify(destCoordinates)}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    const algResultsObject = JSON.parse(cachedResult);
    res.json({ exists: true, algResults: algResultsObject });
  } else {
    db.query(
      "SELECT algResults FROM genetic_data1 WHERE sourceCoordinates = ? AND destCoordinates = ?",
      [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
      (err, results) => {
        if (err) {
          res.status(500).send("Database error");
          return;
        }

        if (results.length > 0) {
          const algResultsObject = JSON.parse(results[0].algResults);
          cache.set(cacheKey, JSON.stringify(algResultsObject));
          res.json({ exists: true, algResults: algResultsObject });
        } else {
          res.json({ exists: false });
        }
      }
    );
  }
});

app.post("/api/save-result", (req, res) => {
  const { sourceCoordinates, destCoordinates, algResults } = req.body;

  db.query(
    "INSERT INTO genetic_data1 (sourceCoordinates, destCoordinates, algResults) VALUES (?, ?, ?)",
    [
      JSON.stringify(sourceCoordinates),
      JSON.stringify(destCoordinates),
      JSON.stringify(algResults),
    ],
    (err, results) => {
      if (err) {
        res.status(500).send("Error saving to database");
        return;
      }

      const cacheKey = `${JSON.stringify(sourceCoordinates)}_${JSON.stringify(destCoordinates)}`;
      cache.set(cacheKey, JSON.stringify(algResults));

      // Log cache content after saving
      const cacheStats = cache.getStats();
      console.log("Cache Stats after saving:", cacheStats);

      res.send({ message: "Data saved successfully", id: results.insertId });
    }
  );
});


app.delete("/api/delete-directions", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  const cacheKey = `${JSON.stringify(sourceCoordinates)}_${JSON.stringify(destCoordinates)}`;
  
  db.query(
    "DELETE FROM genetic_data1 WHERE sourceCoordinates = ? AND destCoordinates = ?",
    [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send("Error deleting directions from the database");
        return;
      }
      
      // Remove from cache upon deletion
      cache.del(cacheKey);
      
      res.status(200).send({ message: "Data deleted successfully" });
    }
  );
});

app.listen(3000, () => console.log("Server running on port 3000"));
