const sqlite3 = require('sqlite3').verbose();
const config = require('./config');
const { createApp } = require('./app');
const { bootstrapDatabase } = require('./lib/bootstrap-db');

const db = new sqlite3.Database(config.databasePath, async (err) => {
    if (err) {
        console.error('No fue posible conectar con SQLite:', err.message);
        process.exitCode = 1;
    } else {
        try {
            await bootstrapDatabase(db);
        } catch (bootstrapError) {
            console.error('No fue posible preparar la base de datos:', bootstrapError.message);
            process.exitCode = 1;
            db.close();
            return;
        }
        const app = createApp(db);
        const server = app.listen(config.port, () => {
            console.log(`Comet Movies API Beta disponible en http://localhost:${config.port}`);
        });
        const shutdown = () => server.close(() => db.close());
        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    }
});
