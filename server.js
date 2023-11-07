const express = require('express');
const { Pool } = require('pg');
const { createTunnel } = require('tunnel-ssh');
require('dotenv').config();

const app = express();
const port = 8080;

const sshOptions = {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT,
    username: process.env.SSH_USERNAME,
    password: process.env.SSH_PASSWORD
};

const dbConfig = {
    host: 'localhost',
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
};

async function mySimpleTunnel(sshOptions, port, autoClose = true){
    let forwardOptions = {
        srcAddr:'127.0.0.1',
        srcPort:port,
        dstAddr: process.env.DESTINATION_IP,
        dstPort: process.env.DESTINATION_PORT
    }

    let tunnelOptions = {
        autoClose:autoClose
    }
    
    let serverOptions = {
        port: port
    }

    return createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
}

let pool

async function connectDatabase(query) {
  await mySimpleTunnel(sshOptions, dbConfig.port);
  pool = new Pool(dbConfig);
}

async function runQuery(query) {
    return await pool.query(query);
}

app.get('/', async (req, res) => {
    const result = await runQuery('SELECT * FROM sfs.dow LIMIT 100');
    res.send(result.rows);
});

app.get('/dow', async (req, res) => {
    const result = await runQuery('SELECT * FROM sfs.dow LIMIT 100');
    res.send(result.rows);
});

app.get('/scenario', async (req, res) => {
    const result = await runQuery('SELECT * FROM sfs.scenario LIMIT 100');
    res.send(result.rows);
});

app.get('/sim_links', async (req, res) => {
    const result = await runQuery('SELECT st_astext(st_transform(geom, 4326))  FROM sfs.sim_links LIMIT 100');
    res.send(result.rows);
});



app.listen(port, () => {
    connectDatabase();
    console.log(`App listening at http://localhost:${port}`);
});