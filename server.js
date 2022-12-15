const express = require("express");
const { connect, query, close } = require("./db");
const db = require("./db");
const nodemailer = require("nodemailer");
var bodyParser = require("body-parser");

// Create a new express server
const app = express();

// Middleware for parsing the request body
app.use(express.json());

// Middleware for handling sessions and cookies
app.use(require("cookie-parser")());
app.use(
  require("express-session")({
    secret: "SECRET",
    resave: false,
    saveUninitialized: false,
  })
);

// create application/x-www-form-urlencoded parser
var urlencodedParser = bodyParser.urlencoded({ extended: false });
// Middleware for verifying the user's identity
function verifyUser(req, res, next) {
  if (req.session && req.session.user) {
    // User is logged in, proceed to the next middleware
    next();
  } else {
    // User is not logged in, return an error
    res.status(401).send({ error: "Unauthorized" });
  }
}
app.get("/", (req, res) => {
  // Render the 'index' template with the default locals
  res.render("index");
});

// Route for searching for a package
app.post("/search", (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to search for a package
  query(connection, "SELECT * FROM shipped_package WHERE package_number = ?", [
    req.query.number,
  ])
    .then((results) => {
      // Return the search results to the customer
      res.send({ results });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});

// Route for adding a package
app.post("/packages", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to insert the package data into the database
  query(
    connection,
    "INSERT INTO shipped_Package (package_number, weight, height, insurance_amount, destination, final_date,length,width,type,owned_by,package_status,received_by) VALUES (?, ?, ?, ?, ?, ?,?,?,?,?,?,?)",
    [
      req.body.number,
      req.body.weight,
      req.body.height,
      req.body.insurance,
      req.body.destination,
      req.body.date,
      req.body.length,
      req.body.width,
      req.body.type,
      1,
      req.body.status,
      req.body.received_by,
    ]
  )
    .then(() => {
      // Return a success message if the query was successful
      res.send({ message: "Package added successfully." });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});

// Route for removing a package
app.delete("/packages/:number", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to delete the package with the specified package number
  query(connection, "DELETE FROM shipped_Package WHERE package_number = ?", [
    req.params.number,
  ])
    .then(() => {
      // Return a success message if the query was successful
      res.send({ message: "Package deleted successfully." });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});

// Route for updating a package
app.put("/packages/:number", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to update the package data
  query(
    connection,
    "UPDATE shipped_Package SET weight = ?, dimensions = ?, insurance_amount = ?, destination = ?, final_delivery_date = ? WHERE package_number = ?",
    [
      req.body.weight,
      req.body.dimensions,
      req.body.insurance,
      req.body.destination,
      req.body.date,
      req.params.number,
    ]
  )
    .then(() => {
      // Return a success message if the query was successful
      res.send({ message: "Package updated successfully." });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});
// Route for updating a user
app.put("/users/:id", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to update the user data
  query(connection, "UPDATE Users SET name = ?, email = ? WHERE id = ?", [
    req.body.name,
    req.body.email,
    req.params.id,
  ])
    .then(() => {
      // Return a success message if the query was successful
      res.send({ message: "User updated successfully." });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});
// Route for generating a report of lost or delayed packages between two dates
app.get("/report", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to retrieve the lost or delayed packages between two dates
  query(
    connection,
    "SELECT * FROM shipped_Package WHERE (package_status = ?) AND Final_Date BETWEEN ? AND ?",
    [req.query.status, req.query.start, req.query.end]
  )
    .then((results) => {
      // Return the results to the user
      res.render("report.pug", { results });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});
// Route for tracing back a package
app.get("/trace/:number", verifyUser, (req, res) => {
  // Connect to the database
  const connection = connect();

  // Execute a SQL query to retrieve the movement history of the package
  query(
    connection,
    "SELECT * FROM package_locations WHERE package_number = ?",
    [req.params.number]
  )
    .then((results) => {
      // Return the results to the user
      res.send({ results });
    })
    .catch((err) => {
      // Return an error if the query failed
      res.status(500).send({ error: err.message });
    })
    .finally(() => {
      // Close the database connection
      close(connection);
    });
});
// Route for sending a notification
app.post("/notify", verifyUser, (req, res) => {
  // Send the notification to the specified recipient
  sendNotification(req.body.to, req.body.message)
    .then(() => {
      // Return a success message if the notification was sent successfully
      res.send({ message: "Notification sent successfully." });
    })
    .catch((err) => {
      // Return an error if the notification failed to send
      res.status(500).send({ error: err.message });
    });
  res.redirect("/packages/" + req.query.number);
});

// Function for sending a notification
function sendNotification(user, subject, message) {
  // Create a transporter object for sending emails
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "your-email-address@gmail.com",
      pass: "your-password",
    },
  });

  // Create the email options
  const mailOptions = {
    from: "your-email-address@gmail.com",
    to: user.email,
    subject: subject,
    text: message,
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
    } else {
      console.log(`Email sent: ${info.response}`);
    }
  });
}
// Middleware for rendering Pug templates
app.set("views", "./views");
app.set("view engine", "pug");
const cookieParser = require("cookie-parser");
// Parse the cookies in the request header
app.use(cookieParser());

// Route for the login page
app.get("/login", (req, res) => {
  // Check if the user is already logged in
  if (req.cookies.user) {
    // Redirect the user to the home page
    res.redirect("/");
  } else {
    // Render the login template
    res.render("login");
  }
});
// Route for handling the login form submission
app.post("/login", urlencodedParser, (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Execute a SQL query to retrieve the user with the specified email and password
  db.query(connection, "SELECT * FROM Users WHERE email = ? AND password = ?", [
    req.body.email,
    req.body.password,
  ])
    .then((results) => {
      // Check if the user was found
      if (results.length > 0) {
        console.log("here");
        // Set a cookie with the user's information
        res.cookie("user", {
          id: results[0].id,
          name: results[0].name,
          email: results[0].email,
        });

        // Redirect the user to the home page
        res.redirect("/");
      } else {
        // Render the login template with an error message
        res.render("login", { error: "Invalid email or password." });
      }
    })
    .catch((error) => {
      // Render the login template with an error message
      res.render("login", { error: error.message });
    });
});

// Route for the logout page
app.get("/logout", (req, res) => {
  // Clear the user's cookie
  res.clearCookie("user");

  // Redirect the user to the login page
  res.redirect("/login");
});

function verifyUser(req, res, next) {
  // Check if the user is authenticated
  if (req.cookies.user) {
    // Add the user's information to the request object
    req.user = req.cookies.user;

    // Call the next middleware function
    next();
  } else {
    // Redirect the user to the login page
    res.redirect("/login");
  }
}

// Route for the package search page
app.get("/search", verifyUser, (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Create the SQL query to search for packages
  let query = "SELECT * FROM shipped_package WHERE 1 = 1";
  let values = [];

  // Add the search criteria to the query
  if (req.query.number) {
    query += " AND package_number = ?";
    values.push(req.query.number);
  }
  if (req.query.category) {
    query += " AND type = ?";
    values.push(req.query.type);
  }
  if (req.query.date) {
    query += " AND final_date = ?";
    values.push(req.query.date);
  }

  // Execute the SQL query to search for packages
  db.query(connection, query, values)
    .then((results) => {
      // Render the search results template with the search results
      res.render("search-results", { packages: results });
    })
    .catch((error) => {
      // Render the search results template with an error message
      res.render("search-results", { error: error.message });
    });
});
// Route for the package update page
app.get("/packages/:number/update", verifyUser, (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Execute a SQL query to retrieve the package with the specified package number
  db.query(
    connection,
    "SELECT * FROM shipped_package WHERE package_number = ?",
    [req.params.number]
  )
    .then((results) => {
      // Check if the package was found
      if (results.length > 0) {
        // Render the update page template with the package information
        res.render("package-update", { package: results[0] });
      } else {
        // Redirect the user to the home page
        res.redirect("/");
      }
    })
    .catch((error) => {
      // Redirect the user to the home page
      res.redirect("/");
    });
});

// Route for handling the package update form submission
app.post("/packages/:number/update", verifyUser, (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Execute a SQL query to update the package information
  db.query(
    connection,
    "UPDATE shipped_package SET weight = ?, height = ?, insurance_amount = ?, destination = ?, final_date = ? WHERE package_number = ?",
    [
      req.body.weight,
      req.body.height,
      req.body.insurance,
      req.body.destination,
      req.body.date,
      req.params.number,
    ]
  )
    .then(() => {
      // Redirect the user to the package update page
      res.redirect("/packages/" + req.params.number);
    })
    .catch((error) => {
      // Redirect the user to the package update page with an error message
      res.redirect(
        "/packages/" +
          req.params.number +
          "?error=" +
          encodeURIComponent(error.message)
      );
    });
});

app.post("/report", (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Create the SQL query to generate the report
  let query = "SELECT * FROM shipped_package WHERE 1 = 1";
  let values = [];

  // Add the report criteria to the query
  if (req.query.startDate) {
    query += " AND final_date >= ?";
    values.push(req.query.start);
  }
  if (req.query.endDate) {
    query += " AND final_date <= ?";
    values.push(req.query.end);
  }
  if (req.query.type) {
    query += " AND type = ?";
    values.push(req.query.type);
  }
  if (req.query.status) {
    query += " AND package_status = ?";
    values.push(req.query.status);
  }
  // Execute the SQL query to generate the report
  db.query(connection, query, values)
    .then((results) => {
      // Calculate the total number of packages
      const total = results.length;

      // Calculate the total weight of the packages
      const totalWeight = results.reduce(
        (sum, package) => sum + package.weight,
        0
      );

      // Calculate the total insurance amount of the packages
      const totalInsurance = results.reduce(
        (sum, package) => sum + package.insurance_amount,
        0
      );

      // Calculate the total value of the packages
      const totalValue = results.reduce(
        (sum, package) => sum + package.value,
        0
      );

      // Calculate the total cost of the packages
      const totalCost = results.reduce((sum, package) => sum + package.cost, 0);

      // Calculate the total fines for delayed packages
      const totalFines = results
        .filter((package) => package.status === "delayed")
        .reduce((sum, package) => sum + package.fines, 0);

      // Render the report generation template with the report results

      res.render("report-results", {
        results,
      });
    })
    .catch((error) => {
      // Render the report generation template with an error message
      res.render("report-results", { error: error.message });
    });
});
// Route for handling the notification form submission
app.post("/notifications", verifyUser, (req, res) => {
  // Connect to the database
  const connection = db.connect();

  // Execute a SQL query to retrieve the user with the specified email address
  db.query(connection, "SELECT * FROM Users WHERE email = ?", [req.body.email])
    .then((results) => {
      // Check if the user was found
      if (results.length > 0) {
        // Retrieve the user information
        const user = results[0];

        // Send the notification email
        sendNotification(user, req.body.message);

        // Redirect the user to the home page
        res.redirect("/");
      } else {
        // Redirect the user to the home page with an error message
        res.redirect(
          "/?error=" +
            encodeURIComponent(
              "The user with the specified email address was not found"
            )
        );
      }
    })
    .catch((error) => {
      // Redirect the user to the home page with an error message
      res.redirect("/?error=" + encodeURIComponent(error.message));
    });
});

// Function to send a notification email to the specified user
function sendNotification(user, message) {
  // Create the email message
  const email = {
    from: "Package Delivery System <no-reply@package-delivery.com>",
    to: user.name + " <" + user.email + ">",
    subject: "Notification from Package Delivery System",
    text: message,
  };

  // Send the email message
  mailer.send(email);
}

// Start the server on port 5000
app.listen(5000, () => {
  console.log("Server started on port 5000.");
});
