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
    try {
        await mySimpleTunnel(sshOptions, dbConfig.port);
        pool = new Pool(dbConfig);
    } catch (error) {
        console.error('Error connecting to database: ', err.stack);
    }
}

async function runQuery(res, query, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(query, params);
        res.send(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    } finally {
        client.release();
    }
}

app.get('/', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.dow LIMIT 100');
});

app.get('/dow', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.dow LIMIT 100');
});

app.get('/scenarios', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.scenario LIMIT 100');
});

app.get('/sites', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.site LIMIT 100');
});

app.get('/site_transport_demand/:site/:scenario', async (req, res) => {
    const site = req.params.site;
    const scenario = req.params.scenario;
    await runQuery(res, 'SELECT * FROM sfs.site_transport_demand WHERE fk_site_id=$1 AND fk_scenario_id=$2 LIMIT 100', [site, scenario]);
});

app.get('/sim_links', async (req, res) => {
    await runQuery(res, 'SELECT st_astext(st_transform(geom, 4326))  FROM sfs.sim_links LIMIT 100');
});



app.listen(port, async () => {
    await connectDatabase();
    console.log(`App listening at http://localhost:${port}`);
});