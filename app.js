var express = require('express'),
    cradle = require('cradle');

var app = express.createServer();
var conn = new(cradle.Connection)("http://localhost", 5984, {cache: true});
var db_users = conn.database('users');
var db_devices = conn.database('devices');
var crypto = require('crypto');
var io = require('socket.io').listen(app);

app.use(express.logger());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({ secret: "droidToChromeRMR" }));

app.get('/', function(req, res){
    res.send("Hello World");
});

app.post('/register', function(req, res){
    console.log(req.headers);
    var data = req.body;
    console.log(data);
    res.contentType('application/json');
    db_users.view('user/usermap', {key: data.username}, function(err, doc) {
    if(doc) {
	console.log(data);
	res.send({success: false, error: 'User already exists' });
    } else {
	delete data.confirm_password;
	data.password = converthash(data.password, randomString(10));
	data.device_array = []
	console.log(data.password)
	db_users.save(data , function(db_users_err, db_users_res) {
	    req.session.is_authenticated = true;
	    req.session.user = data.usern;
	    res.send({success:true});
      });
    }
  });
});

app.post("/pc/login", function(req, res){
    var data = req.body;
    console.log(data);
    res.contentType('application/json');
    db_users.view('users/usermap', {key: data.username}, function(err, docs) {
	if (docs){
	    doc = docs[0].value;
	    password = doc.password;
	    console.log(doc);
	    verify_password(data.password, password, function(match){
		if(match){
		    device_name = data.device_name;
		    if(doc.device_array){
			device_array = doc.device_array;
		    }
		    else{
			device_array = [];
		    }
		    if(device_array.indexOf(device_name) == -1){
			device_array.push(device_name);
                        db_users.merge(doc._id, {"device_array": device_array},
				function(err, res){
				     console.log(err);
                                     console.log(res);
		        });
			device_row = {"user_id": doc._id, "device": device_name}
			//db_devices.save(device_row, pc_auth);

                    }
		    req.session.is_authenticated = true;
		    req.session.username = data.username;
		    res.send({"success":true, "uuid": doc._id});
		    console.log("Success True");
		}
		else{
		    req.session.is_authenticated = false;
		    res.send({success: false, error: 'Password Didnt Match' });
		}
	    });
	}
	else{
	    res.send({success: false, error: "Username Doesn't Exist"});
	}
    });

});


app.post('/login', function(req, res){
    var data = req.body;
    console.log(data);
    res.contentType('json');
    db_users.view('users/usermap', {key: data.username}, function(err, docs) {
	if (docs){
	    doc = docs[0].value;
	    password = doc.password;
	    verify_password(data.password, password, function(match){
		if(match){
		    req.session.is_authenticated = true;
		    req.session.username = data.username;
		    res.send({success:true});
		}
		else{
		    req.session.is_authenticated = false;
		    res.send({success: false, error: 'Password Didnt Match' });
		}
	    });
	}
	else{
	    //req.sessions.is_authenticated = false
	    res.send({success: false, error: "Username Doesn't Exist"});
	}
    });
});


app.post('/share', function(req, res){
    //if(req.session.is_authenticated){
        username = req.body.username;
	link = req.body.url;
	socket = sockets_hash[username];
        socket.emit("urls", {"url" : link});
    console.log(socket);
        res.send({success:true});
    //}
});

function verify_password(password, hash, callable){
    var salt = hash.split("$")[1];
    var hash_pass = converthash(password, salt);
    if(hash_pass == hash)
	callable(true)
    else
	callable(false)
}

function converthash(text, salt){
    var hash = crypto.createHmac('sha1', salt).update(text).digest('hex');
    return hash + "$" + salt;
}

function randomString(len){
    var randomStr = ""
    var charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < len; i++) {
        var randomPoz = Math.floor(Math.random() * charSet.length);
        randomStr += charSet.substring(randomPoz, randomPoz+1);
    }
     return randomStr;
}

sockets_hash = {}

io.sockets.on('connection', function (socket) {
  socket.on('auth', function (data) {
      console.log(data);
      uuid = data.uuid;
      device_name = data.device_name;
      db_users.get(uuid, function(err, doc){
	  username = doc.username
      });
      console.log(data);
  });
});

app.listen(8080);