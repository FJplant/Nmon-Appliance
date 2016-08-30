    // TODO: add memory and process utilization
    var numberFormat = d3.format('.2f');
    var dateFormat = d3.time.format('%Y-%m-%d');

    var svg = dimple.newSvg("#server_insight_chart", 590, 480);
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
        //console.log(JSON.stringify(d));
      });

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
        lastIndex = null,
        servers = dimple.getUniqueValues(data, "server"); // assign server names from filtered data

      // Define 2 nearly identical charts.  It's essential
      // for this that the max and minimum values are fixed
      // and unmoving otherwise the background chart will get
      // out of sync with the foreground the background chart's
      // axes are hidden and it's colors are faded.  Both have
      // their borders set to white, which looks better on this chart
      charts.forEach(function (chart, i) {
        var x, y, z;
        chart.setBounds(60, 30, 510, 410);
        x = chart.addMeasureAxis("x", "disk_bytes"); // set measured values for x-Axis
        x.overrideMax = 60000000;    // fix x axis range
        //x.tickFormat = ',.1f';
        x.hidden = (i === 0);        // hide background chart x-axis
        y = chart.addMeasureAxis("y", "cpu_util");   // set measured values for y-Axis
        y.overrideMax = 100;         // fix y axis range
        y.tickFormat = ',.1f';
        y.hidden = (i === 0);        // hide background chart x-axis
        z = chart.addMeasureAxis("z", "cpu_cnt");   // set measured values for z-Axis
        z.overrideMax = 8;           // fix max z values
        // Ensure the same colors for every owner in both charts
        // differing by opacity
        servers.forEach(function (server, k) {
          chart.assignColor(
            server,
            charts[0].defaultColors[k].fill,
            charts[0].defaultColors[k].fill, // set overall circle color when mouse over event,  "grey",
            (i === 0 ? 0.3 : 1));
        }, this);
      }, this);

      var myLegend = charts[1].addLegend(510, 50, 60, 300, "Right");
      charts[1].draw(); // draw foreground chart

      // This is a critical step.  By doing this we orphan the legend. This
      // means it will not respond to graph updates.  Without this the legend
      // will redraw when the chart refreshes removing the unchecked item and
      // also dropping the events we define below.
      //charts[1].legends = [];

      // This block simply adds the legend title. I put it into a d3 data
      // object to split it onto 2 lines.  This technique works with any
      // number of lines, it isn't dimple specific.
      svg.selectAll("title_text")
        //.data(["Click legend to","show/hide owners:"])
        .data(["Servers"])
        .enter()
        .append("text")
          .attr("x", 480)
          .attr("y", function (d, i) { return 50 + i * 14; })
          .style("font-family", "sans-serif")
          .style("font-size", "10px")
          .style("color", "Black")
          .text(function (d) { return d; });

      // Get a unique list of server values to use when filtering
      var filterValues = dimple.getUniqueValues(data, "server");

      myLegend.shapes.selectAll("rect")
        // Add a click event to each rectangle
        .on("click", function (e) {
          // This indicates whether the item is already visible or not
          var hide = false;
          var newFilters = [];
          // If the filters contain the clicked shape hide it
          filterValues.forEach(function (f) {
            if (f === e.aggField.slice(-1)[0]) {
              hide = true;
            } else {
              newFilters.push(f);
            }
          });
          // Hide the shape or show it
          if (hide) {
            d3.select(this).style("opacity", 0.2);
          } else {
            newFilters.push(e.aggField.slice(-1)[0]);
            d3.select(this).style("opacity", 0.8);
          }
          // Update the filters
          filterValues = newFilters;
          // Filter the data
          charts[1].data = dimple.filterData(data, "server", filterValues);
          // Passing a duration parameter makes the chart animate. Without
          // it there is no transition
          charts[1].draw(800);
        });

      // Define a storyboard on the main chart, this will iterate
      // all dates and redraw for each, the callback will build the
      // the background chart
      var myStoryBoard = function (d) {
        // Use the last date variable to manage the previous tick's data
        if (lastIndex !== null) {
          // Pull the previous data
          var lastData = dimple.filterData(data, "index", lastIndex);
          // Add a series to the background chart to display old position
          var lastSeries = charts[0].addSeries("server", dimple.plot.bubble);
          // Average suits these measures better
          lastSeries.aggregate = dimple.aggregateMethod.avg;
          // Give each series its own data at different periods
          lastSeries.data = lastData;
          // Draw the background chart
          charts[0].draw();
          // Class all shapes as .historic
          lastSeries.shapes.attr("class", "historic");
          // Reduce all opacity and remove once opacity drops below 5%
          d3.selectAll(".historic")
            .each(function () {
              var shape = d3.select(this),
                opacity = shape.style("opacity") - 0.02;
              if (opacity < 0.1) {
                shape.remove();
              } else {
                shape.style("opacity", opacity);
              }
          });
        }
        lastIndex = d;
      };
      //myStoryBoard.frameDuration = 2000;

      charts[1].setStoryboard("index", myStoryBoard);

      // Add the primary series to the main chart
      series = charts[1].addSeries("server", dimple.plot.bubble)
      series.aggregate = dimple.aggregateMethod.avg;
      // Draw the main chart
      charts[1].draw();

      // Add some border weight to the main series so it separates a bit from
      // the former period shadows
      d3.selectAll("circle").style("stroke-width", 2);
    });
