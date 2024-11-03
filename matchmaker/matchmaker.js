const { abort } = require("process");
const functions = require("../structs/functions.js");
const axios = require('axios');

let AllQueues = {};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}


async function CreateTicket(a, b, c) {
    try {
        return await axios.get("http://127.0.0.1:3000/Cosmos/CreateTicket?ticketid=" + a + "&playlistname=" + b + "&region=" + c);
    }
    catch {
        return "";
    }
}


async function RemoveTicket(a) {
    try {
        return await axios.get("http://127.0.0.1:3000/Cosmos/RemovePlayerFromQueue?ticketid=" + a);
    }
    catch {
        return "";
    }
}



async function FindTicket(a) {
    try {
        //console.log("http://127.0.0.1:3000/Cosmos/FindTicket?ticketid=" + a);
        return await axios.get("http://127.0.0.1:3000/Cosmos/FindTicket?ticketid=" + a);
    }
    catch {
        return "";
    }
}

module.exports = async (ws, req) => {
    // create hashes
    //let bJoinedAnyways = true;

    const newurl = req.url.replace('/', '');
    const Playlistname2 = newurl.split(":")[0];
    const AccountId = newurl.split(":")[1];
    const Region = newurl.split(":")[2];

    AllQueues[AccountId] = { bJoinedAnyways: true, bstopeverything: false, wstest: ws };

    //console.log(AllQueues[AccountId]);

    ws.on("close", async function () {
        //console.log(req.url);
        if (AllQueues[AccountId]) {
            AllQueues[AccountId].bstopeverything = true;
            if (AllQueues[AccountId] && AllQueues[AccountId].bJoinedAnyways == true) {
                //    console.log("removing ticket")
                await sleep(500);
                await RemoveTicket(AccountId);

                let AllGroups = global.MUCs;

                var obj = AllGroups;
                var keys = Object.keys(obj);
                for (var i = 0; i < keys.length; i++) {
                    let CurrentGroup = obj[keys[i]];
                    if (!CurrentGroup) continue;

                    let Partyid = keys[i].replace('Party-', '');

                    const members = CurrentGroup.members;
                    if (!members) continue;
                    if (members.length <= 1) continue;
                    const LeaderId = CurrentGroup.LeaderId;
                    if (!LeaderId) continue;
                    if (LeaderId == AccountId) {
                        //console.log("found me as leaderid !!");
                        for (var d = 0; d < members.length; d++) {
                            {
                                const CurrentMember = members[d];
                                if (!CurrentMember) continue;

                                const CurrentMemberAccountID = CurrentMember.accountId;
                                if (!CurrentMemberAccountID) continue;

                                if (CurrentMemberAccountID === AccountId) continue;

                               // console.log(CurrentMemberAccountID);
                                // MIAM

                                //  AllQueues[CurrentMemberAccountID].wstest

                                //          await RemoveTicket(CurrentMemberAccountID);

                             //   console.log(Partyid);
                                let BodySend = {
                                    partyId: Partyid,
                                    Rev: 3,
                                    Attrs: { GameReadiness_s: 'NotReady', ReadyInputType_s: 'Count' }
                                };

                                const Body2 = {
                                    type: 'com.epicgames.party.memberdata',
                                    payload: { partyId: Partyid, payload: BodySend },
                                    timestamp: new Date()
                                };



                                for (var y = 0; y < members.length; y++) {
                                    const CurrentMember = members[y];
                                    if (!CurrentMember) continue;

                                    const CurrentMemberAccountID0 = CurrentMember.accountId;
                                    if (!CurrentMemberAccountID0) continue;

                                    //  if (CurrentMemberAccountID0 === CurrentMemberAccountID) continue;

                                    functions.sendXmppMessageToId2(Body2, CurrentMemberAccountID, CurrentMemberAccountID0);

                                }

                                if (AllQueues[CurrentMemberAccountID] && AllQueues[CurrentMemberAccountID].wstest) {
                                    AllQueues[CurrentMemberAccountID].wstest.send(JSON.stringify({
                                        name: "Error",
                                        "payload": {
                                            code: "4202",
                                            reason: "player.party_member_disconnected.202"
                                        }
                                    }));
                                }


                                //  functions.sendXmppMessageToId2(BodySend, CurrentMemberAccountID, CurrentMemberAccountID);
                                //   functions.sendXmppMessageToId2(Body2, CurrentMemberAccountID, CurrentMemberAccountID);
                                // functions.sendXmppMessageToId2(Body2, CurrentMemberAccountID, AccountId);
                                //   await functions.sendXmppMessageToId2(BodySend, CurrentMemberAccountID, AccountId);

                                // AllQueues[CurrentMemberAccountID].wstest.close(1000, "Reason:Normal");
                                //  AllQueues[CurrentMemberAccountID].wstest.close();



                            }
                        }

                        break;
                    }
                }
            }
        }

        //if (AllQueues[AccountId])
        //   delete AllQueues[AccountId];
    });

    const ticketId = functions.MakeID().replace(/-/ig, "");
    const matchId = functions.MakeID().replace(/-/ig, "");
    const sessionId = functions.MakeID().replace(/-/ig, "");



    // Commencez le processus de connexion
    Connecting();
    await functions.sleep(800);
    QueueFull();
    await WaitToCreateTicket();
    Waiting();
    await functions.sleep(500);
    await WaitToFinishQueue();
    SessionAssignment();
    await WaitToServerOpen();

    if (AllQueues[AccountId]) {
        AllQueues[AccountId].bJoinedAnyways = false;
    }

    Join();

    function QueueFull() {
        ws.send(JSON.stringify({
            "payload": {
                "state": "QueueFull"
            },
            "name": "StatusUpdate"
        }));
    }

    function Connecting() {
        ws.send(JSON.stringify({
            "payload": {
                "state": "Connecting"
            },
            "name": "StatusUpdate"
        }));
    }

    function Waiting() {
        ws.send(JSON.stringify({
            "payload": {
                "totalPlayers": 1,
                "connectedPlayers": 1,
                "state": "Waiting"
            },
            "name": "StatusUpdate"
        }));
    }


    function QueuedWaitInfo(a) {
        ws.send(JSON.stringify({
            "payload": {
                "ticketId": ticketId,
                "queuedPlayers": 0,
                "estimatedWaitSec": a,
                "status": {},
                "state": "Queued"
            },
            "name": "StatusUpdate"
        }));
    }

    async function WaitToCreateTicket() {
        let AccountQueue = AllQueues[AccountId];

        for (var i = 0; i < 80; i++) {
            if (!AccountQueue || AccountQueue && AccountQueue.bstopeverything == true) break;

            let Reponse_CreateTicket = await CreateTicket(AccountId, Playlistname2, Region);
            if (Reponse_CreateTicket.status == 200) {
                return;
            }
            else {

            }
            await functions.sleep(3 * 1000);
        }
        return ws.close();
    }

    async function WaitToFinishQueue() {
        QueuedWaitInfo(0);
        let TimeHappens = 0;
        let AccountQueue = AllQueues[AccountId];

        for (var i = 0; i < 80; i++) {
            if (!AccountQueue || AccountQueue && AccountQueue.bstopeverything == true) break;

            let Reponse_FindTicket = await FindTicket(AccountId);
            if (Reponse_FindTicket.status == 200 && Reponse_FindTicket.data) {
                const Data = Reponse_FindTicket.data;
                if (Data) {
                    //  console.log(Data);
                    if (Data.ServerStatus != null && Data.ServerStatus != undefined) {
                        if (Data.ServerStatus != "InQueue") {
                            //        console.log("queue: finished");
                            return;
                        }
                    }

                    let WaitEstim = Data.EstimatedWait;
                    if (WaitEstim == undefined || !WaitEstim || isNaN(WaitEstim)) {
                        WaitEstim = Number(215);
                    }

                    QueuedWaitInfo(WaitEstim);
                }
            }
            else if (Reponse_FindTicket.status >= 404 || Reponse_FindTicket.status == undefined) {
                TimeHappens++;
                if (TimeHappens > 3)
                    break;
            }
            await functions.sleep(3 * 1000);
        }
        return ws.close();
    }

    async function WaitToServerOpen() {
        let TimeHappens = 0;
        let AccountQueue = AllQueues[AccountId];

        for (var i = 0; i < 80; i++) {
            //    if(!bJoinedAnyways) break;
            if (!AccountQueue || AccountQueue && AccountQueue.bstopeverything == true) break;

            let Reponse_FindTicket = await FindTicket(AccountId);
            //    console.log(Reponse_FindTicket.status);
            if (Reponse_FindTicket.status == 200 && Reponse_FindTicket.data) {
                const Data = Reponse_FindTicket.data;
                if (Data) {
                    if (Data.ServerStatus != null && Data.ServerStatus != undefined) {
                        if (Data.ServerStatus == "Open") {
                            return;
                        }
                    }
                }
            }
            else if (Reponse_FindTicket.status >= 404 || Reponse_FindTicket.status == undefined) {
                TimeHappens++;
                if (TimeHappens > 3)
                    break;
            }
            await functions.sleep(3 * 1000);
        }
        return ws.close();
    }

    function SessionAssignment() {
        ws.send(JSON.stringify({
            "payload": {
                "matchId": matchId,
                "state": "SessionAssignment"
            },
            "name": "StatusUpdate"
        }));
    }

    function Join() {
        ws.send(JSON.stringify({
            "payload": {
                "matchId": matchId,
                "sessionId": sessionId,
                "playerId": AccountId,
                "joinDelaySec": 2
            },
            "name": "Play"
        }));
    }
}