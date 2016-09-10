/*
 * Constants first
 */
var HOSTS_BACK_TIME = 1000*60*1;    // in milli seconds, 1 minutes
var REFRESH_INTERVAL = 2000;        // in milli seconds
var DEBUG = false;                  // for debug purpose

var NMON_API_URL_PREFIX = '/api/v1' // API URL prefix
var fromDate = null,                // page global fromDate and toDate
    toDate = null;               

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

var curChart = null;
var chartByDid = {
    'hosts_chart' : null,
    'cpu_chart' : null, 
    'disk_chart' : null,
    'network_chart' : null,
    'nfs_chart' : null,
    'mem_chart' : null,
    'swap_chart': null,
    'process_cpu_chart': null,
    'process_mem_chart': null
}

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
function getServerList() {
    $.ajax({
        url: NMON_API_URL_PREFIX + '/server/list',
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
function drawAreaChart(did, xlabel, ylabel, isBarChart) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    nv.addGraph(function() {
        // CPU, Disk, I/O => stracked bar chart
        // Memory, VM => stacked area chart
        chart = ( isBarChart === true ) ? nv.models.multiBarChart() : nv.models.stackedAreaChart();

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

        chartByDid[did] = chart;

        return chart;
    });
}

//
// Draw pie chart for process chart
function drawPieChart(did) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    nv.addGraph(function() {
        var chart = nv.models.pieChart()
                       .x(function(d) { return d.label })
                       .y(function(d) { return d.value })
                       .donut(true)
                       .donutRatio(0.35)
                       .legendPosition("right") //nvd3.js v1.8.1
                       .showLegend(true) //nvd3.js v1.8.0
                       .showLabels(true);

        chartByDid[did] = chart;

        // draw empty chart
        return chart;
    });
}

// Draw scatter chart for server insight
//
function drawScatterChart(did, xlabel, ylabel) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    nv.addGraph(function() {
        var chart = nv.models.scatterChart()
                    //.xScale(d3.scale.log())
                    .forceX([0,2000]) // scale error so fix to 2 Mbytes/sec for demo
                    .forceY([0,25])   // scale error so fix to 25 % usage:w
                    .showDistX(true)  //showDist, when true, will display those little distribution lines on the axis.
                    .showDistY(true)
                    //.transitionDuration(350) // transitionDuration is not a function error
                    .duration(800)   // substition for transitionDuration()
                    .color(d3.scale.category10().range());

        chart.xAxis.tickValues([0,1,10,100,1000,10000,100000,1000000]);

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

        chartByDid[did] = chart;

        return chart;
    });
}

// Update chart data and refresh chart
function updateChartData(did, data, isInOut) {
    var d3data = [];
    var chart = chartByDid[did];

    // Populate data
    // TODO: change to websocket refresh
    if (did === 'hosts_chart') {
        for(var i = 1; i < data.length; i++) {
            d3data.push({
                key : data[i][0],
                values: [{x: data[i][1], y: data[i][2], size: data[i][4], network: data[i][3] }]
            });
        }
    }
    else if (did === 'cpu_chart' || did === 'disk_chart' || did === 'network_chart' || did === 'nfs_chart'
          || did === 'mem_chart' || did === 'swap_chart' ) {
        for(var i = 1; i < data[0].length; i++) {
            d3data.push({key: data[0][i], values:[]}); // series name ( header )
        }

        for(var j = 1; j < data.length; j++) { // rows
            for(var i = 1; i < data[0].length; i++) { // series
                // Disk and network chart draws write or send amount as minus value
                if ( i == 2 && (data[0][i] === 'write' || data[0][i] === 'send') && isInOut === true)
                    d3data[i-1].values.push([data[j][0], -data[j][i]]); // push key value order and insert d3data from 0 row
                else
                    d3data[i-1].values.push([data[j][0], data[j][i]]);
            }
        }
    }
    else if (did === 'process_cpu_chart' || did === 'process_mem_chart') {
        for(var j = 1; j < data.length; j++)
            d3data.push({label: data[j][0], value: data[j][1]});
    }

    // check chart is prepared to be drawn
    if (typeof chart == 'function') {
        d3.select('#' + did + ' svg')
          .datum(d3data)
          .call(chart);

        nv.utils.windowResize(chart.update);
    }
}

function refreshDataCompleted(restype, did, data, start) {
    var result = eval(data);

    // preprecessing for MEM and SWAP
    if (restype == 'MEM') {
        result[0][1] = 'Real used';
        for (var i = 1; i < result.length; i++) {
            result[i][1] = result[i][1] - result[i][2];
        }
    } else if (restype == 'SWAP') {
        result[0][1] = 'Virtual used';
        for (var i = 1; i < result.length; i++) {
            result[i][1] = result[i][1] - result[i][2];
        }
    }

    reqStatus[restype] = false;
    if (restype == 'DISK' || restype == 'NET')
        updateChartData(did, result, true);
    else 
        updateChartData(did, result, false);

    if (DEBUG) console.log(' ' + restype + ' chart respose: ' + ((+new Date() - +start)) / 1000 + ' secs');
}

