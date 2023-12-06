const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");


const db = mysql.createPool({
  connectionLimit: 10, // Adjust the limit based on your needs
  host: "154.41.240.230",
  user: "u532639681_root",
  password: "W@2915djkq#",
  database: "u532639681_mydatabase"
});

// The pool will emit a connection event when a new connection is made
db.on('connection', (connection) => {
  console.log('New connection made to the database');
});

// The pool will emit an error event if a connection cannot be made
db.on('error', (err) => {
  console.error('Error in MySQL connection pool:', err);
});
const app = express();
app.use(bodyParser.json({ limit: "200mb" }));

// Serve static files from the root directory
app.use(express.static("./"));

// Optional: Default route to serve index.html
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: "." });
});

// Check database connection status
app.get("/api/check-connection", (req, res) => {
  if (db.state === 'disconnected') {
    res.json({ connected: false });
  } else {
    res.json({ connected: true });
  }
});

app.post("/api/check", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
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
        res.json({ exists: true, algResults: algResultsObject });
      } else {
        res.json({ exists: false });
      }
    }
  );
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
      res.send({ message: "Data saved successfully", id: results.insertId });
    }
  );
});


app.delete("/api/delete-directions", (req, res) => {
  const { sourceCoordinates, destCoordinates } = req.body;
  db.query(
    "DELETE FROM genetic_data1 WHERE sourceCoordinates = ? AND destCoordinates = ?",
    [
      JSON.stringify(sourceCoordinates),
      JSON.stringify(destCoordinates),
    ],
    function (err) {
      if (err) {
        console.error(err);
        res.status(500).send("Error deleting directions from the database");
        return;
      }
      res.status(200).send({ message: "Data deleted successfully" });
    }
  );
});



app.listen(3000, () => console.log("Server running on port 3000"));
