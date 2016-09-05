    // TODO: add memory and process utilization
    var numberFormat = d3.format('.2f');
    var dateFormat = d3.time.format('%Y-%m-%d');

    var svg1 = dimple.newSvg("#server_insight_chart1", 450, 480);
    var svg2 = dimple.newSvg("#server_insight_chart2", 450, 480);

    var nmonData = null;

    // populate data with d3
    // TODO: get nmon log data from server
    d3.tsv("dist/csv/server-insight-sample.tsv", function (data) {
      // split parsed data
      data.forEach(function (d) {
        // below two lines are just for reference.
        //d.dd = dateFormat.parse(d.date); 
        //d.month = d3.time.month(d.dd); // pre-calculate month for better performance
        // TODO: add date, time column

        // data conversion to numbers
        d.index = +d.index;
        d.cpu_cnt = +d.cpu_cnt; // coerce to number
        d.cpu_util= +d.cpu_util;
        d.mem_used= +d.mem_used;
        d.disk_bytes = +d.disk_bytes;
        d.net_bytes = +d.net_bytes;
        //console.log(JSON.stringify(d));
      });

      nmonData = data;
      buildServerInsight('disk_bytes', 'cpu_util', svg1, nmonData);
      buildServerInsight('net_bytes', 'cpu_util', svg2, nmonData);
    });

    function buildServerInsight(x_series, y_series, svg, data) {
      // Only show servers to show which are selected
      // Reduce the number of servers as this chart can get a bit busy
      data = dimple.filterData(data, "server", [
        "nmon-tokyo",
        "nmon-base",
        "nmrep-dev",
        "bexsvr",
        "edufine"]);

      var series,
        // Set a background and foreground chart
        charts = [
          new dimple.chart(svg, null), // background chart with empty data
          new dimple.chart(svg, data)  // foreground chart with real data
        ],
        lastIndex = null;

      // TODO: Get server names from nmondb-api
      var servers = dimple.getUniqueValues(data, "server"); // assign server names from filtered data

      // Define 2 nearly identical charts.  It's essential
      // for this that the max and minimum values are fixed
      // and unmoving otherwise the background chart will get
      // out of sync with the foreground the background chart's
      // axes are hidden and it's colors are faded.  Both have
      // their borders set to white, which looks better on this chart
      charts.forEach(function (chart, i) {
        var x, y, z;
        chart.setBounds(60, 30, 360, 410);
        x = chart.addMeasureAxis("x", x_series); // set measured values for x-Axis
        // TODO: set override Max to max of current background chart
        if (x_series === 'disk_bytes' || x_series === 'net_bytes') x.overrideMax = 60000000;    // fix x axis range
        else if (x_series === 'cpu_util') x.overrideMax = 100;

        //x.tickFormat = 'm,.1f';
        x.hidden = (i === 0);        // hide background chart x-axis
        y = chart.addMeasureAxis("y", y_series);   // set measured values for y-Axis
        if (y_series === 'cpu_util') y.overrideMax = 100;         // fix y axis range
        else if (y_series === 'net_bytes') y.overrideMax = 60000000;

        //y.tickFormat = ',.1f';
        y.hidden = (i === 0);        // hide background chart y-axis
        z = chart.addLogAxis("z", "cpu_cnt", 2);   // set logged values for z-Axis
        z.overrideMax = 128;           // fix max z values which supports max 256 cpus
        z.overrideMin = 0; 
        // Ensure the same colors for every owner in both charts
        // differing by opacity
        servers.forEach(function (server, k) {
          chart.assignColor(
            server,                          // series name to set color
            charts[0].defaultColors[k].fill, // set circle color with filled attribute
            charts[0].defaultColors[k].fill, // set circle outline color when mouse over event,  "grey",
            (i === 0 ? 0.3 : 1));            // set occupacy
        }, this);
      }, this);

      // Define a storyboard on the main chart, this will iterate
      // indexes and redraw for each, the callback will build the
      // the background chart
      var myStoryBoard = function (d) {
        this.frameDuration = 2000; // TODO: set fresh rate by user preference
        // Use the last date variable to manage the previous tick's data
        if (lastIndex !== null) {
          // Pull the previous data
          var lastData = dimple.filterData(data, "index", lastIndex);
          // Add a series to the background chart to display old position
          var lastSeries = charts[0].addSeries("server", dimple.plot.bubble);
          // Average suits these measures better
          lastSeries.aggregate = dimple.aggregateMethod.avg;

          // Set trace cricle of servers to 0.7
          // added by ymk 2016.8.30.
          // filterData uses reference to object, so should copy the arry by object
          lastData = JSON.parse(JSON.stringify(lastData)); // copy array 
          lastData.forEach(function (serverdata) {
            serverdata['cpu_cnt'] = 0.7;
          });

          // Give each series its own data at different periods
          // hide filtered server. 2016.8.30. added by ymk
          lastSeries.data = dimple.filterData(lastData, "server", servers); 
          // Draw the background chart
          charts[0].draw(1200);
          // Class all shapes as .trace
          //   i.e. set the flag trace to background chart
          lastSeries.shapes.attr("class", "trace");
          // Reduce all opacity and remove once opacity drops below 10%
          d3.selectAll(".trace")
            .each(function () {
              var shape = d3.select(this),
                opacity = shape.style("opacity") - 0.02; // circle remains from 0.3 to 0.1
              if (opacity < 0.1) {
                shape.remove();
              } else {
                shape.style("opacity", opacity);
              }
          });
        }
        lastIndex = d;
      };

      // Set set Storyboard
      charts[1].setStoryboard("index", myStoryBoard);

      // Add the primary series to the main chart
      series = charts[1].addSeries("server", dimple.plot.bubble)
      series.aggregate = dimple.aggregateMethod.avg;


      // Add legened
      var myLegend = charts[1].addLegend(350, 50, 80, 300, "Right"); // x, y, width, height, horizontalAlign, series

      // Draw the main chart
      charts[1].draw(); // only draw foreground chart because charts[0] do not have data

      // This is a critical step.  By doing this we orphan the legend. This
      // means it will not respond to graph updates.  Without this the legend
      // will redraw when the chart refreshes removing the unchecked item and
      // also dropping the events we define below.
      // TODO: when following code is legends are disappeared. It is different from example
      charts[1].legends = [];

      // This block simply adds the legend title. I put it into a d3 data
      // object to split it onto 2 lines.  This technique works with any
      // number of lines, it isn't dimple specific.

      // set title text for svg
      svg.selectAll("title_text")  // select legend property
        .data([/*"Click legend to show/hide",*/ "Servers"])
        .enter()
        .append("text")
          .attr("x", 330)
          .attr("y", function (d, i) { return 45 + i * 14; })
          .style("font-family", "sans-serif")
          .style("font-size", "12px")
          .style("color", "Black")
          .text(function (d) { return d; });

      myLegend.shapes.selectAll("rect")  // select legend square
        // Add a click event to each rectangle
        // when clicked assign new filter to display only filtered server
        // TODO: click event does not work, need to fix it.
        //       There is no onClick event property
        .on("click", function (e) {
          // This indicates whether the item is already visible or not
          var hide = false;
          var newServers = [];  // newServers
          // If the filters contain the clicked shape hide it
          servers.forEach(function (f) {
            if (f === e.aggField.slice(-1)[0]) {
              hide = true;
            } else {
              newServers.push(f);
              console.log("server: " + f);
            }
          });
          // Hide the shape or show it
          if (hide) {
            d3.select(this).style("opacity", 0.2);
          } else {
            newServers.push(e.aggField.slice(-1)[0]);
            d3.select(this).style("opacity", 0.8);
          }
          // Update the filters
          servers = newServers;
          // Filter the data
          charts[1].data = dimple.filterData(data, "server", servers);
          // Passing a duration parameter makes the chart animate. Without
          // it there is no transition
          charts[1].draw(800);

          // TODO: Remove all background circles if server has been filtered
          charts[0].draw(800);
        });

      // Add some border weight to the main series so it separates a bit from
      // the former period shadows
      d3.selectAll("circle").style("stroke-width", 1);
    }
