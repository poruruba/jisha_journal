'use strict';

const HELPER_BASE = process.env.HELPER_BASE || "/opt/";
const Response = require(HELPER_BASE + 'response');
const Redirect = require(HELPER_BASE + 'redirect');

const JISHA_FILE = __dirname + "/data/list.json";
const PUBLIC_FOLDER = "";
const PUBLIC_IMAGE_FOLDER = process.env.THIS_BASE_PATH + "/public/" + PUBLIC_FOLDER + "/images/";
const GOOGLE_API_KEY = "yGoogleAPIƒL[z";
const GOOGLE_API_GEO_URL = "https://maps.googleapis.com/maps/api/geocode/json";

const dataurl = require('dataurl');
const fs = require('fs').promises;
const crypto = require('crypto');
const mime = require('mime-types');
const fetch = require('node-fetch');
const { URL, URLSearchParams } = require('url');
const Headers = fetch.Headers;

exports.handler = async (event, context, callback) => {
	var body = JSON.parse(event.body);
	console.log(body);
	
	if( event.path == '/jisha-unregister' ){
		var _id = body.id;
		var list = await readDataFile();
		var index = list.findIndex(item => item.id == _id);
		if( index >= 0 ){
			var item = list[index];
			var file_path = PUBLIC_IMAGE_FOLDER + "/images/" + item.fname;
			await fs.unlink(file_path);
			list.splice(index, 1);
			await writeDataFile(list);
		}
		return new Response({});
	}else

	if( event.path == '/jisha-list' ){
		var list = await readDataFile();
		return new Response({ list: list });
	}else

	if( event.path == '/jisha-register' ){
		var _name = body.name;
		var _lat = body.lat;
		var _lng = body.lng;
		var _date = body.date;
		var _url = body.url;
		var _dataurl = body.dataurl;
		var _memo = body.memo;

		var list = await readDataFile();
		var location = await latlng2location(_lat, _lng);
		console.log(location);
		var image = dataurl.parse(_dataurl);
		var id = crypto.randomUUID();
		var item = {
			id: id,
			name: _name,
			lat: _lat,
			lng: _lng,
			address: location.address,
			date: _date,
			url: _url,
			memo: _memo,
			fname: id + "." + mime.extension(image.mimetype)
		};
		list.push(item);
		await writeDataFile(list);

		var file_path = PUBLIC_IMAGE_FOLDER + "/images/" + item.fname;
		await fs.writeFile(file_path, image.data);
		
		return new Response({ id: item.id });
	}else

	if( event.path == '/jisha-update' ){
		var _id = body.id;
		var _name = body.name;
		var _lat = body.lat;
		var _lng = body.lng;
		var _date = body.date;
		var _url = body.url;
		var _memo = body.memo;
		var _dataurl = body.dataurl;

		var list = await readDataFile();
		var item = list.find(item => item.id == _id);
		if( !item )
			throw "not found";
		if( _name !== undefined ) item.name = _name;
		if( _lat !== undefined ) item.lat = _lat;
		if( _lng !== undefined ) item.lng = _lng;
		if( _url !== undefined ) item.url = _url;
		if( _memo !== undefined ) item.memo = _memo;
		if( _date !== undefined ) item.date = _date;
		if( _lat !== undefined || _lng !== undefined ){
			var location = await latlng2location(item.lat, item.lng);
			item.address = location.address;
		}
		if( _dataurl !== undefined ){
			var image = dataurl.parse(_dataurl);
			var file_path = PUBLIC_IMAGE_FOLDER + "/images/" + item.fname;
			await fs.unlink(file_path);
			item.fname = item.id + "." + mime.extension(image.mimetype);
			var new_file_path = PUBLIC_IMAGE_FOLDER + "/images/" + item.fname;
			await fs.writeFile(new_file_path, image.data);
		}
		await writeDataFile(list);
		
		return new Response({ id: item.id });
	}else

	if( event.path == '/jisha-retrieve-latlng' ){
		var _url = body.url;
		var _pluscode = body.pluscode;

		if( _url ){
			var latlng = await retrieve_latlng(_url);
			console.log(latlng);
			var location = await latlng2location(latlng.lat, latlng.lng);
			return new Response(location);
		}else if( _pluscode ){
			var location = await pluscode2location(_pluscode);
			return new Response( location );
		}else{
			throw "invalid parameter";
		}
	}else	

	{
		throw "unknown endpoint";
	}
};

async function readDataFile() {
	try {
		var list_json = await fs.readFile(JISHA_FILE, 'utf8');
		var list = [];
		if (list_json) {
			list = JSON.parse(list_json);
		}
		return list;
	} catch (error) {
		return [];
	}
}

async function writeDataFile(list) {
	await fs.writeFile(JISHA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

async function retrieve_latlng(url) {
	return fetch(url, {
		method: 'HEAD',
		redirect: 'manual',
	})
	.then((response) => {
		// for (let [key, value] of response.headers) {
		// 	console.log(`${key} = ${value}`);
		// }
		// console.log(response.status);
		var location = response.headers.get("location");
		console.log(location);
		var temp = location.split('/');
		var latlng = temp[6].substr(1).split(',');
		
		return { lat: parseFloat(latlng[0]), lng: parseFloat(latlng[1])};
	});
}

async function pluscode2location(pluscode){
	var params = {
		language: "ja",
		address: pluscode,
		key: GOOGLE_API_KEY
	};
	var result = await do_get(GOOGLE_API_GEO_URL, params);
	console.log(result);

	var comp = result.results[0].address_components;
	var pref = comp[comp.length - 2].long_name;
	var city = "";
	for( var i = comp.length - 3 ; i >= 0 ; i-- ){
		if( comp[i].types[0] == 'plus_code')
			continue;
		city += comp[i].long_name;
	}
	var address = { pref: pref, city: city };

	var location = result.results[0].geometry.location;
	var latlng = { lat: location.lat, lng: location.lng };

	return { latlng: latlng, address: address };
}

async function latlng2location(lat, lng){
	var params = {
		latlng: String(lat) + "," + String(lng),
		result_type: "locality",
		language: "ja",
		key: GOOGLE_API_KEY
	};
	var result = await do_get(GOOGLE_API_GEO_URL, params);
	console.log(result);

	var comp = result.results[0].address_components;
	var pref = comp[comp.length - 2].long_name;
	var city = "";
	for( var i = comp.length - 3 ; i >= 0 ; i-- )
		city += comp[i].long_name;
	var address = { pref: pref, city: city };

	var location = result.results[0].geometry.location;
	var latlng = { lat: location.lat, lng: location.lng };	

	return { latlng: latlng, address: address };
}

function do_get(url, qs) {
  var params = new URLSearchParams(qs);

  var params_str = params.toString();
  var postfix = (params_str == "") ? "" : ((url.indexOf('?') >= 0) ? ('&' + params_str) : ('?' + params_str));
	console.log(url + postfix);
  return fetch(url + postfix, {
      method: 'GET',
    })
    .then((response) => {
      if (!response.ok)
        throw new Error('status is not 200');
      return response.json();
    });
}