/*
 * Bahrunnur
 */
var express     = require('express'),
    bodyparser  = require('body-parser'),
    ibmbluemix  = require('ibmbluemix'),
    ibmdata     = require('ibmdata')
    ibmpush     = require('ibmpush');


// create an express app
var app = express();

// register bodyparser middleware
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({
  extended: true
}));

// configuration for application
var appConfig = {
    applicationId     : "f4f3a907-7b15-460b-ada1-9d4528a49f4e",
    applicationSecret : "f61e9a847346b567641d0fe09fd384f7ae28e2fe",
    applicationRoute  : "http://thisisrealive.mybluemix.net/"
};

// uncomment below code to protect endpoints created afterwards by MAS
// var mas = require('ibmsecurity')();
// app.use(mas);

// initialize mbaas-config module
ibmbluemix.initialize(appConfig);
var logger = ibmbluemix.getLogger();

app.use(function(req, res, next) {
    req.ibmpush = ibmpush.initializeService(req);
    req.data    = ibmdata.initializeService(req);
    req.logger  = logger;

    req.ibmpush.setEnvironment("sandbox");
    next();
});

// initialize ibmconfig module
var ibmconfig = ibmbluemix.getConfig();

// get context root to deploy your application
// the context root is '${appHostName}/v1/apps/${applicationId}'
var contextRoot = ibmconfig.getContextRoot();
RealiveApp = express.Router();
// app.use(contextRoot, RealiveApp);
app.use('/api/v0.1', RealiveApp);

console.log("contextRoot: " + contextRoot);

// log all requests
app.all('*', function(req, res, next) {
    console.log("Received request to " + req.url);
    next();
});

RealiveApp.get('/event/:id', function (req, res) {
    /*
     * GET event/:id
     * get event based on id, returning it object
     *
     */

    var evtId = req.params.id,
        evt = req.data.Query.ofType("Event");

    evt.findById(evtId).done(function (evt) {
        res.status(200).json(evt);
    }, function (error) {
        res.status(500).send({ error: error });
    });
});

RealiveApp.get('/event/:id/status', function (req, res) {
    var evtId = req.params.id,
        status = req.data.Query.ofType("EventStatus");

    // get event status based event id
    status.find({ eventId: evtId }).done(function (status) {
        res.status(200).json(status);
    }, function (error) {
        res.status(500).send({ error: error });
    });
});

RealiveApp.put('/event/:id/status', function (req, res) {
    // read status json object from req body
    var obj = req.body,
        evtId = req.params.id,
        evtStatus = req.data.Query.ofType("EventStatus");

    // update status of the event based on id
    evtStatus.find({ eventId: evtId }).then(function (status) {
        status.set("status", obj.status);
        status.save().done(function (savedStatus) {
            if (savedStatus.get("status") == "done") {
                req.ibmpush.deleteTag("event:" + evtId);
            }
            res.status(200).json(savedStatus);
        }, function (error) {
            res.status(500).send({ error: error });
        });
    }, function (error) {
        res.status(500).send({ error: error });
    });

});

RealiveApp.get('/event/:id/report', function (req, res) {
    // get realtime report about ongoing event based on event id
});

RealiveApp.post('/event/:id/report', function (req, res) {
    // post new report to ongoing event based on event id
    var report = req.body;

    var message = {
        "alert": report.message,
        "url": ""
    };

    var tag = "event:" + req.params.id;

    // push report to event subscriber
    req.ibmpush.sendNotificationByTags(message, tag);
});

RealiveApp.post('/event', function (req, res) {
    /*
     * POST event
     * post new event, creating new event object
     * push some notification to recipient responder
     *
     */

    var evtObject,
        evtStatus,
        evt = req.body;

    // create event object data
    evtObject = req.data.Object.ofType("Event", evt);

    // save it to mobile data 
    evtObject.save().then(function (savedEvt) {

        // create event status
        evtStatus = req.data.Object.ofType("EventStatus", {
            "eventId": savedEvt.get("id"),
            "status": "ongoing"
        })

        evtStatus.save();

        // try to push notif to recipient responder
        // push to all responder in (evt.responders and nearby lat lng)
        var message = {
            "alert": savedEvt.get("name"),
            "url": ""
        };

        req.ibmpush.sendNotificationByTags(message, evt.responders);

        var tagName = "event:" + savedEvt.get("id");
        req.ibmpush.createTag(tagName, savedEvt.get("name"));

        res.status(200).json({ "newTag": tagName });
    }, function (error) {
        res.status(500).send({ error: error });
    });

});

RealiveApp.post('/responder', function (req, res) {
    var responder = req.body,
        responderObject = req.data.Object.ofType("Responder", responder);

    responderObject.save().done(function (savedResponder) {
        res.status(200).json(savedResponder);
    }, function (error) {
        res.status(500).send({ error: error });
    });
});

// host static files in public folder
// endpoint:  https://mobile.ng.bluemix.net/${appHostName}/v1/apps/${applicationId}/static/
RealiveApp.use('/static', express.static('public'));

//redirect to cloudcode doc page when accessing the root context
app.route('/')
    .get(function (req, res) {
        // TODO: make sample event request, with predefined event data
        res.sendfile('public/index.html');
    })
    .post(function (req, res) {
        // TODO: create push notification
    })

app.listen(ibmconfig.getPort());
console.log('Server started at port: '+ibmconfig.getPort());
