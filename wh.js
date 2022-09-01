#!/usr/bin/env node

const port = 3000;

const express = require('express'),
      ipp = require('ipp'),
	    PDFDocument = require('pdfkit');
	    
const app = express();
app.use(express.json({ extended: true }));

// PRINT LABELS
function print(json, response) {
	
  var printerName = json.printer;
  var kids = json.children;
  
  var totalLabels = 0;
	// Labels are generated using PDFkit.
	// Find more options and formatting help at http://pdfkit.org
	var doc = new PDFDocument({
		size: [165,288],// 30256 DYMO Large Shipping Labels
		margins: 1
	});
	
	var buffers = [];
	doc.on('data', buffers.push.bind(buffers));
	doc.on('end', function () {
	    if (totalLabels > 0){
		    var printer = ipp.Printer("http://localhost:631/printers/"+printerName);
		    var file = {
		        "operation-attributes-tag":{
		            "requesting-user-name": "User",
		        "job-name": "Print Job",
		        "document-format": "application/pdf"
		        },
		        data: Buffer.concat(buffers)
		    };
		
		    printer.execute("Print-Job", file, function (err, res) {
		        console.log('Printed: '+res.statusCode);
		        console.log(res);
		        // Callback
		        response.send(res);
		    });
	    }
	});
	
	// LANDSCAPE TAG
	doc.rotate(90);
	// FIRST PDF PAGE IS AUTOMATICALLY CREATED
	var firsttag = true;
	// LOOP THROUGH EACH CHILD & ADD LABELS
	for (var i = 0; i < kids.length; i++) {
		var code = json.code;
		var p = kids[i];
		// GET QUANTITY OF LABELS TO PRINT
		var qty = 0;
		// Room trumps Grade
		if (p && p.room && p.room.label_quantity){
			qty = p.room.label_quantity;
		} else if (p && p.grade && p.grade.label_quantity) {
			qty = p.grade.label_quantity
		}
		console.log(qty+' tags will print for '+p.first_name);
		if (qty < 1){ return }
		
		// FORMAT LABEL
		for (var q = 0; q < qty; q++) {
			totalLabels++;
			if (firsttag){
				firsttag = false
			} else {
				doc.addPage().rotate(90)
			}
			// FIRST NAME
			doc.fontSize(36).font('Helvetica-Bold').text(p.first_name, 15, -150);
			// LAST NAME
			doc.fontSize(16).font('Helvetica').text(p.last_name, 16, -117);
			// DIVIDING LINE
			doc.lineWidth(4).lineCap('butt').moveTo(16,-100).lineTo(273,-100).stroke();
			// GENDER
			var gender = (p.gender==1)?'Male':'Female';
			doc.fontSize(20).font('Helvetica-Bold').text(p.gender, 16, -94);
			// AGE
			doc.text(getAge(p.birthdate), 70, -94, {width:200, align:'right'});
			// ROOM
			var room = (p && p.room && p.room.name)?'Room: '+p.room.name:'';
			doc.fontSize(14).text(room, 16, -77);
			// GRADE
			var grade = (p && p.grade && p.grade.name)?'Grade: '+p.grade.name:'';
			doc.text(grade, 71, -77, {width:200, align:'right'});
			// NOTES
			var notes = (p.allergies_notes&&p.allergies_notes!=='')?'Allergies/Notes:':'';
			doc.fontSize(10).font('Helvetica').text(notes, 17, -62);
			// NOTES DESCRIPTION
			var noteson = (p.allergies_notes&&p.allergies_notes!=='')?p.allergies_notes:'';
			doc.fontSize(9).text(noteson, 17, -50, {width:170});
			// TIMESTAMP
			doc.fontSize(7).text(timestamp(json.timestamp), 17, -20);
			// GRAY BOX BEHIND CODE
			doc.lineWidth(44).strokeColor('gray').lineCap('butt').moveTo(190,-36).lineTo(273,-36).stroke();
			// SECURITY CODE
			doc.fontSize(40).font('Helvetica-Bold').fillColor('white').text(code, 182, -52, {width:100,align:'center'});
		}
	}
	doc.end();
	console.log('Printing to '+printerName);
}
function testPrint(printerName, response) {
	var doc = new PDFDocument({
		size: [165,288],// 30256 DYMO Large Shipping Labels
		margins: 1
	});
	
	var buffers = [];
	doc.on('data', buffers.push.bind(buffers));
	doc.on('end', function () {
	    var printer = ipp.Printer("http://localhost:631/printers/"+printerName);
			console.log(printer);
	    var file = {
	        "operation-attributes-tag":{
	            "requesting-user-name": "User",
	        "job-name": "Print Job",
	        "document-format": "application/pdf"
	        },
	        data: Buffer.concat(buffers)
	    };
	
	    printer.execute("Print-Job", file, function (err, res) {
	        console.log('Printed: '+res.statusCode);
	        console.log(res);
	        // Callback
	        response.send(res)
	    });
	});
	
	doc.rotate(90);
	doc.fontSize(36).font('Helvetica-Bold').text('Test', 14, -150);
	
	doc.end();
}

// FORMATTING UTILITIES
function getAge(dt,format) {
    if (dt=='0000-00-00'){return ''}
    var t = new Date();
    var b = new Date(dt);
    var d = Math.floor((t-b)/(1000*60*60*24));
    var w = Math.floor((t-b)/(1000*60*60*24*7));
    var m = Math.floor((t-b)/(1000*60*60*24*30));
    var y = Math.floor(d/365);
    var c = (format)?'year-old':'years';
    var age = y;
    if (m<24){age=m;c=(format)?'month-old':'months'}
    if (w<24){age=w;c=(format)?'week-old':'weeks'}
    if (d<24){age=d;c=(format)?'day-old':'days'}
    return age+' '+c;
}
function timestamp(ts) {
	var m = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
		n = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
		d = new Date(ts),
		h = d.getHours(),
		s = d.getMinutes();
	var hours = (h>12)?(h-12):(h+1),
		min = (s<10)?'0'+s:s,
		pm = (h>11)?'pm':'am';
	return n[d.getDay()]+', '+m[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()+' @ '+hours+':'+min+pm
}

// START SERVER TO LISTEN FOR WEBHOOK
app.post('/webhook', function (req, res) {
  var j = req.body;
  if (j.job_type == 'test') {
    testPrint(j.printer, res)
  } else {
    print(j, res)
  }
  console.log(j);
  //res.send(j);
});

app.get('/', function (req, res) {
  res.send('Ready to receive at /webhook');
});

app.listen(port, function (req, res) {
  console.log('Server listening on port '+port);
});