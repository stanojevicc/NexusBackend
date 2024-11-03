const express = require("express");
const app = express();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require('path');

const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
var https = require('https');
var http = require('http');
const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

const log = require("./structs/log.js");
const error = require("./structs/error.js");
const functions = require("./structs/functions.js");
const compression = require('compression');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;


if (!fs.existsSync("./ClientSettings")) fs.mkdirSync("./ClientSettings");

const whitelistedIPs = ['46.4.33.244', '2a02:4780:27:1523:0:f0e:a3d1:2', '2a02:4780:27:1523:0:f0e:a3d1:4', '77.111.247.54']; // Remplacez par vos adresses IP

global.JWT_SECRET = "VeryBigBlackGuy";
const PORT = 2096;

var options2 = {
    key: fs.readFileSync('keyna.key'),
    cert: fs.readFileSync('certna.cert')
};

// This line is from the Node.js HTTPS documentation.
var options = {
    key: fs.readFileSync('key.key'),
    cert: fs.readFileSync('cert.cert')
   
/*
    // SNI callback: select the correct certificate based on the hostname
    SNICallback: (domain, cb) => {
        // Define certificates for different domains
        const domainCerts = {
            'epstatic.online': {
                key: fs.readFileSync('key.key'),
                cert: fs.readFileSync('cert.cert'),
            },
            'dev.epstatic.online': {
                key: fs.readFileSync('key.key'),
                cert: fs.readFileSync('cert.cert'),
            },
            'e.nafn.xyz': {
                key: fs.readFileSync('keyna.key'),
                cert: fs.readFileSync('certna.cert'),
            },
            'nafn.xyz': {
                key: fs.readFileSync('keyna.key'),
                cert: fs.readFileSync('certna.cert'),
            },
        };

        // Select certificate based on domain
        const cert = domainCerts[domain];

        if (cert) {
            cb(null, https.createSecureContext(cert));
        } else {
            // Use default certificate if no specific cert is found
            cb(null, https.createSecureContext(options));
        }
    },*/
};


const tokens = JSON.parse(fs.readFileSync("./tokenManager/tokens.json").toString());

for (let tokenType in tokens) {
    for (let tokenIndex in tokens[tokenType]) {
        let decodedToken = jwt.decode(tokens[tokenType][tokenIndex].token.replace("eg1~", ""));

        if (DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime() <= new Date().getTime()) {
            tokens[tokenType].splice(Number(tokenIndex), 1);
        }
    }
}

fs.writeFileSync("./tokenManager/tokens.json", JSON.stringify(tokens, null, 2));

global.accessTokens = tokens.accessTokens;
global.refreshTokens = tokens.refreshTokens;
global.clientTokens = tokens.clientTokens;
/*
global.accessTokens =  [];
global.refreshTokens = [];
global.clientTokens =  [];*/

global.exchangeCodes = [];

mongoose.connect(config.mongodb.database, () => {
    log.backend("App successfully connected to MongoDB!");
});

mongoose.connection.on("error", err => {
    log.error("MongoDB failed to connect, please make sure you have MongoDB installed and running.");
    throw err;
});

const limiter2 = rateLimit({
    //  windowMs: 0.5 * 60 * 1000, // 30 secondes
    windowMs: 5 * 60 * 1000, // 1 minutes
    max: 460,
    skip: (request, response) => {
        return whitelistedIPs.includes(request.ip);
    },
    handler: (request, response, next, options) => {
        return response.status(options.statusCode).json({
            message: 'Rate limited retry in few minutes.',
            status: options.statusCode,
            retryAfter: options.windowMs / 1000 // temps en secondes
        });
    }
});



//app.use(limiter);
app.use(limiter2);
//app.use(rateLimit({ windowMs: 0.5 * 60 * 1000, max: 80 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//app.use(compression());
app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))


// Get the list of files in the directory
fs.readdirSync("./routes").forEach(fileName => {
    //  console.log(fileName);

    // Check if the file has a .js extension
    if (path.extname(fileName) === '.js') {
        const filePath = `./routes/${fileName}`;
        // Check if the file exists
        if (fs.existsSync(filePath)) {
            // Require the file if it exists
            app.use(require(filePath));
        } else {
            console.error(`File ${filePath} does not exist.`);
        }
    }
});
/*
if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
*/

const testserver = https.createServer(options, function (req, res) {
    app.handle(req, res);
    testserver.timeout = 7000; // Timeout de 5 secondes
}).listen(PORT, () => {
    log.backend(`App started listening on port ${PORT}`);

     require("./xmpp/xmpp.js");
    //   require("./DiscordBot");
}).on("error", async (err) => {
    if (err.code == "EADDRINUSE") {
        log.error(`Port ${PORT} is already in use!\nClosing in 3 seconds...`);
        await functions.sleep(3000)
        process.exit(0);
    } else throw err;
});
//}
/*
https.createServer(options2, function (req, res) {
    app.handle(req, res);
}).listen(443, () => {
    log.backend(`App started listening on port ${443}`);

    // require("./xmpp/xmpp.js");
    //   require("./DiscordBot");
}).on("error", async (err) => {
    if (err.code == "EADDRINUSE") {
        log.error(`Port ${443} is already in use!\nClosing in 3 seconds...`);
        await functions.sleep(3000)
        process.exit(0);
    } else throw err;
});
//}*/

// if endpoint not found, return this error
app.use((req, res, next) => {
    error.createError(
        "errors.com.epicgames.common.not_found",
        "Sorry the resource you were trying to find could not be found",
        undefined, 1004, undefined, 404, res
    );
});

function DateAddHours(pdate, number) {
    let date = pdate;
    date.setHours(date.getHours() + number);

    return date;
}