// Periodic server performance data fetch
// TODO: need to change to fetch only updated data
function updateGraph(hostname, restype, fromDate, toDate) {
    var start = new Date();

    reqStatus[restype] = true;

    if (DEBUG) console.log('[' + start.toLocaleString() + '] Requesting ' + restype + ' data.');

    // hosts - always update this area
    if ((restype == "HOSTS" || restype == "ALL") && document.getElementById('hosts_chart')) {
        $.ajax({
            url: NMON_API_URL_PREFIX + '/server/stat/' + hostname + "?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'hosts_chart', data, start);
            }
        });
    }

    // cpu
    if (restype == "CPU" || restype == "ALL") {
        $.ajax({
            url: NMON_API_URL_PREFIX + "/nmon-perf/" + hostname + "/CPU_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['User', 'Sys', 'Wait']",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'cpu_chart', data, start);
            }
        });
    }

    // memory
    if (restype == "MEM" || restype == "ALL") {
        $.ajax({
            url: NMON_API_URL_PREFIX + "/nmon-perf/" + hostname + "/MEM_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Real total', 'Real free']",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'mem_chart', data, start);
            }
        });
    }

    // swap
    if (restype == "SWAP" || restype == "ALL") {
        $.ajax({
            url: NMON_API_URL_PREFIX + "/nmon-perf/" + hostname + "/MEM_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Virtual total', 'Virtual free']",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'swap_chart', data, start);
            }
        });
    }

    // disk
    if (restype == "DISK" || restype == "ALL") {
        $.ajax({
            url: NMON_API_URL_PREFIX + "/nmon-perf/" + hostname + "/DISK_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['read', 'write']",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'disk_chart', data, start);
            }
        });
    }

    // network
    if (restype == "NET" || restype == "ALL") {
        $.ajax({
            url: NMON_API_URL_PREFIX + "/nmon-perf/" + hostname + "/NET_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['recv', 'send']",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'network_chart', data, start);
            }
        });
    }

    // process cpu usage
    if (restype == "PROCESS_CPU" || restype == "ALL") {
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=cpu",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'process_cpu_chart', data, start);
            }
        });
    }

    // process mem usage
    if (restype == "PROCESS_MEM" || restype == "ALL") {
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=mem",
            data: {},
            success: function(data) {
                refreshDataCompleted(restype, 'process_mem_chart', data, start);
            }
        });
    }
}

// Issue periodic chart refresh
//
function refresh_charts() {
    var now = new Date();

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

    if ( !isLoading("HOSTS") && !isLoading(getCurResType()) ) {
        if ( !isLoading("HOSTS") && document.getElementById('hosts_chart') != null) {
            updateGraph("All", "HOSTS", new Date(now.getTime() - HOSTS_BACK_TIME ), now); // Draw last HOST_BACK_TIME
            if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + "Server insights chart refreshed." );
        } 

        // prevent HOSTS to be called twice 
        if ( getCurResType() !== 'HOSTS' && !isLoading(getCurResType()) ) {
            updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
            if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + getCurResType() + " chart refreshed." );
        }
    } else {
      if (DEBUG) console.log("[" + (new Date()).toLocaleString() + "] " + "previous refresh is on-going ");
    }

    // Try to Refresh every 2 seconds
    setTimeout( refresh_charts, REFRESH_INTERVAL );
}

function drawChart(did) {
    if (did === 'cpu_chart') drawAreaChart("cpu_chart", 'Time', '%', true);
    if (did === 'hosts_chart') drawScatterChart("hosts_chart", 'Disk (KB/s)', 'CPU (%)');
    if (did === 'mem_chart') drawAreaChart("mem_chart", 'Time', 'MB');
    if (did === 'swap_chart') drawAreaChart("swap_chart", 'Time', 'MB');
    if (did === 'disk_chart') drawAreaChart("disk_chart", 'Time', 'KB/s', true, true);
    if (did === 'network_chart') drawAreaChart("network_chart", 'Time', 'KB/s', true, true);
    if (did === 'process_cpu_chart') drawPieChart('process_cpu_chart', 'Process usage by CPU');
    if (did === 'process_mem_chart') drawPieChart('process_mem_chart', 'Process usage by MEM');
}

function resizeChart() {
    //console.log('window resized');
    // Manual resize is buggy let it be refreshed by timer now.
    for ( i = 0; i < chartByDid.length; i++ ) {
        if ( typeof chartByDid[i] == 'function' ) {
            //nv.utils.windowResize(chartByDid[i].update);
        }
    }
}

// Main function
//
$(function() {
    getServerList();

    $("#hosts").on('change', (function(event) {
        // TODO: consider other resource was set .
        if (curResType === 'HOSTS') {
           setCurResType('CPU');
           updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
        }
    }));

    $("#view").click(function(event) {
        setCurResType('CPU');
        updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
    });

    // prepare cpu_chart and hosts_chart objects other are prepared after tab loading
    drawChart('cpu_chart');
    drawChart('hosts_chart');

    // set resize event listener
    window.addEventListener("resize", resizeChart);

    // Initiate first refresh_charts call
    // Refresh every REFRESH_INTERVAL milli seconds
    // excute when #cpu_chart or #hosts_chart div id exist
    if (document.getElementById('cpu_chart') || document.getElementById('hosts_chart')) {
        refresh_charts();
        if (DEBUG) console.log('cpu_chart or hosts_chart exists');
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
// TODO: change progress bar to overlay
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
            console.log("Resource tab changed: " + 
                " Hosts: " + $("#hosts").val() +
                ", Tab: " + curRes
                );
            }
            
            // TODO: remove old code
            //updateGraph($("#hosts").val(), curRes, fromDate, toDate);
        }
    });
});

// Show progress bar in tabbedpane
// 
function setLoading(areaid, reqResType, message) {
    var areaelem = document.getElementById(areaid);
    var proghtml = '<div id="' + areaid + '_progressbar' + '" style="position: relative; top: 30%;">'
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

        // TODO: adjust value according to loading time
        if (isLoading(reqResType) || (val != 0  && val != 100)) {
            setTimeout(loading, 100);
        } else {
            if (DEBUG) console.log('[Progress Bar]' + reqResType + ' loading is completed... from progress bar');
            drawChart(areaid);
            updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
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
