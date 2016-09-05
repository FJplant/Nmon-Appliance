/*
 * Constants first
 */
var HOSTS_BACK_TIME = 1000*60*1;    // in milli seconds, 1 minutes
var REFRESH_INTERVAL = 2000;        // in milli seconds
var DEBUG = false;                  // for debug purpose

var curResType = "HOSTS";
var reqStatus = {
    "HOSTS": false,
    "CPU": false,
    "MEM": false,
    "SWAP": false,
    "NET": false,
    "NFS": false,
    "PROCESS_CPU": false,
    "PROCESS_MEM": false
};

function isLoading(restype) {
    return reqStatus[restype];
}

function getCurResType() {
    return curResType;
}

function setCurResType(newResType) {
    curResType = newResType;
}

//
// Get host lists and add them to options box
function getHosts(category) {
    $.ajax({
        url: "/All/" + category + "/hosts",
        data: {},
        success: function(data) {
            var result = eval(data);
            var html = '<option value="aix-db1">Select host</option>';
            // do not show all hosts flag
            //html += '<option value="All">All</option>';
            for (var i = 0; i < result.length; i++) {
                html += '<option value="' + result[i] + '">' + result[i] + '</option>';
            }
            $("#hosts").html(html);
        }
    });
}

//
// Draw Stacked Area or Stacked Bar chart for CPU, Memory, Virtual Memory, Disk, Network
//
// TODO: Add view finder window
function drawAreaChart(did, data, xlabel, ylabel, isBarChart, isInOut) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    var d3data = [ ];
    for(var i = 1; i < data[0].length; i++) {
        d3data.push({key: data[0][i], values:[]}); // series name ( header )
    }

    for(var j = 1; j < data.length; j++) { // rows
        for(var i = 1; i < data[0].length; i++) { // series
            // Disk and network chart draws write or send amount as minus value
            if ( i == 2 && (data[0][i] === 'write' || data[0][i] === 'send'))
                d3data[i-1].values.push([data[j][0], -data[j][i]]); // push key value order and insert d3data from 0 row
            else 
                d3data[i-1].values.push([data[j][0], data[j][i]]);
        }
    }

    nv.addGraph(function() {
        // CPU, Disk, I/O => stracked bar chart
        // Memory, VM => stacked area chart
        var chart = ( isBarChart === true ) ? nv.models.multiBarChart() : nv.models.stackedAreaChart();

        chart.x(function(d) { return d[0] })   // We can modify the data accessor functions...
             .y(function(d) { return d[1] })   // ...in case your data is formatted differently.
             .useInteractiveGuideline(true)    // Tooltips which show all data points. Very nice!
             .showControls(false)              // Disallow user to choose 'Stacked', 'Stream', 'Expanded' mode.
             .duration(500)                    // Set transition time to 500ms
             .color(d3.scale.category10().range())
             .clipEdge(true);

        if ( isBarChart ) {
            chart.multibar.stacked(true);
        }
        else {
            chart.interpolate('cardinal-open');
        }

        //Format x-axis labels with custom function.
        chart.xAxis
             .axisLabel(xlabel)
             .tickFormat(function(d) { 
                 return d3.time.format('%m-%d %H:%M')(new Date(d));
        });

        chart.yAxis
            .axisLabel(ylabel)
            .tickFormat(d3.format(',.2f'));

        d3.select('#' + did + ' svg')
          .datum(d3data)
          .call(chart);
        
        nv.utils.windowResize(chart.update);

        return chart;
    });
}

//
// Draw pie chart for process chart
function drawPieChart(did, data) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    var d3data = [ ];
    for(var j = 1; j < data.length; j++)
        d3data.push({label: data[j][0], value: data[j][1]});

    nv.addGraph(function() {
        var chart = nv.models.pieChart()
                       .x(function(d) { return d.label })
                       .y(function(d) { return d.value })
                       .donut(true)
                       .donutRatio(0.35)
                       .legendPosition("right") //nvd3.js v1.8.1
                       .showLegend(true) //nvd3.js v1.8.0
                       .showLabels(true);

        d3.select('#' + did + ' svg')
          .datum(d3data)
          .call(chart);

        nv.utils.windowResize(chart.update);

        return chart;
    });
}

