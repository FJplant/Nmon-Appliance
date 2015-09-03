/*
 * Constants first
 */
var HOSTS_BACK_TIME = 30000;
var REFRESH_INTERVAL = 5000;

var curResType = "CPU";
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

function getHosts(category) {
    $.ajax({
        url: "/All/" + category + "/hosts",
        data: {},
        success: function(data) {
            var result = eval(data);
            var html = '<option value="All">All</option>';
            for (var i = 0; i < result.length; i++) {
                html += '<option value="' + result[i] + '">' + result[i] + '</option>';
            }
            $("#hosts").html(html);
        }
    });
}

function drawChart(did, data, xlabel, ylabel) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    var d3data = [ ];
    for(var i = 1; i < data[0].length; i++)
        d3data.push({key: data[0][i], values:[]});
    for(var j = i; j < data.length; j++)
        for(var i = 1; i < data[0].length; i++)
            d3data[i-1].values.push([data[j][0], data[j][i]]);

    nv.addGraph(function() {
        var chart = nv.models.stackedAreaChart()
                      .x(function(d) { return d[0] })   //We can modify the data accessor functions...
                      .y(function(d) { return d[1] })   //...in case your data is formatted differently.
                      .useInteractiveGuideline(true)    //Tooltips which show all data points. Very nice!
                      .showControls(true)       //Allow user to choose 'Stacked', 'Stream', 'Expanded' mode.
                      .color(d3.scale.category10().range())
                      .interpolate('cardinal-open')
                      .clipEdge(true);

        //Format x-axis labels with custom function.
        chart.xAxis
            .axisLabel(xlabel)
            .tickFormat(function(d) { 
              return d3.time.format('%x')(new Date(d)) 
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
                       //.legendPosition("right") //nvd3.js v1.8.1
                       .showLegend(false) //nvd3.js v1.8.0
                       .showLabels(true);

        d3.select('#' + did + ' svg')
          .datum(d3data)
          .call(chart);

        nv.utils.windowResize(chart.update);

        return chart;
    });
}

function drawBubbleChart(did, data, xlabel, ylabel) {
    if ($('#' + did + " svg").length === 0)
        $('#' + did).html('<svg></svg>');

    var d3data = [];
    for(var i = 1; i < data.length; i++) {
        d3data.push({
            key : data[i][0], 
            values: [{x: data[i][1], y: data[i][2], size: data[i][4], network: data[i][3] }]
        });
    }

    nv.addGraph(function() {
        var chart = nv.models.scatterChart()
                    .showDistX(true)
                    .showDistY(true)
                    .color(d3.scale.category10().range());

        /*// nvd3.js 1.8.1
        chart.tooltip.contentGenerator(function(obj) {
            var html = '<h3>' + obj.series[0].key + '</h3><p>';
            html += 'CPU : ' + (Math.round(obj.series[0].values[0].y * 100) / 100) + '%<br>';
            html += 'Disk : ' + (Math.round(obj.series[0].values[0].x * 100) / 100) + 'KB/s<br>';
            html += 'Network : ' +  (Math.round(obj.series[0].values[0].network * 100) / 100) + 'KB/s<br>';
            html += 'No. of CPU : ' + obj.series[0].values[0].size + '<br></p>';
            return html;
        });
        */

        // nvd3.js 1.8.0
        chart.tooltipContent(function (key, x, y, e, graph) {
            var html = '<h3>' + key + '</h3><p>';
            html += 'CPU : ' + y + '%<br>';
            html += 'Disk : ' + x + 'KB/s<br>';
            html += 'Network : ' +  (Math.round(graph.series.values[0].network * 100) / 100) + 'KB/s<br>';
            html += 'No. of CPU : ' + graph.series.values[0].size + '<br></p>';
            return html;
        });

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

function updateGraph(hostname, restype, fromDate, toDate) {
    var start = new Date();
    // hosts - always update this area
    if (restype == "HOSTS" || restype == "ALL" ) {
        reqStatus["HOSTS"] = true;
        console.log("[Requesting HOSTS data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/HOST?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["HOSTS"] = false;
                drawBubbleChart("hosts_chart", data, 'Disk (KB/s)', 'CPU (%)');
                console.log(' HOSTS chart respose: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // cpu
    if (restype == "CPU" || restype == "ALL") {
        reqStatus["CPU"] = true;
        console.log("[Requesting CPU data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/CPU_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['User', 'Sys', 'Wait']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["CPU"] = false;
                drawChart("cpu_chart", result, 'Time', '%');
                console.log('  CPU chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // memory
    if (restype == "MEM" || restype == "ALL") {
        reqStatus["MEM"] = true;
        console.log("[Requesting MEM data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/MEM?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Real total', 'Real free']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["MEM"] = false;
                result[0][1] = 'Real used';
                for (var i = 1; i < result.length; i++) {
                    result[i][1] = result[i][1] - result[i][2];
                }
                drawChart("mem_chart", result, 'Time', 'MB');
                console.log('  MEM chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // swap
    if (restype == "SWAP" || restype == "ALL") {
        reqStatus["SWAP"] = true;
        console.log("[Requesting SWAP data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/MEM?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['Virtual total', 'Virtual free']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["SWAP"] = false;
                result[0][1] = 'Virtual used';
                for (var i = 1; i < result.length; i++) {
                    result[i][1] = result[i][1] - result[i][2];
                }
                drawChart("swap_chart", result, 'Time', 'MB');
                console.log('  SWAP chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // disk
    if (restype == "DISK" || restype == "ALL") {
        reqStatus["DISK"] = true;
        console.log("[Requesting DISK data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/DISK_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['read', 'write']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["DISK"] = false;
                drawChart("disk_chart", result, 'Time', 'KB/s');
                console.log(' DISK chart response:' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // network
    if (restype == "NET" || restype == "ALL") {
        reqStatus["NET"] = true;
        console.log("[Requesting NET data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/NET_ALL?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&data=['read', 'write']",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["NET"] = false;
                drawChart("network_chart", result, 'Time', 'KB/s');
                console.log(' NET chart response :' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // process cpu usage
    if (restype == "PROCESS_CPU" || restype == "ALL") {
        reqStatus["PROCESS_CPU"] = true;
        console.log("[Requesting PROCESS_MEM data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=cpu",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["PROCESS_CPU"] = false;
                drawPieChart("process_cpu_chart", data);
                console.log(' PROCESS_CPU chart response: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

    // process mem usage
    if (restype == "PROCESS_MEM" || restype == "ALL") {
        reqStatus["PROCESS_MEM"] = true;
        console.log("[Requesting PROCESS_MEM data] " + start.toLocaleString());
        $.ajax({
            url: "/" + hostname + "/TOP?date=[" + fromDate.getTime() + "," + toDate.getTime() + "]&type=mem",
            data: {},
            success: function(data) {
                var result = eval(data);
                reqStatus["PROCESS_MEM"] = false;
                drawPieChart("process_mem_chart", data, "Process usage by MEM");
                console.log(' PROCESS_MEM chart respose: ' + ((+new Date() - +start)) / 1000 + ' secs');
            }
        });
    }

}

function refresh_charts() {
    var fromDate, toDate;

    fromDate = new Date($("#from").val() + " " + $("#from_time").val());

    if ($("#to").val() !== "now")
        toDate = new Date($("#to").val() + " " + $("#to_time").val());
    else
        toDate = new Date();

    if ( !isLoading("HOSTS") || !isLoading(getCurResType()) ) {
        if ( !isLoading("HOSTS") ) {
            //updateGraph("All", "HOSTS", new Date(toDate.getTime() - HOSTS_BACK_TIME ), toDate);
            updateGraph("All", "HOSTS", fromDate, toDate);
            console.log("Refresh hosts charts: " + (new Date()).toLocaleString());
        } 
        if ( !isLoading(getCurResType()) ) {
            updateGraph($("#hosts").val(), getCurResType(), fromDate, toDate);
            console.log("Refresh " + getCurResType() + " charts: " + (new Date()).toLocaleString());
        }
    } else {
      console.log("Refresh on-going: " + (new Date()).toLocaleString());
    }
    // Try to Refresh every 5 seconds
    setTimeout( refresh_charts, 5000 );
}

$(function() {
    getHosts('CPU_ALL');
    var today = new Date();
    $("#from").val((today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear());
    $("#to").val("now");
    $("#view").click(function(event) {
        var fromDate, toDate;

        fromDate = new Date($("#from").val() + " " + $("#from_time").val());

        if ($("#to").val() !== "now")
            toDate = new Date($("#to").val() + " " + $("#to_time").val());
        else
            toDate = new Date();
        updateGraph($("#hosts").val(), curResType, fromDate, toDate)
    });
    var fromDate = new Date($("#from").val());
    var toDate = new Date();
    // First Tab is "HOSTS" and CPU so just call both of them
    updateGraph("All", "HOSTS", new Date(toDate.getTime() - HOSTS_BACK_TIME ), toDate);
    updateGraph("All", "CPU", fromDate, toDate);

    // Refresh every REFRESH_INTERVAL milli seconds
    setTimeout( refresh_charts, REFRESH_INTERVAL );
});

// Debug helper funtion
function printObject(obj) {
    var output = "",
        property;
    for (property in obj) {
        output += property + ": " + obj[property] + "; ";
    }
    console.log("Print object's properties: " + output);
}

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

$(function() {
    $("#tabs").tabs({
        // event: "mouseover"
        beforeActivate: function(event, ui) {
            var newTab = ui.newTab.context.innerText;

            // Same code with View clicked event handler need to merge to one
            var fromDate, toDate;

            fromDate = new Date($("#from").val() + " " + $("#from_time").val());

            if ($("#to").val() !== "now")
                toDate = new Date($("#to").val() + " " + $("#to_time").val());
            else
                toDate = new Date();

            var curRes = getCurResType();
            switch (newTab) {
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
                case "Bubble Chart Example":
                    draw_bubble_chart();
                    curRes = "NONE";
                    break;
                default:
                    curRes = "NONE";
                    break;
            }
            console.log("[Calling updateGraph from UI-tab] " +
                "Hosts: " + $("#hosts").val() +
                ", Tab: " + curRes +
                ", From: " + fromDate.toLocaleString() +
                ", To: " + toDate.toLocaleString());
            updateGraph($("#hosts").val(), curRes, fromDate, toDate);
        }
    });
});

function setLoading(areaid, reqResType, message) {
    var areaelem = document.getElementById(areaid);
    var proghtml = '<div id="' + areaid + '_progressbar' + '" style="position: relative;">' + '  <div class="' + areaid + '_progresslabel' + '" style="position: absolute; left: 15%; top: 4px; font-weight: bold; text-shadow: 1px 1px 0 #fff;"></div>' + '</div>';
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
            console.log('[Progress Bar]' + reqResType + ' loading is completed... from progress bar');
        }
    });
    progressBarValue = progressBar.find(".ui-progressbar-value");
    progressBarValue.css({
        "background": "#FFFF80"
    });
    progressLabel.text(message);
    setCurResType(reqResType);

    function loading() {
        var val = progressBar.progressbar("value") || 0;

        if (isLoading(reqResType) == true || val < 100) {
            setTimeout(loading, 100);
        } else {
            console.log('[Progress Bar]' + reqResType + ' loading is completed... from progress bar');
        }
    }

    setTimeout(loading, 100);
};

function draw_bubble_chart() {
    var diameter = 800,
        format = d3.format(",d"),
        color = d3.scale.category20c();

    var bubble = d3.layout.pack()
        .sort(null)
        .size([diameter, diameter])
        .padding(1.5);

    // bubble chart location modified by youngmo 2015.8.17. 05:26 AM
    document.getElementById("bubble_chart_area").innerHTML = "";

    var svg = d3.select("#bubble_chart_area").append("svg")
        .attr("width", diameter)
        .attr("height", diameter)
        .attr("class", "bubble");

    console.log("Drawing bubble chart");
    // get process.json file
    d3.json("process.json", function(error, root) {
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
