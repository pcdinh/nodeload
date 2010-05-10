var sys = require('sys'), 
	http = require('http'),
	fs = require('fs');

var LoadBalancer = new function() {
	var _self = this;
	var _server;
	var _cluster = [];
	var _active = [];
	var _port = 8888;
	var _checkInterval = 10000;
	var _checkTimeout = [];

	var _updateActives = function() {
		_active = [];
		for(var i=0; i<_cluster.length; i++) {
			if(_cluster[i].active) {
				_active[_active.length] = _cluster[i];
			}
		}
	};

	var _loadCluster = function(callback) {
		fs.readFile('./cluster.conf.json', function (err, data) {
			if (err) throw err;
			_cluster = JSON.parse(data.toString().replace('\n', ''));
			callback();
		});
	};
	
	var _checkCluster = function() {
		for(var i=0; i<_cluster.length; i++) {
			_clusterNodeCheck(_cluster[i]);
		}
	};
	
	var _clusterNodeCheck = function(node) {
		var client = http.createClient(parseInt(node.port, 10), node.host);
		var request = client.request('GET', '/is_up', {"host" : node.host});
		
		request.addListener('response', function (response) {
			if(response.statusCode == 200) {
				response.addListener('data', function(data) {
					if(data == 'ok') {
						node.active = true;
					} else {
						node.active = false;
					}
				});
			} else {
				node.active = false;
			}
		});
		
		request.addListener('error', function (err) {
			node.active = false;
		});

		client.addListener('error', function (err) {
			node.active = false;
		});

		request.end();

		setTimeout(_updateActives, 200);

		_checkTimeout[node.host + ':' + node.port] = setTimeout(function() {
			_clusterNodeCheck(node);
		}, _checkInterval);
	};

	var _requestHandler = function(request, response) {
		if(_active.length == 0) {
			response.writeHead(500, {'Content-Type': 'text/html'});
			response.write('no server active');
			response.end();
		} else {
			var index = Math.floor(Math.random()*_active.length);
			var node = _active[index];

			var proxy_headers = request.headers;
			var proxy_client = http.createClient(parseInt(node.port, 10), node.host);
			var proxy_request = proxy_client.request(request.method, request.url, proxy_headers);

			proxy_request.addListener("response", function (proxy_response) {
				response.writeHeader(proxy_response.statusCode, proxy_response.headers);
		
				proxy_response.addListener("data", function (chunk) {
					response.write(chunk);
				});
		
				proxy_response.addListener("end", function () {
					response.end();
				});
			});

			proxy_client.addListener("error", function (error) {
				for(var i=0; i<_cluster.length; i++) {
					if(node.host == _cluster[i].host && node.port == _cluster[i].port) {
						sys.puts('error, deactivating: '+node.host+':'+node.port);
						_cluster[i].active = false;
						_updateActives();
					}

					clearTimeout(_checkTimeout[_cluster[i].host + ':' + _cluster[i].port]);
					_clusterNodeCheck(_cluster[i]);
				}

				setTimeout(function() {
					_requestHandler(request, response);
				}, 200);
			});
	
			proxy_request.end();		
		}
	};
	
	
	var _run = function() {
		_loadCluster(_checkCluster);

		_server = http.createServer().
						addListener('request', _requestHandler)
						.listen(_port);
		sys.puts('Listening to port ' + _port);
	};

	_run();
};