    var processRingChart   = dc.pieChart("#chart-ring-process"),
        serverRowChart = dc.rowChart("#chart-row-server");

    // set Ring and Row chart's text color
    // TODO: below does not work
    //serverRowChart.selectAll('text.row').style('fill','black');

    var connection = new WebSocket('ws://nmrep-dev.fjint.com:8001/websocket');
    var data1 = [
        //{process: 'oracle', cpu_usage: 30.5, server: 'nmon-tokyo', 'total':1},
        {process: 'node', cpu_usage: 25.3, server: 'nmrep-dev', 'total':2},
        {process: 'python', cpu_usage: 17.5, server: 'nmon-base', 'total':2},
        //{process: 'java', cpu_usage: 7.2, server: 'nmrep-dev', 'total':1},
    ];
    // set crossfilter with first dataset
    var xfilter = crossfilter(data1),
        serverDim  = xfilter.dimension(function(d) {return d.server;}),
        cpu_usageDim = xfilter.dimension(function(d) {return Math.floor(d.cpu_usage/10);}),
        processDim  = xfilter.dimension(function(d) {return d.process;}),
      
        cpu_usagePerServer = serverDim.group().reduceCount(function(d) {return +d.cpu_usage;}),
        cpu_usagePerProcess = processDim.group().reduceSum(function(d) {return +d.cpu_usage;});
    function render_plots(){
        processRingChart
            .width(200).height(200)
            .dimension(processDim)
            .group(cpu_usagePerProcess)
            .innerRadius(50);
        serverRowChart
            .width(250).height(200)
            .dimension(serverDim)
            .group(cpu_usagePerServer)
            .elasticX(true);
        dc.renderAll();
    }
    render_plots();
    // data reset function (adapted)
    function resetData(ndx, dimensions) {
        var serverChartFilters = serverRingChart.filters();
        var spenderChartFilters = processRowChart.filters();
        serverRingChart.filter(null);
        processRowChart.filter(null);
        xfilter.remove();
        serverRingChart.filter([serverChartFilters]);
        processRowChart.filter([processChartFilters]);
    }
    connection.onmessage = function(event) {
        var newData = JSON.parse(event.data);
        var updateObject =[{
            "process": newData.process,
            "server": newData.server,
            "cpu_usage": newData.cpu_usage,
            "processType": newData.processType
        }]
        //resetData(ndx, [yearDim, cpu_usageDim, processDim]);
        xfilter.add(updateObject);
        dc.redrawAll();
    }
