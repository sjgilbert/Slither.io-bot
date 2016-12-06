//Lets require/import the HTTP module
var http = require('http');

//Lets define a port we want to listen to
const PORT=8080; 

//for parsing query strings
const querystring = require('querystring');

//for writing files
const fs = require('fs');

var agents_completed = [];

// initialize the opts_queue
var data = fs.readFileSync('./saved_gens.txt', 'utf8');
var lines = data.split("\n");
console.log("LINES: ");
console.log(lines);
if (lines.length > 1) {
    var opts_queue = JSON.parse(lines.slice(-2)[0]);
} else {
    var opts_queue = JSON.parse(lines[0]);
}
for (var i=0; i<opts_queue.length; i++) {
    delete opts_queue[i]["scores"];
}
console.log("OPTS QUEUE INTITIAL");
console.log(opts_queue);

//We need a function which handles requests and send response
function handleRequest(req, res){
    res.setHeader('Access-Control-Allow-Origin', 'http://slither.io');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    if ( req.method === 'GET' ) {
        var split_url = req.url.split('?');
        if (split_url.length > 1) {
            var query = split_url.slice(-1)[0];
            var parsed_query = querystring.parse(query);
            console.log("PARSED QUERY: ");
            console.log(parsed_query);
            agents_completed.push(parsed_query);
            if (opts_queue.length === 0 && agents_completed.length === 3) {
                writeGenerationToFile();
                generateNextGeneration();
                res.writeHead(200, {"Content-Type": "application/json"});
                var ret = opts_queue.pop();
                res.end(JSON.stringify(ret));
                return;
            } else if (opts_queue.length > 0) {
                res.writeHead(200, {"Content-Type": "application/json"});
                var ret = opts_queue.pop();
                console.log("QUEUE LENGTH: ");
                console.log(opts_queue.length);
                res.end(JSON.stringify(ret));
                return;
            } else {
                res.writeHead(200, {"Content-Type": "text/plain"});
                var plain_response = "wait";
                res.end(plain_response);
                return;
            }
        } else if (opts_queue.length > 0) {
                res.writeHead(200, {"Content-Type": "application/json"});
                var ret = opts_queue.pop();
                console.log("QUEUE LENGTH: ");
                console.log(opts_queue.length);
                res.end(JSON.stringify(ret));
                return;
        } else {
                res.writeHead(200, {"Content-Type": "text/plain"});
                var plain_response = "wait";
                res.end(plain_response);
                return;
        }
    }
}

function writeGenerationToFile() {
    fs.appendFile('./saved_gens.txt', JSON.stringify(agents_completed) + '\n', function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("file saved");
    });
}

function generateNextGeneration() {
    opts_queue = agents_completed;
    for (var i=0; i<opts_queue.length; i++) {
        delete opts_queue[i]["scores"];
    }
        console.log("NEW GENERATION: ");
        console.log(opts_queue);
    agents_completed = [];
}


//Create a server
var server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT);
});
