const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Jrv2r4nxh!',
  authPlugin: 'mysql_native_password'
});

connection.connect(function(err) {
  if (err) {
    console.error('Error connecting:', err);
    return;
  }
  console.log('Connected successfully!');
  connection.end();
});