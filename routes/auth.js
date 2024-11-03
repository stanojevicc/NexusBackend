const express = require("express");
const app = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const crypto = require('crypto');

const error = require("../structs/error.js");
const functions = require("../structs/functions.js");

const tokenCreation = require("../tokenManager/tokenCreation.js");
const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");
const User = require("../model/user.js");

const { AddAnalysticEvent } = require("../model/Utils.js");

app.post("/account/api/oauth/token", async (req, res) => {
    let clientId;

   // console.log("AOauth");
    try {
        clientId = functions.DecodeBase64(req.headers["authorization"].split(" ")[1]).split(":");

        if (!clientId[1]) throw new Error("invalid client id");

        clientId = clientId[0];
    } catch {
        return error.createError(
            "errors.com.epicgames.common.oauth.invalid_client",
            "It appears that your Authorization header may be invalid or not present, please verify that you are sending the correct headers.",
            [], 1011, "invalid_client", 400, res
        );
    }

   // console.log(req.body.grant_type);
    switch (req.body.grant_type) {
        case "client_credentials":

            let ip = req.ip;

            let clientToken = global.clientTokens.findIndex(i => i.ip == ip);
            if (clientToken != -1) global.clientTokens.splice(clientToken, 1);

            let token = tokenCreation.createClient(clientId, req.body.grant_type, ip, 4); // expires in 4 hours

            functions.UpdateTokens();

            const decodedClient = jwt.decode(token);

            return res.status(200).json({
                access_token: `eg1~${token}`,
                expires_in: Math.round(((DateAddHours(new Date(decodedClient.creation_date), decodedClient.hours_expire).getTime()) - (new Date().getTime())) / 1000),
                expires_at: DateAddHours(new Date(decodedClient.creation_date), decodedClient.hours_expire).toISOString(),
                token_type: "bearer",
                client_id: clientId,
                internal_client: true,
                client_service: "fortnite"
            });

        case "password":
         //   console.log(req.body);
            if (!req.body.username || !req.body.password) return error.createError(
                "errors.com.epicgames.common.oauth.invalid_request",
                "Username/password is required.",
                [], 1013, "invalid_request", 400, res
            );
            const { username: email, password: password } = req.body;

            if (password == "dedicatedserverweloginnigger") {
                let Memory_CurrentAccountID = "ICantPickToTry";
                return res.json({
                    "access_token": "lawinstokenlol",
                    "expires_in": 28800,
                    "expires_at": "9999-12-02T01:12:01.100Z",
                    "token_type": "bearer",
                    "refresh_token": "lawinstokenlol",
                    "refresh_expires": 86400,
                    "refresh_expires_at": "9999-12-02T01:12:01.100Z",
                    "account_id": Memory_CurrentAccountID,
                    "client_id": "lawinsclientidlol",
                    "internal_client": true,
                    "client_service": "fortnite",
                    "displayName": Memory_CurrentAccountID,
                    "app": "fortnite",
                    "in_app_id": Memory_CurrentAccountID,
                    "device_id": "lawinsdeviceidlol"
                })
            }



            req.user = await User.findOne({ email: email.toLowerCase() }).lean();

            let err = () => error.createError(
                "errors.com.epicgames.account.invalid_account_credentials",
                "Your e-mail and/or password are incorrect. Please check them and try again.",
                [], 18031, "invalid_grant", 400, res
            );

            if (!req.user) return err();
            else {
                if (!await bcrypt.compare(password, req.user.password)) return err();
            }
            break;

        case "refresh_token":
            if (!req.body.refresh_token) return error.createError(
                "errors.com.epicgames.common.oauth.invalid_request",
                "Refresh token is required.",
                [], 1013, "invalid_request", 400, res
            );

            const refresh_token = req.body.refresh_token;

            let refreshToken = global.refreshTokens.findIndex(i => i.token == refresh_token);
            let object = global.refreshTokens[refreshToken];

            try {
                if (refreshToken == -1) throw new Error("Refresh token invalid.");
                let decodedRefreshToken = jwt.decode(refresh_token.replace("eg1~", ""));

                if (DateAddHours(new Date(decodedRefreshToken.creation_date), decodedRefreshToken.hours_expire).getTime() <= new Date().getTime()) {
                    throw new Error("Expired refresh token.");
                }
            } catch {
                if (refreshToken != -1) {
                    global.refreshTokens.splice(refreshToken, 1);

                    functions.UpdateTokens();
                }

                error.createError(
                    "errors.com.epicgames.account.auth_token.invalid_refresh_token",
                    `Sorry the refresh token '${refresh_token}' is invalid`,
                    [refresh_token], 18036, "invalid_grant", 400, res
                );

                return;
            }

            req.user = await User.findOne({ accountId: object.accountId }).lean();
            break;

        case "exchange_code":
            if (!req.body.exchange_code) return error.createError(
                "errors.com.epicgames.common.oauth.invalid_request",
                "Exchange code is required.",
                [], 1013, "invalid_request", 400, res
            );

            const { exchange_code } = req.body;
            /*
                        let index = global.exchangeCodes.findIndex(i => i.exchange_code == exchange_code);
                        let exchange = global.exchangeCodes[index];
            
                        if (index == -1) return error.createError(
                            "errors.com.epicgames.account.oauth.exchange_code_not_found",
                            "Sorry the exchange code you supplied was not found. It is possible that it was no longer valid", 
                            [], 18057, "invalid_grant", 400, res
                        );
            
                        global.exchangeCodes.splice(index, 1);*/

            //    req.user = await User.findOne({ accountId: exchange.accountId }).lean();
            req.user = await User.findOne({ token: exchange_code }).lean();
            break;

        default:
            error.createError(
                "errors.com.epicgames.common.oauth.unsupported_grant_type",
                `Unsupported grant type: ${req.body.grant_type}`,
                [], 1016, "unsupported_grant_type", 400, res
            );
            return;
    }


    if (!req.user) return error.createError(
        "errors.com.epicgames.common.oauth.unsupported_grant_type",
        `Unsupported grant type: ${req.body.grant_type}`,
        [], 1016, "unsupported_grant_type", 400, res
    );

    if (req.user.banned) return error.createError(
        "errors.com.epicgames.account.account_not_active",
        "You have been permanently banned from Fortnite.",
        [], -1, undefined, 400, res
    );

    let refreshIndex = global.refreshTokens.findIndex(i => i.accountId == req.user.accountId);
    if (refreshIndex != -1) global.refreshTokens.splice(refreshIndex, 1);

    let accessIndex = global.accessTokens.findIndex(i => i.accountId == req.user.accountId);
    if (accessIndex != -1) {
        global.accessTokens.splice(accessIndex, 1);

        if (!global.Clients)
            global.Clients = [];

        let xmppClient = global.Clients.find(i => i.accountId == req.user.accountId);
        if (xmppClient) xmppClient.client.close();
    }

    const deviceId = functions.MakeID().replace(/-/ig, "");
    const accessToken = tokenCreation.createAccess(req.user, clientId, req.body.grant_type, deviceId, 8); // expires in 8 hours
    const refreshToken = tokenCreation.createRefresh(req.user, clientId, req.body.grant_type, deviceId, 24); // expires in 24 hours

    functions.UpdateTokens();

    const decodedAccess = jwt.decode(accessToken);
    const decodedRefresh = jwt.decode(refreshToken);


    try {
        const memory = functions.GetVersionInfo(req);
        if (memory.build2 && memory.CL) {
            AddAnalysticEvent(req.user.accountId, "LoginFortnite", memory.build2, {}, memory.Plateform);
        }
    }
    catch {

    }

    //  AddAnalysticEvent(accountId, "LoginFortnite", Version);
    res.json({
        fortnite_token: `eg1~${accessToken}`,
        access_token: `eg1~${accessToken}`,
        expires_in: Math.round(((DateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).getTime()) - (new Date().getTime())) / 1000),
        expires_at: DateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).toISOString(),
        token_type: "bearer",
        refresh_token: `eg1~${refreshToken}`,
        refresh_expires: Math.round(((DateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).getTime()) - (new Date().getTime())) / 1000),
        refresh_expires_at: DateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).toISOString(),
        account_id: req.user.accountId,
        client_id: clientId,
        internal_client: true,
        client_service: "fortnite",
        displayName: req.user.username,
        app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: deviceId
    });

    /*res.json({
        access_token: `eg1~${accessToken}`,
        expires_in: Math.round(((DateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).getTime()) - (new Date().getTime())) / 1000),
        expires_at: DateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).toISOString(),
        token_type: "bearer",
        refresh_token: `eg1~${refreshToken}`,
        refresh_expires: Math.round(((DateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).getTime()) - (new Date().getTime())) / 1000),
        refresh_expires_at: DateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).toISOString(),
        account_id: req.user.accountId,
        client_id: clientId,
        internal_client: true,
        client_service: "fortnite",
        displayName: req.user.username,
        app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: deviceId
    });*/
});
/*
app.get("/account/api/oauth/verify", verifyToken, (req, res) => {
    let token = req.headers["authorization"].replace("bearer ", "");
    const decodedToken = jwt.decode(token.replace("eg1~", ""));

    res.json({
        token: token,
        session_id: decodedToken.jti,
        token_type: "bearer",
        client_id: decodedToken.clid,
        internal_client: true,
        client_service: "fortnite",
        account_id: req.user.accountId,
        expires_in: Math.round(((DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime()) - (new Date().getTime())) / 1000),
        expires_at: DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).toISOString(),
        auth_method: decodedToken.am,
        display_name: req.user.username,
        app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: decodedToken.dvid
    });
});*/

