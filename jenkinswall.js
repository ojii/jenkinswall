// Some Constants

var OK =		"OK";
var FAIL =		"FAIL";
var PENDING =	"PENDING";
var DISABLED =	"DISABLED";
var ABORTED =	"ABORTED";
var UNSTABLE =	"UNSTABLE";
var RUNNING =	"RUNNING";

// All color codes allow the '_anime' suffix which indicates a build
// is running from the current state to possibly a new state.
// General comment to the colors: WTF?
var COLORS = {
	FAIL:		'red',
	UNSTABLED:	'yellow',
	OK:			'blue', // WTF?
	DISABLED:	'disabled',
	ABORTED:	'aborted',
	PENDING:	'grey'
}

// We also need the reverse codes, to do stuff generically
var R_COLORS = {}
Object.each(COLORS, function(key, item){
	R_COLORS[key] = item;
	R_COLORS[key + '_anime'] = RUNNING;
});


/*
 * The ORDER defines what state is most 'important'. A single job
 * in a 'higher' state will superseed all other jobs.
 * 
 * In the default order, a single failed job will cause the FAIL
 * message to show and a single running job will force the state to
 * be RUNNING. OK will only show if all jobs are okay.
 */
var ORDER = [OK, FAIL, RUNNING];

// JenkinsWall class
var JenkinsWall = new Class({
	Implements: [Options, Events],
	options: {
		text: {
			OK:			"YES!",
			FAIL:		"NO!",
			RUNNING:	"Running..."
		},
		classes: {
			OK:			"success",
			FAIL:		"fail",
			RUNNING:	"running"
		},
		ids: {
			answer:		'answer',
			affected:	'affected'
		},
		url: 'http://ci.django-cms.org',
		interval: 2500,
		debug: false
	},
	
	initialize: function(options){
		this.setOptions(options);
		this.timer = null;
		this.oldstate = null;
		this.body = $$('body');
		this.answer = $(this.options.ids.answer);
		this.affected = $(this.options.ids.affected);
		this.addEvent('status_changed', this.render.bind(this), true);
	},
	
	start: function(){
		if (!this.timer){
			this.check();
			this.timer = this.check.bind(this).periodical(this.options.interval);
		}
	},
	
	stop: function(){
		if(this.timer){
			clearInterval(this.timer);
		}
		this.timer = null;
	},
	
	check: function(){
		/*
		 * Asks the API for the status of the jobs (using JSONP) and
		 * calls the `update` function on success
		 */
		this.fireEvent("pre_check");
		new Request.JSONP({
			url: this.options.url + '/api/json',
			callbackKey: 'jsonp',
			onSuccess: this._handle_data.bind(this)
		}).send();
		this.fireEvent("post_check");
	},
	
	render: function(oldstate, newstate){
		this.fireEvent('render');
		this.answer.set('text', this.options.text[newstate]);
		this.body.set('class', this.options.classes[newstate]);
		affected.empty();
		if (newstate != OK ){
			this.data.splitted[newstate].each(function(job){
				var li = new Element('li', {
					'html': job.name,
				});
				this.affected.adopt(li);
			});
		}
	},
	
	_handle_data: function(data){
	   /*
	    * Update the screen by processing the JSON data using the
	    * `getStatusProjects` function.
	    * 
	    * If the status is not OK, display the unhealthy jobs.
		*/
		this.fireEvent("data_received", [data]);
		this.data = this._process_data(data.jobs);
		this.fireEvent("data_processed", [this.data]);
		if ((!this.oldstate) || this.oldstate.overallStatus != this.data.overallStatus){
			this.fireEvent("status_changed", [this.oldstate ? this.oldstate.overallStatus : null, this.data.overallStatus]);
		}
		this.oldstate = this.data;
	},
	
	_process_data: function(jobs){
		/*
		 * Turn the weird JSON from Jenkins into proper information we
		 * can actually use.
		 * 
		 * Returns an object with two attributes:
		 *     splitted: An object of STATE->Array of jobs
		 *     overallStatus: The overall status of the CI server.
		 */
		var splitted = {
			FAIL: [],
			OK: [],
			PENDING: [],
	  		DISABLED: [],
	  		ABORTED: [],
			UNSTABLE: [],
			RUNNING: []
		};

		var overallStatus = OK;
		var oldIndex = ORDER.indexOf(overallStatus);
		jobs.each(function (job){
			// Convert job color to job status
			var jobStatus = R_COLORS[job.color];
			if (jobStatus == RUNNING){
				var oldColor = job.color.substr(0, job.color.length - 6);
				var oldStatus = R_COLORS[oldColor];
				splitted[oldStatus].push(job);
				jobStatus = RUNNING;
			} else {
				splitted[jobStatus].push(job);
			}
			var newIndex = ORDER.indexOf(jobStatus);
			if (newIndex > oldIndex){
				overallStatus = jobStatus;
			}
		});
		return {
			splitted: splitted,
			overallStatus: overallStatus
		};
	},

	debug: function(state){
		if (state){
			this.options.debug = true;
			this.stop();
		} else {
			this.options.debug = false;
			this.start();
		}
	}
});


function enable_wall_logging(wall){
	wall.addEvent('pre_check', function(){console.log("Pre Check")});
	wall.addEvent('post_check', function(){console.log("Post Check")});
	wall.addEvent('render', function(){console.log("Rendering")});
	wall.addEvent('data_received', function(data){console.log("Received Data: " + data)});
	wall.addEvent('data_processed', function(data){console.log("Processed Data: " + data)});
	wall.addEvent('status_changed', function(oldstatus, newstatus){console.log("Status changed from '" + oldstatus + "' to '" + newstatus + "'")});
}
