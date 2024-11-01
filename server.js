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
    console.log(`With params:` + params);
    let client = null;
    try {
        // client = await pool.connect();
        // console.log(`Client connected from pool`);
        // const result = await client.query(query, params);
        const result = await pool.query(query, params);
        console.log(`Results received ` + result.rows.length);
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
    let emoji = getHappyEmoji();
    console.log('Sending greeting ' + emoji);
    res.send('Have a nice day! '+ emoji);
});

app.get('/dow', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.dow');
});

app.get('/tod', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.tod');
});

app.get('/phases', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.phase');
});

app.get('/scenarios', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.scenario WHERE visible=TRUE');
});

app.get('/scenario_site', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.scenario_site');
});

app.get('/sites', async (req, res) => {
    await runQuery(res, 'SELECT *, st_astext(st_transform(polygon_geom, 4326)) as polygon_geom, st_astext(st_transform(point_geom, 4326)) as point_geom FROM sfs2.site');
});

app.get('/site_dow', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.scenario');
});

app.get('/site_transport_demand/:site/:scenario', async (req, res) => {
    const site = req.params.site;
    const scenario = req.params.scenario;
    await runQuery(res, 'SELECT * FROM sfs2.site_transport_demand WHERE fk_site_id=$1 AND fk_scenario_id=$2', [site, scenario]);
});

app.get('/site_transport_demands', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.site_transport_demand');
});

app.get('/site_truck_monitoring', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.site_truck_monitoring');
});

app.get('/site_truck_prediction', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.site_truck_prediction');
});

app.get('/site_route', async (req, res) => {
    await runQuery(res, 'SELECT link_id, st_astext(st_transform(geom, 4326)) as geom  FROM sfs2.site_route');
});

app.get('/sim_links', async (req, res) => {
    await runQuery(res, 'SELECT link_id, st_astext(st_transform(geom, 4326))  FROM sfs2.sim_links');
});

app.get('/sim_links_with_out/:scenario/:dow/:tod', async (req, res) => {
    const scenario = req.params.scenario;
    const dow = req.params.dow;
    const tod = req.params.tod;
    await runQuery(res,
        `SELECT
            sfs2.sim_links.link_id,
            st_astext(st_transform(st_offsetcurve(sfs2.sim_links.geom, 10), 4326)) as geom,
            sfs2.sim_out.from_node,
            sfs2.sim_out.to_node,
            sfs2.sim_out.scenario_id,
            sfs2.sim_out.tod_id,
            sfs2.sim_out.dow_id,
            sfs2.sim_out.tot_flow,
            sfs2.sim_out.truck_flow,
            sfs2.sim_out.mean_speed,
            sfs2.sim_out.mean_delay,
            sfs2.sim_out.tot_delay
        FROM sfs2.sim_links
        LEFT JOIN sfs2.sim_out ON sfs2.sim_links.link_id = sfs2.sim_out.link_id
        WHERE sfs2.sim_out.scenario_id = $1 AND sfs2.sim_out.dow_id = $2 AND sfs2.sim_out.tod_id = $3`, [scenario, dow, tod]
        );
});

app.get('/sim_links_with_out', async (req, res) => {
    await runQuery(res,
        `SELECT
            sfs.sim_links.link_id,
            st_astext(st_transform(sfs.sim_links.geom, 4326)),
            sfs.sim_out.scenario_id,
            sfs.sim_out.tod_id,
            sfs.sim_out.dow_id,
            sfs.sim_out.delay,
            sfs.sim_out.trucks
        FROM sfs.sim_links
        LEFT JOIN sfs.sim_out ON sfs.sim_links.link_id = sfs.sim_out.link_id`
        );
});

// app.get('/sim_out/:scenario/:linkId', async (req, res) => {
//     const scenario = req.params.scenario;
//     const linkId = req.params.linkId;
//     await runQuery(res, 'SELECT * FROM sfs.sim_out WHERE scenario_id=$1', [scenario, linkId]);
// });

app.get('/sim_out', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.sim_out');
});

app.get('/sim_out/:scenario/:dow/:tod', async (req, res) => {
    const scenario = req.params.scenario;
    const dow = req.params.dow;
    const tod = req.params.tod;
    await runQuery(res,
        `SELECT
            link_id,
            st_astext(st_transform(st_offsetcurve(geom, -5), 4326)) as geom,
            from_node,
            to_node,
            scenario_id,
            tod_id,
            dow_id,
            tot_flow,
            truck_flow,
            mean_speed,
            mean_delay,
            tot_delay
        FROM sfs2.sim_out
        WHERE scenario_id = $1 AND dow_id = $2 AND tod_id = $3`, [scenario, dow, tod]
        );
});

app.get('/sensors', async (req, res) => {
    await runQuery(res, 'SELECT sensor_id, name, description, st_astext(st_transform(geom, 4326)) as geom FROM sfs2.sensor_locations');
});

app.get('/particle_levels', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.particle_levels LIMIT 5000');
    // await runQuery(res, 'SELECT * FROM sfs_sensors.pm LIMIT 5000');
});

app.get('/particle_levels_for_sensor/:sensor_id', async (req, res) => {
    const sensor_id = req.params.sensor_id;
    await runQuery(res, 'SELECT * FROM sfs2.particle_levels WHERE sensor_id = $1', [sensor_id]);
});

app.get('/particle_levels_for_sensor_and_time/:sensor_id/:start/:end', async (req, res) => {
    const sensor_id = req.params.sensor_id;
    const start = req.params.start;
    const end = req.params.end;
    await runQuery(res, 'SELECT * FROM sfs2.particle_levels WHERE sensor_id = $1 AND time >= $2 AND time <= $3', [sensor_id, start, end]);
});

app.get('/sound_levels', async (req, res) => {
    await runQuery(res, 'SELECT * FROM sfs2.sound_levels LIMIT 5000');
});

app.get('/sound_levels_for_sensor/:sensor_id', async (req, res) => {
    const sensor_id = req.params.sensor_id;
    await runQuery(res, 'SELECT * FROM sfs2.sound_levels WHERE sensor_id = $1', [sensor_id]);
});

app.get('/sound_levels_for_sensor_and_time/:sensor_id/:start/:end', async (req, res) => {
    const sensor_id = req.params.sensor_id;
    const start = req.params.start;
    const end = req.params.end;
    await runQuery(res, 'SELECT * FROM sfs2.sound_levels WHERE sensor_id = $1 AND time >= $2 AND time <= $3', [sensor_id, start, end]);
});

app.get('/zones', async (req, res) => {
    await runQuery(res, 'SELECT zone_id, code, name, typeno, totbef, externzon, st_astext(st_transform(geom, 4326)) as geom, st_area(geom) as area FROM sfs2.zones WHERE geom is not null');
});

app.get('/pois', async (req, res) => {
    // await runQuery(res, 'SELECT id, name, amenity, st_astext(st_transform(geom, 4326)) as geom FROM sfs2.points_of_interest WHERE geom is not null');
    await runQuery(res, 'SELECT id, name, amenity, st_astext(st_transform(geom, 4326)) as geom FROM sfs2.schools WHERE geom is not null');
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