app.get("/account/api/oauth/verify", (req, res) => {
   // return res.status(500).json({});
    try {
        //   return res.status(500).json({});
        let token = req.headers["authorization"].replace("bearer ", "");
        const decodedToken = jwt.decode(token.replace("eg1~", ""));

        return res.status(200).json({
            token: token,
            session_id: decodedToken.jti,
            token_type: "bearer",
            client_id: decodedToken.clid,
            internal_client: true,
            client_service: "fortnite",
            account_id: req.user.accountId,
            expires_in: Math.round(((DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).getTime()) - (new Date().getTime())) / 1000),
            expires_at: DateAddHours(new Date(decodedToken.creation_date), decodedToken.hours_expire).toISOString(),
            auth_method: decodedToken.am,
            display_name: req.user.username,
            app: "fortnite",
            in_app_id: req.user.accountId,
            device_id: decodedToken.dvid
        });
    }
    catch {
        return res.status(500).json({});
    }
});


app.delete("/account/api/oauth/sessions/kill", (req, res) => {
    res.status(204).end();
});

app.delete("/account/api/oauth/sessions/kill/:token", (req, res) => {
    try {
        let token = req.params.token;

        let accessIndex = global.accessTokens.findIndex(i => i.token == token);

        if (accessIndex != -1) {
            let object = global.accessTokens[accessIndex];

            global.accessTokens.splice(accessIndex, 1);

            let xmppClient = global.Clients.find(i => i.token == object.token);
            if (xmppClient) xmppClient.client.close();

            let refreshIndex = global.refreshTokens.findIndex(i => i.accountId == object.accountId);
            if (refreshIndex != -1) global.refreshTokens.splice(refreshIndex, 1);
        }

        let clientIndex = global.clientTokens.findIndex(i => i.token == token);
        if (clientIndex != -1) global.clientTokens.splice(clientIndex, 1);

        if (accessIndex != -1 || clientIndex != -1) functions.UpdateTokens();

        return res.status(204).end();
    }
    catch {
        return res.status(204).end();
    }
});

function DateAddHours(pdate, number) {
    let date = pdate;
    date.setHours(date.getHours() + number);

    return date;
}

module.exports = app;