// Draw scatter chart for server insight
//
function drawScatterChart(did, data, xlabel, ylabel) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    console.log(JSON.stringify(data));
    var d3data = [];
    for(var i = 1; i < data.length; i++) {
        d3data.push({
            key : data[i][0], 
            values: [{x: data[i][1], y: data[i][2], size: data[i][4], network: data[i][3] }]
        });
    }
    console.log(JSON.stringify(d3data));

    nv.addGraph(function() {
        var chart = nv.models.scatterChart()
                    .showDistX(true)  //showDist, when true, will display those little distribution lines on the axis.
                    .showDistY(true)
                    //.transitionDuration(350) // transitionDuration is not a function error
                    .color(d3.scale.category10().range());

        // nvd3.js 1.8.1
        chart.tooltip.contentGenerator(function(obj) {
            var html = '<h3>' + obj.series[0].key + '</h3>';
            html += '<p>CPU : ' + (Math.round(obj.series[0].values[0].y * 100) / 100) + '%<br>';
            html += 'Disk : ' + (Math.round(obj.series[0].values[0].x * 100) / 100) + 'KB/s<br>';
            html += 'Network : ' +  (Math.round(obj.series[0].values[0].network * 100) / 100) + 'KB/s<br>';
            html += 'No. of CPU : ' + obj.series[0].values[0].size + '<br></p>';
            return html;
        });

        /*
        // nvd3.js 1.8.0
        chart.tooltipContent(function (key, x, y, e, graph) {
            var html = '<h3>' + key + '</h3><p>';
            html += 'CPU : ' + y + '%<br>';
            html += 'Disk : ' + x + 'KB/s<br>';
            html += 'Network : ' +  (Math.round(graph.series.values[0].network * 100) / 100) + 'KB/s<br>';
            html += 'No. of CPU : ' + graph.series.values[0].size + '<br></p>';
            return html;
        });
        */

        //Axis settings
        chart.xAxis.axisLabel(xlabel).tickFormat(d3.format('.02f'));
        chart.yAxis.axisLabel(ylabel).tickFormat(d3.format('.02f'));

        d3.select('#' + did + ' svg')
          .datum(d3data)
          .call(chart);

        nv.utils.windowResize(chart.update);

        return chart;
    });
}

