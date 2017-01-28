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
var data = fs.readFileSync('./saved_gens_time_penalties.txt', 'utf8');
var lines = data.split("\n");
if (lines.length > 1) {
    var opts_queue = JSON.parse(lines.slice(-2)[0]);
} else {
    var opts_queue = JSON.parse(lines[0]);
}
for (var i=0; i<opts_queue.length; i++) {
    delete opts_queue[i]["scores"];
    delete opts_queue[i]["ranks"];
    delete opts_queue[i]["times"];
}

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
            console.log(parsed_query);
            if (opts_queue.length === 0 && agents_completed.length === 10) {
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
    fs.appendFile('./saved_gens_time_penalties.txt', JSON.stringify(agents_completed) + '\n', function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("generation saved");
    });
}

function generateNextGeneration() {
    var new_generation = [];
    assign_fitness(agents_completed);
    agents_completed.sort(compareProbs);
    new_generation = new_generation.concat(select_elites(agents_completed));
    var parent_sets = create_parent_sets(agents_completed);
    for (var i=0;i<parent_sets.length;i++) {
        new_generation.push(generate_child(parent_sets[i]));
    }
    opts_queue = new_generation;
    console.log("new generation:");
    console.log(new_generation);
    agents_completed = [];
}

function assign_fitness(generation) {
    var tot_tpp = 0;
    //get average points and time, generate time per points
    for (var i=0; i<generation.length; i++) {
        var avg = average(generation[i]["scores"].split(','));
        var time = average(generation[i]["times"].split(','));
        var t_per_point = time / avg;
        generation[i]["avg"] = avg;
        generation[i]["tpp"] = t_per_point;
        tot_tpp += t_per_point;
    }

    var total = 0;
    for (var i=0; i<generation.length; i++) {
        var fitness = generation[i]["avg"] * (1 - generation[i]["tpp"] / tot_tpp); 
        generation[i]["fitness"] = fitness;
        total += fitness; 
    }

    var run_sum = 0;
    //then give each element a number value for random selection
    for (var i=0; i<generation.length; i++) {
        generation[i]["prob"] = run_sum + generation[i]["fitness"] / total;
        run_sum += generation[i]["fitness"] / total;
    }
}

function select_elites(generation) {
    generation = generation.sort(compareFitness);
    console.log("ELITES:");
    console.log(generation.slice(0,1));
    return generation.slice(0,1);
}

function create_parent_sets(generation) {
    var ret = [];
    for (var i=0; i<9; i++) {
        var parent_set = []; 
        var chancer = Math.random();
        if (chancer > .5) {
            parent_set.push(select_parent(generation));
            parent_set.push(select_parent(generation));
        } else {
            parent_set.push(select_parent(generation));
            parent_set.push(generation[getRandomInt(0,9)]);
        }
        ret.push(parent_set);
    }
    return ret;
}

function select_parent(generation) {
    var rand_num = Math.random();
    for (var i=0;i<generation.length;i++) {
        if (rand_num > generation[i]["prob"]) {
            //(randInt(size-1) + i + 1) % generation.length
            continue;
        } else {
            return generation[i];
        }
    }
}

function generate_child(parents) {
    for (var i=0;i<parents.length;i++) {
        delete parents[i]["fitness"];
        delete parents[i]["prob"];
        delete parents[i]["scores"];
        delete parents[i]["ranks"];
        delete parents[i]["times"];
        delete parents[i]["tpp"];
        delete parents[i]["avg"];
    }
    var child = crossover(parents);
    child = mutate(child);
    return child;
}

function mutate(child) {
    console.log('child pre-mutation:');
    console.log(child);
    for (var att in child) {
        var rand = Math.random();
        if (rand < .06) {
            child[att] = mutation(child, "major", att);
        } else if (rand < .15) {
            child[att] = mutation(child, "minor", att);
        }
    }
    console.log('child post-mutation:');
    console.log(child);
    return child;
}

