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
    var new_generation = [];
    console.log("agents pre-fitness:");
    console.log(agents_completed);
    assign_fitness(agents_completed);
    console.log("agents post-fitness:");
    console.log(agents_completed);
    agents_completed.sort(compare);
    console.log("sorted agents:");
    console.log(agents_completed);
    //new_generation.concat(select_elites(agents_completed));
    var parent_sets = create_parent_sets(agents_completed);
    for (parents in parent_sets) {
        new_generation.push(generate_child(parents));
    }
    opts_queue = new_generation;
    console.log("new generation:");
    console.log(new_generation);
    agents_completed = [];
    //opts_queue = agents_completed;
    //for (var i=0; i<opts_queue.length; i++) {
    //    delete opts_queue[i]["scores"];
    //}
    //    console.log("NEW GENERATION: ");
    //    console.log(opts_queue);
    //agents_completed = [];
}

function assign_fitness(generation) {
    var total = 0;
    //first find the averages
    for (var i=0; i<generation.length; i++) {
        var avg = average(generation[i]["scores"]);
        generation[i]["fitness"] = avg;
        total += avg;
    }
    var run_sum = 0;
    //then give each element a number value for random selection
    for (var i=0; i<generation.length; i++) {
        generation[i]["prob"] = run_sum + generation[i]["fitness"] / total;
        run_sum += generation[i]["fitness"] / total;
    }
}

//function select_elites(generation) {
    //TODO: create this eventually
//}

//TODO: fix so that same agent cant be both parents
function create_parent_sets(generation) {
    var ret = [];
    for (var i=0; i<10; i++) {
        var parent_set = []; 
        parent_set.push(select_parent(generation));
        parent_set.push(select_parent(generation));
        ret.push(parent_set);
    }
    return ret;
}

function select_parent(generation) {
    var rand_num = Math.random();
    for (agent in generation) {
        if (rand_num > agent["prob"]) {
            continue;
        } else {
            return agent;
        }
    }
}

function generate_child(parents) {
    for (par in parents) {
        delete par["fitness"];
        delete par["prob"];
        delete par["scores"];
    }
    var child = crossover(parents);
    child = mutate(child);
}

function mutate(child) {
    //TODO:fill me in for real
    child["radiusAvoidSize"] = child["radiusAvoidSize"] - 1;
    return child;
}

function crossover(parents) {
    var par1 = JSON.stringify(parents[0]).split(',');
    var par2 = JSON.stringify(parents[1]).split(',');
    var divide_point = Math.floor(par1.length/2);
    var child = par1.slice(0,divide_point);
    child.concat(par2.slice(divide_point));
    child = child.join();
    return JSON.parse(child);
}

function average(scores) {
    var total = 0;
    for(var i = 0; i < scores.length; i++) {
        total += scores[i];
    }
    var avg = total / scores.length;
}

function compare(a,b) {
  if (a.prob < b.prob)
    return 1;
  if (a.prob > b.prob)
    return -1;
  return 0;
}

//Create a server
var server = http.createServer(handleRequest);

//Lets start our server
server.listen(PORT, function(){
    //Callback triggered when server is successfully listening. Hurray!
    console.log("Server listening on: http://localhost:%s", PORT);
});
