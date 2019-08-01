const async = require('async');
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const mime = require('mime');
const pug = require('pug');
const MailComposer = require('nodemailer/lib/mail-composer');

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';

async.parallel({
    accounts: function(callback) {
        fs.readFile('accounts.tsv', (err, content) => {
            var result = [];
            content.toString().split('\n').forEach(line => {
                var elements = line.split('\t');
                if (elements.length >= 2) {
                    result.push({
                        username: elements[0],
                        password: elements[1]
                    });
                }
            });
            callback(null, result);
        });
    },
    teams: function(callback) {
        fs.readFile('teams.json', (err, content) => {
            callback(null, JSON.parse(content));
        });
    },
    gmail: function(callback) {
        fs.readFile('credentials.json', (err, content) => {
            if (err) return console.log('Error loading client secret file:', err);
            // Authorize a client with credentials, then call the Gmail API.
            authorize(JSON.parse(content), auth => {
                callback(null, google.gmail({version: 'v1', auth}));
            });
        });
    },
    general: function(callback) {
        fs.readFile('general.json', (err, content) => {
            callback(null, JSON.parse(content));
        })
    },
    content: function(callback) {
        callback(null, pug.compileFile('content.pug'));
    }
}, (err, results) => {
    async.eachOf(results.teams, (team, teamNo, callback) => {
        var mail = new MailComposer({
            from: results.general.from,
            to: team.email,
            subject: results.general.region + "网络赛账号 - " + team.name,
            html: results.content({
                teams: results.teams,
                accounts: results.accounts,
                teamNo: teamNo,
                region: results.general.region
            })
        })
        mail.compile().build((err, message) => {
            results.gmail.users.messages.send({
                userId: "me",
                body: message
            }).execute();
            callback();
        });
    });
});
/*
// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Gmail API.
    authorize(JSON.parse(content), listLabels);
});
*/
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listLabels(auth) {
    const gmail = google.gmail({version: 'v1', auth});
    gmail.users.labels.list({
        userId: 'me',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const labels = res.data.labels;
        if (labels.length) {
            console.log('Labels:');
            labels.forEach((label) => {
                console.log(`- ${label.name}`);
            });
        } else {
            console.log('No labels found.');
        }
    });
}

function createMessage(team) {
}
