const express = require("express");
const app = express.Router();
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { cacheit, cacheSet, cacheGet} = require("../model/Utils.js");
const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");
const functions = require("../structs/functions.js");

let seasons = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];


const limiter1 = rateLimit({
    //  windowMs: 0.5 * 60 * 1000, // 30 secondes
    windowMs: 10 * 60 * 1000, // 1 minutes
    max: 10,
    handler: (request, response, next, options) => {
        return response.status(options.statusCode).json({
            message: 'Rate limited retry in few minutes.',
            status: options.statusCode,
            retryAfter: options.windowMs / 1000 // temps en secondes
        });
    }
});


app.get("/fortnite/api/cloudstorage/system", (req, res) => {
    
    const key_json = "CloudFilesOk_Cache";
    let EventsInfosJSON = cacheGet(key_json);
    if (EventsInfosJSON) {
        return res.status(200).json(EventsInfosJSON.body);
    }

    const dir = path.join(__dirname, "..", "CloudStorage");

    let CloudFiles = [];

    fs.readdirSync(dir).forEach(name => {
        if (name.toLowerCase().endsWith(".ini")) {
            const ParsedFile = fs.readFileSync(path.join(dir, name)).toString();
            const ParsedStats = fs.statSync(path.join(dir, name));

            CloudFiles.push({
                "uniqueFilename": name,
                "filename": name,
                "hash": crypto.createHash('sha1').update(ParsedFile).digest('hex'),
                "hash256": crypto.createHash('sha256').update(ParsedFile).digest('hex'),
                "length": ParsedFile.length,
                "contentType": "application/octet-stream",
                "uploaded": ParsedStats.mtime,
                "storageType": "S3",
                "storageIds": {},
                "doNotCache": true
            });
        }
    });

    cacheSet(key_json, { status: 200, body: CloudFiles }, 300);
    return res.json(CloudFiles);

});

app.get("/fortnite/api/cloudstorage/system/:file", cacheit(300), (req, res) => {
    const file = path.join(__dirname, "..", "CloudStorage", req.params.file);

    if (fs.existsSync(file)) return res.status(200).send(fs.readFileSync(file));

    res.status(200).end();
});

app.get("/fortnite/api/cloudstorage/user/*/:file", verifyToken, (req, res) => {
   // console.log("here one two two ");
    let clientSettingsPath = path.join(__dirname, "..", "ClientSettings", req.user.accountId);
    if (!fs.existsSync(clientSettingsPath)) fs.mkdirSync(clientSettingsPath);

    try {
        const memory = functions.GetVersionInfo(req);
        let Prefix = "";
        if (memory.Plateform.includes("Android"))
            Prefix = "Android";

        const FinalName = "ClientSettings" + Prefix;

        //if (req.params.file.toLowerCase() != "clientsettings.sav") return res.status(200).end();

        // const memory = functions.GetVersionInfo(req);
        if (!seasons.includes(memory.season)) return res.status(200).end();

        let file = path.join(clientSettingsPath, `${FinalName}-${memory.season}.Sav`);

        if (fs.existsSync(file)) return res.status(200).send(fs.readFileSync(file));
    }
    catch (e) {
        console.log(e);
    }
    res.status(200).end();
});

app.get("/fortnite/api/cloudstorage/user/:accountId", verifyToken, (req, res) => {

    try {
        const memory = functions.GetVersionInfo(req);

        let Prefix = "";
        if (memory.Plateform.includes("Android"))
            Prefix = "Android";

        const FinalName = "ClientSettings" + Prefix;
        // console.log("mdr: 3" + FinalName);

        let clientSettingsPath = path.join(__dirname, "..", "ClientSettings", req.user.accountId);
        if (!fs.existsSync(clientSettingsPath)) fs.mkdirSync(clientSettingsPath);

        if (!seasons.includes(memory.season)) return res.json([]);

        let file = path.join(clientSettingsPath, `${FinalName}-${memory.season}.Sav`);

        if (fs.existsSync(file)) {
            const ParsedFile = fs.readFileSync(file, 'latin1');
            const ParsedStats = fs.statSync(file);

            //  console.log(file);
            return res.json([{
                "uniqueFilename": FinalName + ".Sav",
                "filename": FinalName + ".Sav",
                "hash": crypto.createHash('sha1').update(ParsedFile).digest('hex'),
                "hash256": crypto.createHash('sha256').update(ParsedFile).digest('hex'),
                "length": Buffer.byteLength(ParsedFile),
                "contentType": "application/octet-stream",
                "uploaded": ParsedStats.mtime,
                "storageType": "S3",
                "storageIds": {},
                "accountId": req.user.accountId,
                "doNotCache": false
            }]);
        }
    }
    catch (e) {
        console.log(e);
    }

    res.json([]);
});

app.put("/fortnite/api/cloudstorage/user/*/:file", verifyToken, getRawBody, limiter1, (req, res) => {
    if (Buffer.byteLength(req.rawBody) >= 400000) return res.status(403).json({ "error": "File size must be less than 400kb." });

    let clientSettingsPath = path.join(__dirname, "..", "ClientSettings", req.user.accountId);
    if (!fs.existsSync(clientSettingsPath)) fs.mkdirSync(clientSettingsPath);

    try {

        if (!req.params.file.toLowerCase().includes(".sav"))
            return res.status(204).end();

        // console.log(req.params.file);
        // if (req.params.file.toLowerCase() != "clientsettings.sav" || req.params.file.toLowerCase() != "clientsettingsandroid.sav") return res.status(204).end();

        const memory = functions.GetVersionInfo(req);
        if (!seasons.includes(memory.season)) return res.status(204).end();

        if (req.params.file.toLowerCase().includes("android")) {
        //    console.log("An Android");

            let file = path.join(clientSettingsPath, `ClientSettingsAndroid-${memory.season}.Sav`);
            fs.writeFileSync(file, req.rawBody, 'latin1');
        }
        else {
            let file = path.join(clientSettingsPath, `ClientSettings-${memory.season}.Sav`);
            fs.writeFileSync(file, req.rawBody, 'latin1');
        }
    }
    catch (e) {
        console.log(e);
    }

    res.status(204).end();
});

function getRawBody(req, res, next) {
    if (req.headers["content-length"]) {
        if (Number(req.headers["content-length"]) >= 400000) return res.status(403).json({ "error": "File size must be less than 400kb." });
    }

    // Get raw body in encoding latin1 for ClientSettings
    try {
        req.rawBody = "";
        req.setEncoding("latin1");

        req.on("data", (chunk) => req.rawBody += chunk);
        req.on("end", () => next());
    } catch {
        res.status(400).json({ "error": "Something went wrong while trying to access the request body." });
    }
}

module.exports = app;
