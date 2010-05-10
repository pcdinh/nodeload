var sys = require('sys'), 
	http = require('http');
var _port;

function checkUsage() {
	if(process.argv.length != 3) {
		sys.puts('usage: node testserver.js <port>');
		process.exit(1);
	}

	var port = parseInt(process.argv[2], 10);

	if('NaN' == port.toString()) {
		sys.puts('usage: node testserver.js <port>');
		process.exit(1);
	}
	
	_port = port;
};

var TestServer = function() {
	var _self = this;
	var _server;

	var _routes = {
		'/' : function(request, response) {
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write('hello world\n');
			response.end();
		},

		'/is_up' : function(request, response) {
			response.writeHead(200, {'Content-Type': 'text/plain'});
			response.write('ok');
			response.end();
		},
	}

	var _requestHandler = function(request, response) {
		sys.puts('Request '+request.url+' from '+request.connection.remoteAddress+' to '+request.headers.host);

		if(_routes[request.url] === undefined) {
			response.writeHead(404, {'Content-Type': 'text/plain'});
			response.write('not found\n');
			response.end();
		} else {
			_routes[request.url].call(this, request, response);
		}
	};
	
	var _run = function() {
		_server = http.createServer().
						addListener('request', _requestHandler)
						.listen(_port);
		sys.puts('Listening to port ' + _port);
	};

	_run();
};

checkUsage();
server = new TestServer();
