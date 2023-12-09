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

app.post("/api/check", async (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  const cacheKey = `${JSON.stringify(sourceCoordinates)}_${JSON.stringify(destCoordinates)}`;

  try {
    // Check if data is in the cache
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      const algResultsObject = JSON.parse(cachedResult);

      console.log("Data retrieved from cache");

      // Check if data is in the database
      const dbResult = await new Promise((resolve, reject) => {
        db.query(
          "SELECT algResults FROM genetic_data2 WHERE sourceCoordinates = ? AND destCoordinates = ?",
          [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
          (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(results);
          }
        );
      });

      if (dbResult.length > 0) {
        console.log("Data exists in database");
        res.json({ exists: true, algResults: algResultsObject });
      } else {
        // Data is in cache but not in the database, save to database
        console.log("Data not in database, saving from cache to database");
        db.query(
          "INSERT INTO genetic_data2 (sourceCoordinates, destCoordinates, algResults) VALUES (?, ?, ?)",
          [
            JSON.stringify(sourceCoordinates),
            JSON.stringify(destCoordinates),
            JSON.stringify(algResultsObject),
          ],
          (err, results) => {
            if (err) {
              console.error("Error saving to database:", err);
              res.status(500).send("Error saving to database");
              return;
            }

            console.log("Data saved to database from cache");
            res.json({ exists: true, algResults: algResultsObject });
          }
        );
      }
    } else {
      // Data not in cache, check in the database
      const dbResult = await new Promise((resolve, reject) => {
        db.query(
          "SELECT algResults FROM genetic_data2 WHERE sourceCoordinates = ? AND destCoordinates = ?",
          [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
          (err, results) => {
            if (err) {
              reject(err);
              return;
            }

            resolve(results);
          }
        );
      });

      if (dbResult.length > 0) {
        const algResultsObject = JSON.parse(dbResult[0].algResults);

        // Update the cache with data from the database
        cache.set(cacheKey, JSON.stringify(algResultsObject));

        console.log("Data retrieved from database and saved to cache");
        res.json({ exists: true, algResults: algResultsObject });
      } else {
        console.log("Data does not exist in cache or database");
        res.json({ exists: false });
      }
    }
  } catch (error) {
    console.error("Error checking data:", error);
    res.status(500).send("Error checking data");
  }
});


app.post("/api/save-result", async (req, res) => {
  const { sourceCoordinates, destCoordinates, algResults } = req.body;

  // Check if data already exists in the database
  const existingData = await new Promise((resolve, reject) => {
    db.query(
      "SELECT COUNT(*) as count FROM genetic_data2 WHERE sourceCoordinates = ? AND destCoordinates = ?",
      [JSON.stringify(sourceCoordinates), JSON.stringify(destCoordinates)],
      (err, results) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(results[0].count);
      }
    );
  });

  if (existingData === 0) {
    // Data doesn't exist in the database, save it
    db.query(
      "INSERT INTO genetic_data2 (sourceCoordinates, destCoordinates, algResults) VALUES (?, ?, ?)",
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

        console.log("Data saved to database and cache");
        res.send({ message: "Data saved successfully", id: results.insertId });
      }
    );
  } else {
    console.log("Data already exists in the database");
    res.send({ message: "Data already exists in the database" });
  }
});




app.delete("/api/delete-directions", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  const cacheKey = `${JSON.stringify(sourceCoordinates)}_${JSON.stringify(destCoordinates)}`;
  
  db.query(
    "DELETE FROM genetic_data2 WHERE sourceCoordinates = ? AND destCoordinates = ?",
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