// Periodic server performance data fetch
// TODO: need to change to fetch only updated data
function updateGraph(hostname, restype, fromDate, toDate) {
    var start = new Date();

    // hosts - always update this area
    if (restype == "HOSTS" || restype == "ALL" || document.getElementById('hosts_chart')) {
        reqStatus["HOSTS"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting HOSTS data.");
        $.ajax({
            url: "/" + hostname + "/HOST?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["HOSTS"] = false;
                drawScatterChart("hosts_chart", data, 'Disk (KB/s)', 'CPU (%)');
                if (DEBUG) console.log(' HOSTS chart respose: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // cpu
    if (restype == "CPU" || restype == "ALL") {
        reqStatus["CPU"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting CPU data. ");
        $.ajax({
            url: "/" + hostname + "/CPU_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['User', 'Sys', 'Wait']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["CPU"] = false;
                drawAreaChart("cpu_chart", result, 'Time', '%', true);
                if (DEBUG) console.log('  CPU chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // memory
    if (restype == "MEM" || restype == "ALL") {
        reqStatus["MEM"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting MEM data. ");
        $.ajax({
            url: "/" + hostname + "/MEM_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Real total', 'Real free']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["MEM"] = false;
                result[0][1] = 'Real used';
                for (var i = 1; i < result.length; i++) {
                    result[i][1] = result[i][1] - result[i][2];
                }
                drawAreaChart("mem_chart", result, 'Time', 'MB');
                if (DEBUG) console.log('  MEM chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // swap
    if (restype == "SWAP" || restype == "ALL") {
        reqStatus["SWAP"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting SWAP data. ");
        $.ajax({
            url: "/" + hostname + "/MEM_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Virtual total', 'Virtual free']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["SWAP"] = false;
                result[0][1] = 'Virtual used';
                for (var i = 1; i < result.length; i++) {
                    result[i][1] = result[i][1] - result[i][2];
                }
                drawAreaChart("swap_chart", result, 'Time', 'MB');
                if (DEBUG) console.log('  SWAP chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // disk
    if (restype == "DISK" || restype == "ALL") {
        reqStatus["DISK"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting DISK data. ");
        $.ajax({
            url: "/" + hostname + "/DISK_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['read', 'write']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["DISK"] = false;
                drawAreaChart("disk_chart", result, 'Time', 'KB/s', true);
                if (DEBUG) console.log(' DISK chart response:' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // network
    if (restype == "NET" || restype == "ALL") {
        reqStatus["NET"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting NET data. ");
        $.ajax({
            url: "/" + hostname + "/NET_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['recv', 'send']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["NET"] = false;
                drawAreaChart("network_chart", result, 'Time', 'KB/s', true);
                if (DEBUG) console.log(' NET chart response :' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // process cpu usage
    if (restype == "PROCESS_CPU" || restype == "ALL") {
        reqStatus["PROCESS_CPU"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting PROCESS_CPU data. ");
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=cpu",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["PROCESS_CPU"] = false;
                drawPieChart("process_cpu_chart", data);
                if (DEBUG) console.log(' PROCESS_CPU chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // process mem usage
    if (restype == "PROCESS_MEM" || restype == "ALL") {
        reqStatus["PROCESS_MEM"] = true;
        if (DEBUG) console.log("[" + start.toLocaleString() + "] Requesting PROCESS_MEM data. ");
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=mem",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["PROCESS_MEM"] = false;
                drawPieChart("process_mem_chart", data, "Process usage by MEM");
                if (DEBUG) console.log(' PROCESS_MEM chart respose: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }
}

// Issue periodic chart refresh
//
function refresh_charts() {
    var fromDate, toDate, now = new Date();

    /*
    fromDate = new Date($("#from").val() + " " + $("#from_time").val());

    if ($("#to").val() !== "now")
        toDate = new Date($("#to").val() + " " + $("#to_time").val());
    else
        toDate = new Date();
    */
    fromDate = $('#period-navigator').dateRangeSlider('values').min;
    toDate = $('#period-navigator').dateRangeSlider('values').max;
    //console.log('fromDate:' + fromDate + ', toDate: ' + toDate);
    if ( !isLoading("HOSTS") || !isLoading(getCurResType()) ) {
        if ( !isLoading("HOSTS") ) {
            updateGraph("All", "HOSTS", new Date(now.getTime() - HOSTS_BACK_TIME ), now); // Draw last HOST_BACK_TIME
            if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + "Server insights chart refreshed." );
        } 
        if ( !isLoading(getCurResType()) ) {
            updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
            if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + getCurResType() + " chart refreshed." );
        }
    } else {
      if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + "previous refresh is on-going ");
    }

    // Try to Refresh every 2 seconds
    setTimeout( refresh_charts, REFRESH_INTERVAL );
}

// Main function
//
$(function() {
    getHosts('CPU_ALL');

    $("#hosts").on('change', (function(event) {
        // TODO: consider other resource was set .
        if (curResType === 'HOSTS') {
           setCurResType('CPU');
        }
    }));

    $("#view").click(function(event) {
        setCurResType('CPU');
    });

    // Initiate first refresh_charts call
    // Refresh every REFRESH_INTERVAL milli seconds
    // excute when #cpu_chart or #hosts_chart div id exist
    if (document.getElementById('cpu_chart') || document.getElementById('hosts_chart')) {
        setTimeout( refresh_charts, REFRESH_INTERVAL );
        if (DEBUG) console.log('cpu_chart exists');
    }
    else {
        if (DEBUG) console.log('no cpu charts');
    }
});

// JQuery UI Date picker event handler
//
$(function() {
    $("#from").datepicker({
        defaultDate: "-7m",
        changeMonth: true,
        changeYear: true,
        maxDate: "0",
        numberOfMonths: 1,
        selectOtherMonths: true,
        showOtherMonths: true,
        onClose: function(selectedDate) {
            $("#to").datepicker("option", "minDate", selectedDate);
        }
    });
    $("#to").datepicker({
        defaultDate: "0",
        changeMonth: true,
        changeYear: true,
        maxDate: "0",
        numberOfMonths: 1,
        selectOtherMonths: true,
        showOtherMonths: true,
        onClose: function(selectedDate) {
            $("#from").datepicker("option", "maxDate", selectedDate);
        }
    });

    /*
     * TODO: This is just POC version
     *       Have to consider long days analysis
     *       1 time frame is 5 mins now.
     */
    $("#slider-range-date").slider({
        min: 0,
        max: 365 * 3,
        values: [0, 365 * 3],
        slide: function(event, ui) {}
    });

    $("#slider-range-time").slider({
        range: true,
        min: 0,
        max: 60 * 24 * 2 / 5,
        values: [0, 60 * 24 * 2 / 5 - 1],
        slide: function(event, ui) {
            // TODO: need to process 24:00 => 23:59:59
            var min = 0,
                max = 60 * 24 * 2 / 5,
                hour = 0,
                hourstr, min = 0,
                minstr;

            if (ui.values[0] > max / 2) {
                $("#slider-range-time").slider("values", 0, max / 2);
                hour = max / 2 * 5 / 60;
                ui.values[0] = max / 2;

                // Just workaround, folowing refresh generates javascript error.
                // But, it works as I wanted... :-) youngmo 2015.8.16.
                $("#slider-range-time").slider("refresh");
            } else {
                hour = Math.floor(ui.values[0] * 5 / 60);
            }
            if (hour < 10) hourstr = "0" + hour;
            else hourstr = "" + hour;
            min = (ui.values[0] * 5) % 60;
            if (min < 10) minstr = "0" + min;
            else minstr = "" + min;
            $("#from_time").val(hourstr + ":" + minstr);

            if (ui.values[1] < max / 2) {
                $("#slider-range-time").slider("values", 1, max / 2);
                hour = max / 2 * 5 / 60;
                ui.values[1] = max / 2;
                // Just workaround, folowing refresh generates javascript error.
                // But, it works as I wanted... :-) youngmo 2015.8.16.
                $("#slider-range-time").slider("refresh");
            } else {
                hour = Math.floor((ui.values[1] - max / 2) * 5 / 60);
            }
            if (hour < 10) hourstr = "0" + hour;
            else hourstr = "" + hour;
            min = ((ui.values[1] - max / 2) * 5) % 60
            if (min < 10) minstr = "0" + min;
            else minstr = "" + min;
            $("#to_time").val(hourstr + ":" + minstr);
        }
    });
    $("#from_time").val("00:00");
    $("#to_time").val("23:59:59");
});

// JQuery UI Tab event handler
//
$(function() {
    $("#tabs").tabs({
        // event: "beforeActivate"
        beforeActivate: function(event, ui) {
           
            // Same code with View clicked event handler need to merge to one
            var fromDate, toDate;

            fromDate = new Date($("#from").val() + " " + $("#from_time").val());

            if ($("#to").val() !== "now")
                toDate = new Date($("#to").val() + " " + $("#to_time").val());
            else
                toDate = new Date();

            var curRes, newTab = ui.newTab.text();
 
            switch (newTab.trim()) {
//                case "Hosts":
//                    curRes = "HOSTS";
//                    setLoading("hosts_chart", curRes, "Loading hosts chart. Wait a moment...");
//                    break;
                case "CPU":
                    curRes = "CPU";
                    setLoading("cpu_chart", curRes, "Loading CPU chart. Wait a moment...");
                    break;
                case "Memory":
                    curRes = "MEM";
                    setLoading("mem_chart", curRes, "Loading Memory chart. Wait a moment...");
                    break;
                case "Swap":
                    curRes = "SWAP";
                    setLoading("swap_chart", curRes, "Loading SWAP chart. Wait a moment...");
                    break;
                case "Disk":
                    curRes = "DISK";
                    setLoading("disk_chart", curRes, "Loading DISK chart. Wait a moment...");
                    break;
                case "Network":
                    curRes = "NET";
                    setLoading("network_chart", curRes, "Loading Network chart. Wait a moment...");
                    break;
                case "NFS":
                    curRes = "NFS";
                    setLoading("nfs_chart", curRes, "NFS Chart is currently not served !!!! Try other charts. ");
                    break;
                case "Process CPU Usage":
                    curRes = "PROCESS_CPU";
                    setLoading("process_cpu_chart", curRes, "Loading Process usage by CPU chart. Wait a moment...");
                    break;
                case "Process Memory Usage":
                    curRes = "PROCESS_MEM";
                    setLoading("process_mem_chart", curRes, "Loading Process usage by memory chart. Wait a moment...");
                    break;
                case "Process Bubble Chart":
                    draw_bubble_chart();
                    curRes = "NONE";
                    break;
                default:
                    curRes = "NONE";
                    break;
            }

            if (DEBUG) {
            console.log("[Calling updateGraph from UI-tab] " +
                "Hosts: " + $("#hosts").val() +
                ", Tab: " + curRes +
                ", From: " + fromDate.toLocaleString() +
                ", To: " + toDate.toLocaleString());
            }
            
            refresh_charts();
            // TODO: remove old code
            //updateGraph($("#hosts").val(), curRes, fromDate, toDate);
        }
    });
});

// Show progress bar in tabbedpane
// 
function setLoading(areaid, reqResType, message) {
    var areaelem = document.getElementById(areaid);
    var proghtml = '<div id="' + areaid + '_progressbar' + '" style="position: relative;">'
                 + '  <div class="'
                 + areaid + '_progresslabel' 
                 + '" style="position: absolute; left: 15%; top: 4px; font-weight: bold; text-shadow: 1px 1px 0 #fff;"></div>'
                 + '</div>';
    areaelem.innerHTML = proghtml;

    var progressBar = $("#" + areaid + "_progressbar"),
        progressLabel = $("." + areaid + "_progresslabel");

    progressBar.progressbar({
        value: false,
        change: function() {
            progressLabel.text(progressbar.progressbar("value") + "%");
        },
        complete: function() {
            progressLabel.text("Complete!");
            progressBar.progressbar("value", 100);
            if (DEBUG) console.log('[Progress Bar]' + reqResType + ' loading is completed... from progress bar');
        }
    });
    progressBarValue = progressBar.find(".ui-progressbar-value");
    progressBarValue.css({
        "background": "#FFFF80"
    });
    progressLabel.text(message);
    setCurResType(reqResType);

    function loading() {
        var val = $("#" + areaid + "_progressbar").progressbar("value") || 0;
        //var val = progressBar.progressbar("value") || 0;

        if (isLoading(reqResType) == true || val < 100) {
            setTimeout(loading, 100);
        } else {
            if (DEBUG) console.log('[Progress Bar]' + reqResType + ' loading is completed... from progress bar');
        }
    }

    setTimeout(loading, 100);
};

// Draw process bubble chart
//
function draw_bubble_chart() {
    var diameter = 600,
        format = d3.format(",d"),
        color = d3.scale.category20c();

    var bubble = d3.layout.pack()
        .sort(null)
        .size([diameter, diameter])
        .padding(1.5);

    // bubble chart location modified by youngmo 2015.8.17. 05:26 AM
    document.getElementById("process_bubble_chart").innerHTML = "";

    var svg = d3.select("#process_bubble_chart").append("svg")
        .attr("width", diameter)
        .attr("height", diameter)
        .attr("class", "bubble");

    if (DEBUG) console.log("Drawing bubble chart");
    // get process.json file
    d3.json("dist/json/process.json", function(error, root) {
        if (error) throw error;

        var node = svg.selectAll(".node")
            .data(bubble.nodes(classes(root))
                .filter(function(d) {
                    return !d.children;
                }))
            .enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

        node.append("title")
            .text(function(d) {
                return d.className + ": " + format(d.value);
            });

        node.append("circle")
            .attr("r", function(d) {
                return d.r;
            })
            .style("fill", function(d) {
                return color(d.packageName);
            });

        node.append("text")
            .attr("dy", ".3em")
            .style("text-anchor", "middle")
            .text(function(d) {
                return d.className.substring(0, d.r / 3);
            });
    });

    // Returns a flattened hierarchy containing all leaf nodes under the root.
    function classes(root) {
        var classes = [];

        function recurse(name, node) {
            if (node.children) node.children.forEach(function(child) {
                recurse(node.name, child);
            });
            else classes.push({
                packageName: name,
                className: node.name,
                value: node.size
            });
        }

        recurse(null, root);
        return {
            children: classes
        };
    }

    // Select where to display. modfied by youngmo
    d3.select(self.frameElement).style("height", diameter + "px");
}

// Debug helper funtion
//
function printObject(obj) {
    var output = "",
        property;
    for (property in obj) {
        output += property + ": " + obj[property] + "; ";
    }
    console.log("Print object's properties: " + output);
}
