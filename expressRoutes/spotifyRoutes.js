/* eslint-disable */
const express = require('express');
var request = require('request');
var rp = require('request-promise-native');
const config = require('../config/settings');

module.exports = function (app, io) {
	var spotifyRoute = express.Router();
	const my_client_id = config.spotifyClientId;
	const my_client_secret = config.spotifyClientSecret;
	const redirect_uri = config.baseURL + config.clientPort + "/success";

	/***********************************SOCKET**********************************************/

	io.on('connection', function (socket) {
		console.log('client connected');
		
		socket.on('ready', (data) => {
			//transferPlayback(data.id, data.access_token, data.play);
			socket.emit('playerReady', data);
		});

		socket.on('stateChanged', (data) => {
			socket.emit('stateChanged', data);
		});

		socket.on('tokenRefreshed', (data) => {
			socket.emit('tokenRefreshed', data);
		});

		socket.on('paused', () => {
			socket.emit('paused');
		});
		
		socket.on('played', () => {
			socket.emit('played');
		})
	});

	/***********************************ROUTES**********************************************/

	spotifyRoute.route('/link').get((req, res) => {
		var scopes = 'playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative user-read-private user-read-birthdate user-read-email user-read-playback-state user-read-currently-playing user-modify-playback-state app-remote-control streaming user-top-read user-read-recently-played user-library-read user-library-modify';

		return res.status(200).send({
			success: true,
			redirect: 'https://accounts.spotify.com/authorize' +
				'?response_type=code' +
				'&client_id=' +
				my_client_id +
				(scopes ? '&scope=' + encodeURIComponent(scopes) : '') +
				'&redirect_uri=' + encodeURIComponent(redirect_uri) +
				'&show_dialog=true'
		});
	});

	spotifyRoute.route('/authorize').post((req, res) => {
		var code = req.body.code;

		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				code: code,
				redirect_uri: redirect_uri,
				grant_type: 'authorization_code'
			},
			headers: {
				'Authorization': 'Basic ' + (new Buffer(my_client_id + ':' + my_client_secret).toString('base64'))
			},
			json: true
		};
		request.post(authOptions, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				console.log('spotify auth successful');
					access_token = body.access_token;
					refresh_token = body.refresh_token;
				return res.status(200).send({
					success: true,
					access_token: access_token,
					refresh_token: refresh_token
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	});

	spotifyRoute.route('/access_token/refresh').post((req, res) => {
		refresh_token = req.body.refresh_token;
		console.log(" Refresh: " + refresh_token);
		var authOptions = {
			url: 'https://accounts.spotify.com/api/token',
			form: {
				grant_type: 'refresh_token',
				refresh_token: refresh_token
			},
			headers: {
				'Authorization': 'Basic ' + (new Buffer(my_client_id + ':' + my_client_secret).toString('base64'))
			},
			json: true
		};
		request.post(authOptions, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				console.log('Access token refreshed');
				return res.send({
					success: true,
					access_token: body.access_token
				})
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	});

	spotifyRoute.route('/transfer/player').put((req, res) => {
		return transferPlayback(req.body.player_id, req.body.access_token, req.body.play, res)
	});

	spotifyRoute.route('/transfer/:id').put((req, res) => {
		if (transferPlayback(req.params.id, req.body.access_token, req.body.play)) {
			return res.send({
				success: true
			});
		} else {
			return res.send({
				success: false
			});
		}
	});

	spotifyRoute.route('/play').put((req, res) => {
		play(req.body.access_token, res);
	})

	spotifyRoute.route('/pause').put((req, res) => {
		pause(req.body.access_token, res);
	})
	
	spotifyRoute.route('/next').post((req, res) => {
		next(req.body.access_token, res);
	});

	spotifyRoute.route('/prev').post((req, res) => {
		prev(req.body.access_token, res);
	});

	spotifyRoute.route('/shuffle').put((req, res) => {
		shuffle(req.body.shuffle, req.body.access_token, res);
	});

	spotifyRoute.route('/repeat').put((req, res) => {
		repeat(req.body.type, req.body.access_token, res);
	});

	spotifyRoute.route('/volume').put((req, res) => {
		setVolume(req.body.volumePercent, req.body.access_token, res);
	})

	spotifyRoute.route('/seek').put((req, res) => {
		return seek(req.body.ms, req.body.access_token, res);
	})

	spotifyRoute.route('/profile/:access_token').get((req, res) => {
		return getProfile(req.params.access_token, res);
	});
	
	spotifyRoute.route('/top_artists/:access_token').get((req, res) => {
		return getTopArtists(req.params.access_token, res);
	});

	spotifyRoute.route('/currently_playing/:access_token').get((req, res) => {
		return getCurrentPlaying(req.params.access_token, res);
	});

	spotifyRoute.route('/recently_played/:access_token').get((req, res) => {
		return getRecentlyPlayed(req.params.access_token, res);
	});

	spotifyRoute.route('/track/:access_token/:id').get((req, res) => {
		return getTrackInfo(req.params.access_token, req.params.id, res);
	});

	spotifyRoute.route('/devices/:access_token').get((req, res) => {
		return getDevices(req.params.access_token, res);
	});

	spotifyRoute.route('/analyze/:access_token/:id').get((req, res) => {
		return analyze(req.params.access_token, req.params.id, res);
	})

	/***********************************END ROUTES**********************************************/


	/***********************************HELPERS**********************************************/

	function getProfile(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			url: 'https://api.spotify.com/v1/me',
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};

		request.get(options, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				return res.send({
					success: true,
					fullProfileResponse: body,
					birthday: body.birthdate,
					name: body.display_name,
					email: body.email,
					url: body.external_urls.spotify,
					followerTotal: body.followers.total,
					type: body.product,
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function getTrackInfo(token, id, res) {
		if (token === undefined || token === '' || id === undefined || id === '') {
			return res.send({
				success: false
			});
		}
		var options = {
			url: 'https://api.spotify.com/v1/tracks/'+id,
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};

		request.get(options, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				return res.send({
					success: true,
					track: body,
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function analyze(token, id, res) {
		if (token === undefined || token === '' || id === undefined || id === '') {
			return res.send({
				success: false
			});
		}
		var options = {
			url: 'https://api.spotify.com/v1/audio-analysis/' + id,
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};

		request.get(options, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				return res.send({
					success: true,
					analysis: body,
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function getCurrentPlaying(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			url: "https://api.spotify.com/v1/me/player/currently-playing",
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};
		request.get(options, (error, response, body) => {
			if (!error && response.statusCode === 200) {
				return res.status(200).send({
					success: true,
					is_playing: body.is_playing,
					object: body
				});
			} else if (!error && response.statusCode === 204) {
				return res.status(200).send({
					success: true,
					is_playing: false,
					object: null
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function getRecentlyPlayed(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			url: "https://api.spotify.com/v1/me/player/recently-played",
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};
		request.get(options, (error, response, body) => {
			if (!error && response.statusCode === 200) {
				return res.send({
					success: true,
					object: body
				});
			} else {
				return res.send({
					success: false
				});
			}
		});
	}

	function getTopArtists(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			url: "https://api.spotify.com/v1/me/top/artists",
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		};
		request.get(options, (error, response, body) => {
			if (!error && response.statusCode === 200) {
				return res.status(200).send({
					success: true,
					artists: body.items
				})
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function getDevices(token, res) {
		var options;
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		options = {
			url: "https://api.spotify.com/v1/me/player/devices",
			headers: {
					'Authorization': 'Bearer ' + token,
			},
			json: true
		}
		request.get(options, (error, response, body) => {
			if (!error && response.statusCode === 200) {
				return res.send({
					success: true,
					devices: body.devices
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	function transferPlayback(id, token, play = true, res) {
		if (token === undefined || token === '' || id === undefined || id === '') {
			console.log('cant transfer to player, no access token or id')
			return res.send({
				success: false
			});
		}
		var options = {
			url: "https://api.spotify.com/v1/me/player",
			body: {
				'device_ids': [
					id
				],
				'play': play
			},
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};
		request.put(options, (error, response, body) => {
			if (!error && response.statusCode === 204) {
				console.log('playback started on webplayer');
				return res.send({
					success: true
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	async function play(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `PUT`,
			uri: "https://api.spotify.com/v1/me/player/play",
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		};
		try {
			await rp(options);
			res.send({
				success: true
			});
		} catch(error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
	}

	async function pause(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `PUT`,
			uri: "https://api.spotify.com/v1/me/player/pause",
			headers: {
				"Authorization": 'Bearer ' + token,
			},
			json: true
		};
		try {
			await rp(options);
			res.send({
				success: true
			});
		} catch (error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
	}

	async function next(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `POST`,
			uri: "https://api.spotify.com/v1/me/player/next",
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		};
		try {
			await rp(options);
			res.send({
				success: true
			});
		} catch (error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
	}

	async function prev(token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `POST`,
			uri: "https://api.spotify.com/v1/me/player/previous",
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		};
		try {
			await rp(options);
			res.send({
				success: true
			});
		} catch (error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
	}

	function seek(ms, token, res) {
		if (token === undefined || token === '' || ms === undefined || ms === '') {
			return res.send({
				success: false
			});
		}
		options = {
			url: "https://api.spotify.com/v1/me/player/seek?position_ms="+ms,
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		}
		request.put(options, (error, response, body) => {
			if (!error && response.statusCode === 204) {
				return res.send({
					success: true
				});
			} else {
				console.log(body);
				return res.send({
					success: false
				});
			}
		});
	}

	async function shuffle(trueOrFalse, token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `PUT`,
			uri: "https://api.spotify.com/v1/me/player/shuffle?state=" + trueOrFalse,
			headers: {
				'Authorization': 'Bearer ' + token,
			},
			json: true
		};
		try {
			await rp(options);
			res.send({
				success: true
			});
		} catch (error) {
			Promise.reject(error);
			res.send({
				success: false
			});
		}
	}

	async function repeat(trackContextOff, token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `PUT`,
			uri: "https://api.spotify.com/v1/me/player/repeat?state=" + trackContextOff,
			headers: {
				'Authorization': 'Bearer '+token
			},
			json: true
		};
		try {
			await rp(options);
			console.log('Repeat: ' + trackContextOff);
			res.send({
				success: true
			});
		} catch (error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
		/*request.put(options, (error, response, body) => {
			if (!error && response.statusCode === 204) {
				console.log('Repeat: ' + trackContextOff);
				res.send({
					success: true
				});
			} else {
				console.log(body);
				res.send({
					success: false
				});
			}
		});*/
	}

	async function setVolume(volumePercent, token, res) {
		if (token === undefined) {
			return res.send({
				success: false
			});
		}
		var options = {
			method: `PUT`,
			uri: "https://api.spotify.com/v1/me/player/volume?volume_percent="+volumePercent,
			headers: {
				'Authorization': 'Bearer ' + token
			},
			json: true
		};
		try {
			await rp(options);
			console.log("Volume set to: " + volumePercent);
			res.send({
				success: true
			});
		} catch (error) {
			console.log(error);
			Promise.reject(error);
			res.send({
				success: false
			});
		}
		/*request.put(options, (error, response, body) => {
			if (!error && response.statusCode === 204) {
				console.log("Volume set to: " + volumePercent);
				res.send({
					success: true
				});
			} else {
				console.log(body);
				res.send({
					success: false,
				});
			}
		});*/
	}

	/***********************************END HELPERS**********************************************/

	return spotifyRoute;
}