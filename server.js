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
    password: process.env.SSH_PASSWORD,
    keepAlive: true,
    autoClose: false
};

const dbConfig = {
    // host: 'localhost',
    host: '127.0.0.1',
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
        autoClose:false
    }
    
    let serverOptions = {
        port: port
    }

    let [server, conn] = await createTunnel(tunnelOptions, serverOptions, sshOptions, forwardOptions);
    server.on('connection', (connection) =>{
        console.log('Server made a connection');
    });
    return [server, conn]
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
    console.log(`Running query:` + query);
    let client = null;
    try {
        // client = await pool.connect();
        // console.log(`Client connected from pool`);
        // const result = await client.query(query, params);
        const result = await pool.query(query, params);
        console.log(`Results received`);
        res.send(result.rows);
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Server error');
    } finally {
        if(client) {
            console.log(`Releasing client`);
            client.release();
        }
    }
}

// allow cross origin requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'content-type');
    next();
});

app.get('/', async (req, res) => {
    console.log('Sending greeting.');
    res.send('Have a nice day! '+getHappyEmoji());
});

app.get('/dow', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.dow');
});

app.get('/tod', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.tod');
});

app.get('/scenarios', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.scenario');
});

app.get('/sites', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.site');
});

app.get('/scenario_site', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.scenario_site');
});

app.get('/site_transport_demand/:site/:scenario', async (req, res) => {
    const site = req.params.site;
    const scenario = req.params.scenario;
    await runQuery(res, 'SELECT * FROM sfs.site_transport_demand WHERE fk_site_id=$1 AND fk_scenario_id=$2', [site, scenario]);
});

app.get('/site_transport_demands', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs.site_transport_demand');
});

app.get('/sim_links', async (req, res) => {
    await runQuery(res, 'SELECT link_id, st_astext(st_transform(geom, 4326))  FROM sfs.sim_links');
});

app.get('/sim_out/:scenario', async (req, res) => {
    const scenario = req.params.scenario;
    await runQuery(res, 'SELECT * FROM sfs.sim_out WHERE scenario_id=$1', [scenario]);
});

const happyEmojis = ['🌞', '✨', '🌼', '🤸‍♂️', '☕', '🐶', '🍌', '🤠', '🤓', '👽', '🦄', '🦚'];

function getHappyEmoji() {
    return happyEmojis[Math.floor(Math.random()*happyEmojis.length)];
}

app.listen(port, async () => {
    if (process.env.ENABLED != 1) {
        console.log('Server not enabled in env settings. Bye bye for now! 👋')
        process.exit(0)
    }
    await connectDatabase();
    console.log(`App listening at http://localhost:${port} ` + getHappyEmoji());
});