const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./users.db');

db.all('SELECT email FROM users', [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log('--- REGISTERED USERS ---');
        rows.forEach(row => console.log(row.email));
        console.log('------------------------');
    }
    db.close();
});
