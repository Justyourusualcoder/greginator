onVersionChanged(function(version) {
	var card = $( "#turbine-calculator-card" );

	if (version != "it2") {
		card.hide();
		return;
	} else {
		card.show();
	}

	if (window.turbineCalculatorInitialized) return;
	window.turbineCalculatorInitialized = true;

	var header = $( ".card-header", card );
	header.addClass( "link-pointer" );
	var collapse = $( ".collapse", card );

	var initialized = false;
	var turbine_blades;
	var turbine_fuels;
	var enderio_conduits;
	var translocators;
	var gregtech_pipes;
	var gregtech_pumps;
	var boilers;
	var boiler_fuels;
	var dynamos;
	var boiler_stats = "";

	var note_1 = "<sup>(1)</sup>";
	var note_2 = "<sup>(2)</sup>";
	var note_3 = "<sup>(3)</sup>";
	var note_12 = "<sup>(1,2)</sup>";

	function init(b) {
		if (!b) {collapse.collapse("toggle");}

		if (!initialized) {
			initialized = true;
			turbine_blades = data.getCopy("turbine blades",version);
			turbine_fuels = data.getCopy("turbine fuels",version);
			enderio_conduits = data.getCopy("ender io conduits",version);
			translocators = data.getCopy("fluid translocators",version);
			gregtech_pipes = data.getCopy("gregtech pipes",version);
			gregtech_pumps = data.getCopy("gregtech pumps",version);
			boilers = data.getCopy("boilers",version);
			boiler_fuels = data.getCopy("boiler fuels",version);
			dynamos = data.getCopy("dynamo hatches",version);
			initialize();
		}
	}
	header.off("click");
	header.on("click",function() {init();});
	if (collapse.hasClass("show")) {init(true);}

	var selected_material;
	var selected_fuel;
	var selected_size = "large";

	function getMaterialByName(name) {
		for(var i=0;i<turbine_blades.length;i++) {
			if (escapehtml(turbine_blades[i].material) == name) {
				return turbine_blades[i];
			}
		}
	}
	function getFuelByName(name) {
		for(var i=0;i<turbine_fuels.length;i++) {
			for(var j=0;j<turbine_fuels[i].fuels.length;j++) {
				if (escapehtml(turbine_fuels[i].fuels[j].name) == name) {
					var fuel = turbine_fuels[i].fuels[j];

					if (typeof fuel.multiplier == "undefined") {
						fuel.multiplier = turbine_fuels[i].multiplier;
					}

					if (typeof fuel.category == "undefined") {
						fuel.category = turbine_fuels[i].name;
					}

					return fuel;
				}
			}
		}
	}

	function displayMaterialStats() {
		var material_stats = $( ".material-stats", card );
		material_stats.empty();

		if (typeof selected_material == "undefined") {
			material_stats.hide();
			return;
		}
		material_stats.show();

		var tbl = $( "<table class='table table-bordered table-hover material-stats'>" );
		var thead = $( "<thead>" ).appendTo(tbl);
		var tbody = $( "<tbody>" ).appendTo(tbl);
		$("<tr>").append([
			"<th></th>",
			"<th>Durability</th>",
			"<th>Efficiency</th>",
			"<th>Flow</th>"
		]).appendTo(thead);

		function displayStats(size,obj) {
			var sizetext = size.substr(0,1).toUpperCase()+size.substr(1);
			var tr = $("<tr>").append([
				"<th>"+sizetext+"</th>",
				"<td>"+obj.durability.toLocaleString()+"</td>",
				"<td>"+obj.efficiency+"%</td>",
				"<td>"+obj.flow.toLocaleString()+"</td>"
			]).appendTo(tbody).addClass( "link-pointer" ).attr( "data-size", size );

			if (selected_size == size) {
				tr.addClass( "table-active" );
			}
		}

		displayStats("huge",selected_material.huge);
		displayStats("large",selected_material.large);
		displayStats("medium",selected_material.medium);
		displayStats("small",selected_material.small);

		material_stats.append(tbl);
	}

	function calculateStats(fuel,material) {
		var nominal_output = Math.floor(material.flow / 20 * fuel.multiplier);
		var optimal_flow = 0; 

		if (fuel.category == "Plasma") {
			optimal_flow = Math.ceil(nominal_output / fuel.fuel_value);
		} else {
			optimal_flow = Math.floor(nominal_output / fuel.fuel_value);
		}

		var energy_output = Math.floor(optimal_flow * fuel.fuel_value * (material.efficiency/100));

		return {
			nominal_output:nominal_output,
			optimal_flow:optimal_flow,
			energy_output:energy_output
		}
	}

	function getRemainingText(remaining,flip) {
		var sign = Math.sign(remaining);
		remaining = Math.abs(remaining);

		if (sign == -1 && !flip || sign == 1 && flip) {
			return remaining + " mb/t excess";
		} else if (sign == 1 && !flip || sign == -1 && flip) {
			return remaining + " mb/t remaining";
		}

		return "0 mb/t remaining";
	}

	function checkIC2Regulator(stats) {
		var amount_needed = Math.ceil(stats.optimal_flow/1000);
		var res_str = amount_needed + " x Regulators";
		return "<td>"+res_str+"</td><td>Up to 1000 mb/t</td><td>-</td>";
	}
	function checkEnderIOPipes(stats) {
		var remaining = stats.optimal_flow;
		var result = [];
		var result_amount = [];
		var note = "";

		// check combination of pipes
		for(var i=enderio_conduits.length-1;i>=0;i--) {
			var conduit = enderio_conduits[i];
			var speed = conduit.max_extract;
			if (speed <= remaining || (i<enderio_conduits.length-2 && remaining>speed*0.5)) {
				var amount = Math.round(remaining / speed);
				if (amount > 0) {
					remaining = remaining - speed*amount;

					if (amount > 4) { // if we have more than 4
						note = note_1;
					}

					result.push(amount + " x " + escapehtml(conduit.name));
					result_amount.push(amount * speed);
				}
			}

			if (remaining == 0) {break;}
		}

		// if that wasn't good enough, instead check multiple single pipes
		if (remaining != 0) {
			for(i=enderio_conduits.length-1;i>=0;i--) {
				var remaining2 = stats.optimal_flow;
				var conduit = enderio_conduits[i];
				var speed = conduit.max_extract;
				if (speed <= remaining2) {
					var amount = Math.floor(remaining2 / speed);
					remaining2 = remaining2 - speed*amount;

					if (remaining2 == 0) {
						if (amount > 4) { // if we have more than 4
							note = note_1;
						}
						result = [amount + " x " + escapehtml(conduit.name)];
						result_amount = [amount * speed];
						remaining = 0;
						break;
					}
				}
			}
		}

		if (result.length > 1) {note = "*";}

		var result = result.join(", ");
		if (result == "") {result = "Not compatible.";}
		else if (remaining != 0) {
			if (note == "") {note = note_2;}
			else {note = note_12;}
		}

		if (result_amount.length == 0) {result_amount.push(0);}

		return "<td>"+result+note+"</td>"+
				"<td>"+result_amount.reduce(function(a,b) {return a+b;})+" mb/t</td>"+
				"<td>"+getRemainingText(remaining)+"</td>";
	}
	function checkTranslocators(stats) {
		var max_input = translocators[0].max_input;

		var transfer_with = translocators[1].max_extract;
		var transfer_without = translocators[0].max_extract;

		if (stats.optimal_flow < transfer_without) {
			return "<td>Not compatible</td><td>0 mb/t</td><td>"+getRemainingText(stats.optimal_flow)+"</td>";
		}

		var amount_with = Math.floor(stats.optimal_flow / transfer_with);
		var amount_without = Math.ceil((stats.optimal_flow % transfer_with) / transfer_without);
		var note = "";
		if (amount_with+amount_without>1) {note = note_1;}
		if (stats.optimal_flow % transfer_without != 0) {
			if (note == "") {note = note_2;} else {note = note_12;}
		}

		var remain = stats.optimal_flow - (transfer_with*amount_with +transfer_without*amount_without);
		return "<td>" + amount_with + " with glowstone + " + amount_without + " without."+note+"</td>"+
				"<td>"+(amount_with*transfer_with+amount_without*transfer_without)+" mb/t</td>"+
				"<td>"+getRemainingText(remain)+"</td>";
	}
	function checkGregtechPipes(stats) {
		var names = ["Tiny ","Small ","","Large ","Huge "]
		var multipliers = [1,2,6,12,24];

		var closest_pipe_remainder = 999999;
		var closest_pipe;
		var closest_capacity;
		var cheapest_pipe;
		var cheapest_capacity;

		for(var i=0;i<gregtech_pipes.length;i++) {
			var pipe = gregtech_pipes[i];
			for(var j=0;j<5;j++) {
				var capacity = pipe.capacity * multipliers[j];
				if (typeof cheapest_pipe == "undefined" && capacity >= stats.optimal_flow) {
					cheapest_pipe = pipe;
					cheapest_capacity = j;
				}

				if (capacity >= stats.optimal_flow) {
					var amount = Math.floor(capacity / stats.optimal_flow);
					if (amount == 1) {
						var remainder = capacity % stats.optimal_flow;
						if (remainder <= closest_pipe_remainder) {
							closest_pipe_remainder = remainder;
							closest_pipe = pipe;
							closest_capacity = j;
						}
					}
				}
			}
		}

		var ret1 = [];
		var ret2 = [];
		var ret3 = [];
		if (typeof cheapest_pipe != "undefined") {
			var note = "";
			if (cheapest_pipe.capacity * multipliers[cheapest_capacity] != stats.optimal_flow) {note = note_3;}
			ret1.push("Cheapest: "+names[cheapest_capacity]+escapehtml(cheapest_pipe.material) + note);
			ret2.push(cheapest_pipe.capacity * multipliers[cheapest_capacity] + " mb/t");
			var remain = stats.optimal_flow - (cheapest_pipe.capacity * multipliers[cheapest_capacity]);
			ret3.push(getRemainingText(remain,true));
		}

		if (typeof closest_pipe != "undefined") {
			var note = "";
			if (closest_pipe.capacity * multipliers[closest_capacity] != stats.optimal_flow) {note = note_3;}
			ret1.push("Closest: " + names[closest_capacity] + escapehtml(closest_pipe.material) + note);
			ret2.push(closest_pipe.capacity * multipliers[closest_capacity] + " mb/t");
			var remain = stats.optimal_flow - (closest_pipe.capacity * multipliers[closest_capacity]);
			ret3.push(getRemainingText(remain,true));
		}

		if (ret1.length == 0) {
			return "<td>Not compatible</td><td></td>";
		} else {
			return "<td>"+ret1.join("<br>")+"</td>"+
					"<td>"+ret2.join("<br>")+"</td>"+
					"<td>"+ret3.join("<br>")+"</td>";
		}

	}
	function checkGregtechPumps(stats) {
		var remaining = stats.optimal_flow;
		var result = [];
		var total_amount = [];
		for(var i=gregtech_pumps.length-1;i>=0;i--) {
			var pump = gregtech_pumps[i];
			var speed = pump.speed;
			if (speed <= remaining) {
				var amount = Math.floor(remaining / speed);
				remaining = remaining % speed;
				result.push(amount + " x " + escapehtml(pump.name));
				total_amount.push(amount * speed);
			}

			if (remaining == 0) {break;}
		}

		var result = result.join(", ");
		if (result == "") {result = "Not compatible.";}

		var note = "";
		if (remaining != 0 && stats.optimal_flow > gregtech_pumps[0].speed) {note = note_2;}

		var remaining_txt = getRemainingText(remaining);

		if (total_amount.length == 0) {total_amount.push(0);}

		return "<td>"+result+note+"</td>"+
				"<td>"+total_amount.reduce(function(a,b){return a+b;})+" mb/t</td>"+
				"<td>"+remaining_txt+"</td>";
	}
	function checkGregtechRegulators(stats) {
		// GT Regulators have the same max speed as their pump counterparts
		for(var i=0;i<gregtech_pumps.length;i++) {
			var pump = gregtech_pumps[i];
			var speed = pump.speed;
			if (speed >= stats.optimal_flow) {
				return "<td>" + escapehtml(pump.name) + " regulator or better.</td>"+
						"<td>Up to " + speed + " mb/t</td>"+
						"<td>-</td>";
			}
		}

		var remaining = stats.optimal_flow - gregtech_pumps[gregtech_pumps.length-1].speed;
		return "<td>Not compatible</td>"+
				"<td>Up to " + gregtech_pumps[gregtech_pumps.length-1].speed + " mb/t</td>"+
				"<td>" + remaining + " mb/t excess</td>";
	}
	function lowestCommonDenominator(larger,smaller) {
		if (larger < smaller) {
			let temp = larger;
			larger = smaller;
			smaller = temp;
		}
		larger = Math.floor(larger);
		smaller = Math.floor(smaller);

		var iters = 1000;
		while(iters>0) {
			if (larger == smaller) {return larger;}
			var remainder = larger % smaller;
			if (remainder == 0) {return smaller;}

			larger = smaller;
			smaller = remainder;

			iters--;
		}

		return -1;
	}
	function checkBoilers(stats) {
		var LCD = -1;

		var optimal_boiler;
		var optimal_LCD_boiler_count = 99999;
		var optimal_LCD_turbine_count = 99999;
		var optimal_LCD_boiler;
		for(var i=0;i<boilers.length;i++) {
			var boiler = boilers[i];
			if (typeof optimal_boiler == "undefined" && boiler.output >= stats.optimal_flow) {
				optimal_boiler = boiler;
			}

			var LCD = lowestCommonDenominator(boiler.output,stats.optimal_flow);
			var LCD_boiler_count = boiler.output / LCD;
			var LCD_turbine_count = stats.optimal_flow / LCD;
			if (LCD != -1 && (LCD_boiler_count+LCD_turbine_count < optimal_LCD_boiler_count+optimal_LCD_turbine_count)) {
				optimal_LCD_turbine_count = LCD_boiler_count;
				optimal_LCD_boiler_count = LCD_turbine_count;
				optimal_LCD_boiler = boiler;
			}
		}

		var ret = "";

		if (typeof optimal_boiler != "undefined") {
			ret = "You'll need at least one " + escapehtml(optimal_boiler.name) + " (" + optimal_boiler.output + " mb/t) to keep up with this turbine blade.";
		} else {
			var max_boiler = boilers[boilers.length-1];
			var amount = Math.ceil(stats.optimal_flow / max_boiler.output);
			ret = "You'd need <strong>" + amount + "</strong> " + escapehtml(max_boiler.name) + "s to keep up with this turbine blade.";
		}

		if (typeof optimal_LCD_boiler != "undefined") {
			ret += "<br>You'll need <strong>" + optimal_LCD_boiler_count + "</strong> " + optimal_LCD_boiler.name + "(s) and <strong>" + optimal_LCD_turbine_count + "</strong> turbine(s) to exactly match production with consumption.";
		}

		return ret;
	}
	function checkHeatExchanger(stats,fuel) {
		/*
			Large heat exchanger can produce:
			With lava:
			Max normal steam: ((999 * 4) * 2) = 7992 mb/t
			Max superheated: (((2000 * 4) * 2) / 2) = 8000 mb/t

			With IC2 coolant:
			Max normal steam: ((3999 * 2) * 2) = 15996 mb/t
			Max superheated: (((8000 * 2) * 2) / 2) = 16000 mb/t
		*/

		var max_produced_lava = 0;
		var max_produced_coolant = 0;

		var max_consumed_lava = 0;
		var max_consumed_coolant = 0;
		if (fuel.name == "Steam") {
			max_produced_lava = 7992;
			max_produced_coolant = 15996;

			max_consumed_lava = 999 / 20;
			max_consumed_coolant = 3999 / 20;
		} else { // superheated steam
			max_produced_lava = 8000;
			max_produced_coolant = 16000;

			max_consumed_lava = 2000 / 20;
			max_consumed_coolant = 8000 / 20;
		}

		var amount_lava = Math.round(max_produced_lava / stats.optimal_flow * 100) / 100;
		var amount_coolant = Math.round(max_produced_coolant / stats.optimal_flow * 100) / 100;

		return "<p>If you use lava, you'll need <strong>"+amount_lava+"</strong> turbines to keep up with a single heat exchanger running at max speed"+
						" (uses "+max_consumed_lava+" mb/t of lava to produce "+max_produced_lava+" mb/t of "+escapehtml(fuel.name)+").<br>"+
				"If you use IC2 coolant, you'll need <strong>"+amount_coolant+"</strong> turbines to keep up with a single heat exchanger running at max speed"+
						" (uses "+max_consumed_coolant+" mb/t of coolant to produce "+max_produced_coolant+" mb/t of "+escapehtml(fuel.name)+").</p>";
	}
	function checkDynamos(stats) {
		for(i=0;i<dynamos.length;i++) {
			if (dynamos[i].output >= stats.energy_output) {
				return "<strong>"+dynamos[i].name + "</strong> (" + dynamos[i].output + " eu/t)";
			}
		}

		return "wut? couldn't find a dynamo hatch???";
	}

	function displayFuelStats() {
		var fuel_stats = $( ".fuel-stats", card );
		fuel_stats.empty();

		if (typeof selected_material == "undefined" || typeof selected_fuel == "undefined") {
			fuel_stats.hide();
			return;
		}
		fuel_stats.show();

		// init subpanels
		var stats_container = $( "<div class='card-body'>" );

		function update() {
			var stats = calculateStats(selected_fuel,selected_material[selected_size]);

			var steam_stats = "";
			if (selected_fuel.name == "Steam") {
				var toggle_btn = "<div class='btn btn-light link-pointer' data-toggle='collapse' data-target='#collapseBoilerStats'>More boiler stats</div>";

				steam_stats = 
					"<h5>Boiler stats "+toggle_btn+"</h5>"+
					"<p>"+checkBoilers(stats,selected_fuel)+"</p>"+
					boiler_stats;
			}

			if (selected_fuel.name == "Steam" || selected_fuel.name == "Superheated Steam") {
				steam_stats += 
					"<h5>Heat exchanger stats</h5>"+
					"<p>"+checkHeatExchanger(stats,selected_fuel)+"</p>";
			}

			var durability_time = 0;
			// durability for all turbines is min(output*0.2, output^0.6) every 1000 ticks
			var damage_taken = Math.floor(Math.min(stats.energy_output*0.2,Math.pow(stats.energy_output,0.6)))/1000*20; // multiply by 20 to convert to seconds instead of ticks

			durability_time = selected_material[selected_size].durability / damage_taken;
			durability_time = formatTime(durability_time);

			stats_container.empty();
			stats_container.append([
				"<h5>Stats</h5>",
				"<p>Optimal flow: <strong>" + stats.optimal_flow + "</strong> mb/t<br>"+
				"Power output: <strong>" + stats.energy_output + "</strong> eu/t<br>"+
				"Time until destroyed: Approximately <strong>" + durability_time + "</strong><br>"+
				"Required dynamo hatch: " + checkDynamos(stats) + "</p>",
				steam_stats
			]);

			setupCustomFuelValueInput(stats_container);

			transfer_table.empty();

			transfer_table.append("<tr><th>Name</th><th>Amount</th><th>Throughput</th><th>Remainder</th></tr>");

			// Check gretech regulator
			transfer_table.append( "<tr><th>Gregtech Regulator</th>" + checkGregtechRegulators(stats) + "</tr>" );
			// Check IC2 regulator
			transfer_table.append( "<tr><th>IC2 Fluid Regulator</th>" + checkIC2Regulator(stats) + "</tr>");
			// Check Ender IO pipes
			transfer_table.append( "<tr><th>Ender IO conduits</th>" + checkEnderIOPipes(stats) + "</tr>");
			// Check transfer nodes
			transfer_table.append( "<tr><th>Translocators</th>" + checkTranslocators(stats) + "</tr>");
			// Check gregtech pumps
			transfer_table.append( "<tr><th>Gregtech Pumps</th>" + checkGregtechPumps(stats) + "</tr>");
			// Check gregtech pipes
			transfer_table.append( "<tr><th>Gregtech Pipes</th>" + checkGregtechPipes(stats) + "</tr>");

			// Bedrockium drum stats
			var stored = 65536000;
			var time = Math.floor(stored / stats.optimal_flow / 20);
			var timestr = formatTime(time);

			var total_eu = Math.floor(stored / stats.optimal_flow * stats.energy_output).toLocaleString();

			// Quantum tank stats
			var stored_quantum = 2076192000;
			var time_quantum = Math.floor(stored_quantum / stats.optimal_flow / 20);
			var timestr_quantum = formatTime(time_quantum);
			var total_eu_quantum = Math.floor(stored_quantum / stats.optimal_flow * stats.energy_output).toLocaleString();

			$(".card-body",bedrockium_drum_container).empty();
			$(".card-body",bedrockium_drum_container).append([
				"<h5>Bedrockium drum stats</h5>",
				"<p>Time to empty bedrockium drum: " + timestr + "<br>"+
				"Total EU stored in bedrockium drum: " + total_eu + " EU</p>",

				"<h5>GT Quantum Tank V stats</h5>",
				"<p>Time to empty quantum tank: " + timestr_quantum + "<br>"+
				"Total EU stored in quantum tank: " + total_eu_quantum + " EU</p>"
			]);
			
			// apply theme
			window.applyThemeToBootstrapSelect(stats_container);
		}

		var transfer_container = $( "<div class='card-body' style='padding-top:0px; padding-bottom:4px;'>" );
		var transfer_table = $( "<table class='table table-bordered transfer-table'>" );
		var transfer_card = $("<div class='card'>").append([
			"<div class='card-header link-pointer'><h5 class='card-title'>Optimal transfer methods</h5></div>",
			"<div class='collapse'></div>"
		])
		$(".card-header",transfer_card).click(function() {
			$(".collapse",transfer_card).collapse("toggle");
		});

		transfer_container.append(transfer_card);
		$(".collapse",transfer_card).append($("<div class='card-body'>").append([
			transfer_table,
			"<small><strong>1.</strong> This configuration can't transfer into one face of one block (of a turbine input hatch). You'll need to either use multiple input hatches or a middle stage tank to accept fluid from more than one side.<br>"+
			"<strong>2.</strong> This configuration does not exactly match the required flow rate. You can probably attach a regulator in paralel, or a different type of pipe, to catch the remainder.<br>"+
			"<strong>3.</strong> This gregtech pipe has a transfer rate higher than required. You'll need to make sure your pumps are an exact match instead.</small>"
		]));

		var bedrockium_drum_container = $( "<div class='card-body' style='padding-top:0px; padding-bottom:4px;'>" );
		var bedrockium_drum_card = $("<div class='card'>").append([
			"<div class='card-header link-pointer'><h5 class='card-title'>Fun info</h5></div>",
			"<div class='collapse'><div class='card-body'></div></div>"
		])
		$(".card-header",bedrockium_drum_card).click(function() {
			$(".collapse",bedrockium_drum_card).collapse("toggle");
		});
		bedrockium_drum_container.append(bedrockium_drum_card);

		fuel_stats.append([
			stats_container,
			//"<hr>",
			transfer_container,
			//"<hr>",
			bedrockium_drum_container,
			//"<hr>",
			//other
		]);

		// Select size
		$( ".material-stats tbody tr", card ).off( "click.fuelstats" ).on( "click.fuelstats",function() {
			selected_size = $(this).attr( "data-size" );
			$( "tr",$(this).parent() ).removeClass( "table-active" );
			$(this).addClass( "table-active" );
			update();
		});

		update();

		// apply theme
		window.applyThemeToBootstrapSelect(stats_container);
	}

	function buildFuelValueCell(fuelValue, boost) {
		let ticks = Math.floor((fuelValue/80)*boost);
		return ticks + "t or " + (ticks/20) + "s<br><small style='color:inherit !important'>" + (Math.floor((1/(ticks/20))*1000+0.5)/1000) + " per sec</small>";
	}

	function setupCustomFuelValueInput(parent) {
		var inp = $(".customFuelValue", parent);
		var results = $(".customFuelValueResult", parent);
		var header = $(".customFuelValueHeader", parent);
		var otherHeader = $(".customFuelValueOtherHeader", parent);

		function doUpdate() {
			var customValue = parseInt(inp.val());
			if (customValue) {
				inp.removeClass("border-error");
				otherHeader.attr("colspan",boiler_fuels.length+1);
				header.show();
			} else {
				inp.addClass("border-error");
				otherHeader.attr("colspan",boiler_fuels.length);
				header.hide();
			}

			results.each(function() {
				var that = $(this);
				that.empty();

				if (customValue) {
					that.show();
					var boilerId = that.attr("data-boilerid");
					var boiler = boilers[parseInt(boilerId)];
					that.html(buildFuelValueCell(customValue, boiler.runtime_boost));
				} else {
					that.hide();
				}
			});
		}

		inp.on("input", doUpdate );
		doUpdate();
	}

	function initialize() {
		var material_search = $($( ".material-search", card )[0]);
		var fuel_search = $($( ".fuel-search", card )[0]);

		var fuels_headers = [];
		for(var i=0;i<boiler_fuels.length;i++) {
			fuels_headers.push("<th>" + boiler_fuels[i].name + "<br><small>Fuel value: " + boiler_fuels[i].fuel_value + "</th>");
		}


		boiler_stats = [];
		boiler_stats.push("<div class='collapse' id='collapseBoilerStats'>");
		boiler_stats.push("<table class='table table-bordered'><thead>"+
			"<tr>"+
				"<th colspan='3'><input class='form-control customFuelValue' type='number' placeholder='Custom fuel value'></th>"+
				"<th class='customFuelValueOtherHeader' colspan='" + boiler_fuels.length + "'>Burn times<br><small>Burn time equation: floor((FuelValue/80)*RuntimeBoost)</small></th>"+
			"</tr><tr>"+
				"<th>Tier</th>"+
				"<th>Production</th>"+
				"<th>Runtime Boost</th>"+
				fuels_headers.join("")+
				"<th class='customFuelValueHeader'>Custom</th>"+
			"</tr></thead>"
		);
		for(var i=0;i<boilers.length;i++) {
			let boiler = boilers[i];

			var fuels_columns = [];
			for(var j=0;j<boiler_fuels.length;j++) {
				let fuel = boiler_fuels[j];
				fuels_columns.push("<td>" + buildFuelValueCell(fuel.fuel_value, boiler.runtime_boost) + "</td>");
			}

			fuels_columns.push("<td class='customFuelValueResult' data-boilerid='" + i + "'></td>");

			boiler_stats.push(
				"<tr><td>"+boiler.name.match(/Large (.+) Boiler/)[1]+"</td>"+
				"<td>"+boiler.output+" mb/t</td>"+
				"<td>"+boiler.runtime_boost+"</td>"+
				fuels_columns.join("")
			)
		}

		boiler_stats.push("</table></div>");
		boiler_stats = boiler_stats.join("")

		// delete and re-create this element
		var p1 = material_search.parent();
		material_search.remove();
		material_search = $('<select class="material-search form-control">');
		p1.append(material_search);

		// delete and re-create this element
		var p2 = fuel_search.parent();
		fuel_search.remove();
		fuel_search = $('<select class="fuel-search form-control">');
		p2.append(fuel_search);

		setTimeout(function() {
			function buildTbl(name,v1,v2,v3) {
				var w1 = "200px";
				if (name == "Material") {w1 = "235px; padding-left:40px;";} // Special case

				return "<table><tr>"+
							"<td style=\"width:"+w1+"\">"+name+"</td>"+
							"<td style=\"width:80px\"><small class=\"text-muted\">"+v1+"</small></td>"+
							"<td style=\"width:70px\"><small class=\"text-muted\">"+v2+"</small></td>"+
							"<td style=\"width:50px\"><small class=\"text-muted\">"+v3+"</small></td>"+
						"</tr></table>";
			}

			var opt1 = "<option value='-' disabled selected>Select material...</option>";
			var opt2 = "<option value='"+name+"' data-content='"+buildTbl("Material","Durability","Efficiency","Flow (of large blade)")+"'>"+name+"</option>";

			function compareNum(a,b) {
				if (a==b) {return 0;}
				return a < b ? 1 : -1;
			}

			turbine_blades.sort(function(a,b) {
				// first compare these values in order
				var comparisons = ["durability","efficiency","flow"];
				for(var i=0;i<comparisons.length;i++) {
					let idx = comparisons[i];
					let n = compareNum(a.large[idx],b.large[idx]);
					if (n != 0) {return n;}
				}
				
				// if it's still not sorted, sort alphabetically by name last
				return a.material.localeCompare(b.material);
			});

			var great = $( "<optgroup label='Great'>" );
			var acceptable = $( "<optgroup label='Acceptable'>" );
			var garbage = $( "<optgroup label='Garbage'>" );

			for(var i=0;i<turbine_blades.length;i++) {
				var blade = turbine_blades[i];
				var name = escapehtml(blade.material);
				var dur = blade.large.durability.toLocaleString();
				var eff = blade.large.efficiency + "%";
				var flow = blade.large.flow.toLocaleString();

				var fun_fact = "";
				if (typeof blade.fun_fact != "undefined") {
					fun_fact = " (" + blade.fun_fact + ")";
				}

				var prnt = garbage;
				if (typeof blade.category != "undefined") {
					if (blade.category == "great") {prnt = great;}
					else if (blade.category == "acceptable") {prnt = acceptable;}
				}

				prnt.append("<option value='"+name+"' data-content='"+buildTbl(name,dur,eff,flow + fun_fact)+"'>"+name+"</option>" );
			}
			material_search.append([opt1,opt2,great,acceptable,garbage]);
			material_search.selectpicker({liveSearch:true,maxOptions:1, sanitizeFn:(i) => i});

			var opts = [];
			opts.push("<option value='-' disabled selected>Select fuel...</option>");
			for(var i=0;i<turbine_fuels.length;i++) {
				var category = turbine_fuels[i];

				category.fuels.sort(function(a,b) {
					if (a.fuel_value == b.fuel_value) {return 0;}
					return a.fuel_value < b.fuel_value ? 1 : -1;
				});

				var cat = $( "<optgroup label='" + escapehtml(category.name) + "'></optgroup>" );
				for(var j=0;j<category.fuels.length;j++) {
					var fuel = category.fuels[j];
					var name = escapehtml(fuel.name);
					var f = fuel.fuel_value

					$("<option value='"+name+"' data-subtext='"+f+"'>"+name+"</option>").appendTo(cat);
				}
				opts.push(cat);
			}
			fuel_search.append(opts);
			fuel_search.selectpicker({liveSearch:true,maxOptions:1,showSubtext:true, sanitizeFn:(i) => i});

			material_search.on( "changed.bs.select", function() {
				selected_material = getMaterialByName(material_search.val());

				displayMaterialStats();
				displayFuelStats();
			});

			fuel_search.on( "changed.bs.select", function() {
				selected_fuel = getFuelByName(fuel_search.val());

				displayFuelStats();
			});

			// Fix lag caused by selectpicker
			$(".dropdown-menu").off("focusout");
			$(".dropdown-menu").on("focusout",function(a) {
				$(window).off('resize.getSize scroll.getSize');
			});

			// apply theme
			window.applyThemeToBootstrapSelect($("div.material-search",p1));
			window.applyThemeToBootstrapSelect($("div.fuel-search",p2));
		},1);
	}
});
