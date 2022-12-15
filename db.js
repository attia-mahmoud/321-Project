const mysql = require("mysql");

// Function for connecting to the MySQL database
function connect() {
  // Create a new MySQL connection instance
  const connection = mysql.createConnection({
    host: "localhost", // Hostname of the database server
    port: 3306, // port
    user: "test", // MySQL username
    password: "test123", // MySQL password
    database: "ics321", // Name of the database to connect to
  });

  // Connect to the database
  connection.connect((err) => {
    if (err) {
      console.error("Error connecting to the database:", err);
      return;
    }
    console.log("Successfully connected to the database.");
  });

  return connection;
}

// Function for executing a SQL query
function query(connection, sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) {
        console.error("Error executing SQL query:", err);
        reject(err);
        return;
      }
      resolve(results);
    });
  });
}

// Function for closing the database connection
function close(connection) {
  connection.end((err) => {
    if (err) {
      console.error("Error closing the database connection:", err);
      return;
    }
    console.log("Successfully closed the database connection.");
  });
}

module.exports = {
  connect,
  query,
  close,
};