function mutation(child, type, att) {
    console.log(att);
    switch(att) {
    //targetFps: range:30,30
    case 'targetFps':
        if (type === "major") {
            return 30;
        } else {
            return 30;
        }
        break;
    //arcSize: range:0,2*Math.PI
    case 'arcSize':
        if (type === "major") {
            return getRandomArbitrary(0,2*Math.PI);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1/8*Math.PI) % (2*Math.PI))
            } else {
                return Math.abs((Number(child[att]) - 1/8*Math.PI) % (2*Math.PI))
            }
        }
        break;
    //radiusMult: range:0,50
    case 'radiusMult':
        if (type === "major") {
            return getRandomInt(0,50);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 3) % 50)
            } else {
                return Math.abs((Number(child[att]) - 3) % 50)
            }
        }
        break;
    //foodAccelSize: range:2,100
    case 'foodAccelSize':
        if (type === "major") {
            return getRandomInt(2,100);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 8) % 100)
            } else {
                return Math.abs((Number(child[att]) - 8) % 100)
            }
        }
        break;
    //foodAccelAngle: range:0,2*Math.PI
    case 'foodAccelAngle':
        if (type === "major") {
            return getRandomArbitrary(0,2*Math.PI);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1/8*Math.PI) % (2*Math.PI))
            } else {
                return Math.abs((Number(child[att]) - 1/8*Math.PI) % (2*Math.PI))
            }
        }
        break;
    //foodFrames: range:0,15
    case 'foodFrames':
        if (type === "major") {
            return getRandomInt(0,15);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1) % 15)
            } else {
                return Math.abs((Number(child[att]) - 1) % 15)
            }
        }
        break;
    //foodRoundSize: range:1,20
    case 'foodRoundSize':
        if (type === "major") {
            return getRandomInt(1,20);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 2) % 20)
            } else {
                return Math.abs((Number(child[att]) - 2) % 20)
            }
        }
        break;
    //foodRoundAngle: range:0,2*Math.PI
    case 'foodRoundAngle':
        if (type === "major") {
            return getRandomArbitrary(0,2*Math.PI);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1/8*Math.PI) % (2*Math.PI))
            } else {
                return Math.abs((Number(child[att]) - 1/8*Math.PI) % (2*Math.PI))
            }
        }
        break;
    //foodSmallSize: range:2,30
    case 'foodSmallSize':
        if (type === "major") {
            return getRandomInt(2,30);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 2) % 30)
            } else {
                return Math.abs((Number(child[att]) - 2) % 30)
            }
        }
        break;
    //rearHeadAngle: range:0,2*Math.PI
    case 'rearHeadAngle':
        if (type === "major") {
            return getRandomArbitrary(0,2*Math.PI);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1/8*Math.PI) % (2*Math.PI))
            } else {
                return Math.abs((Number(child[att]) - 1/8*Math.PI) % (2*Math.PI))
            }
        }
        break;
    //rearHeadDir: range:0,2*Math.PI
    case 'rearHeadDir':
        if (type === "major") {
            return getRandomArbitrary(0,2*Math.PI);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1/8*Math.PI) % (2*Math.PI))
            } else {
                return Math.abs((Number(child[att]) - 1/8*Math.PI) % (2*Math.PI))
            }
        }
        break;
    //radiusApproachSize: range:1,40
    case 'radiusApproachSize':
        if (type === "major") {
            return getRandomInt(1,40);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 1) % 40)
            } else {
                return Math.abs((Number(child[att]) - 1) % 40)
            }
        }
        break;
    //radiusAvoidSize: range:5,100
    case 'radiusAvoidSize':
        if (type === "major") {
            return getRandomInt(5,100);
        } else {
            var bool = Math.random();
            if (bool > .5) {
                return Math.abs((Number(child[att]) + 5) % 100)
            } else {
                return Math.abs((Number(child[att]) - 5) % 100)
            }
        }
        break;
    }
}

function crossover(parents) {
    var par1 = JSON.stringify(parents[0]).split(',');
    var par2 = JSON.stringify(parents[1]).split(',');
    var divide_point = getRandomInt(1,12);
    var child = par1.slice(0,divide_point);
    child = child.concat(par2.slice(divide_point));
    child = child.join();
    return JSON.parse(child);
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns a random number between min (inclusive) and max (exclusive)
 */
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function average(scores) {
    var total = 0;
    for(var i = 0; i < scores.length; i++) {
        total += parseInt(scores[i]);
    }
    var avg = total / scores.length;
    return avg;
}

function compareProbs(a,b) {
  if (a.prob < b.prob)
    return -1;
  if (a.prob > b.prob)
    return 1;
  return 0;
}

function compareFitness(a,b) {
  if (a.fitness < b.fitness)
    return 1;
  if (a.fitness > b.fitness)
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
