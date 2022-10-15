onVersionChanged(function(version) {
	var card = $( "#gt-recipe-conflict-checker" );
	if (version != "gtnh") {
		card.hide();
		return;
	} else {
		card.show();
	}

	if (window.recipeConflictCheckerInitialized) return;
	window.recipeConflictCheckerInitialized = true;

	var header = $( ".card-header", card );
	header.addClass( "link-pointer" );
	var collapse = $( ".collapse", card );
	header.off("click");
	header.on("click",function() {
		collapse.collapse( "toggle" );
	});

	collapse.on("show.bs.collapse",function(e) {
		if (e.target == $("> .collapse",card)[0]) {
			card.parent().addClass("container-fluid").removeClass("container");
		}
	}).on("hide.bs.collapse",function(e) {
		if (e.target == $("> .collapse",card)[0]) {
			card.parent().removeClass("container-fluid").addClass("container");
		}
	});

	function tabChanged(str) {
		$(".tab-pane",card).hide();
		$("#recipe-conflict-tabs-" + str, card).show();
	}
	$("input[name='recipe-conflict-tabs']",card).change(function() {
		if ($(this).is(":checked")) {
			tabChanged($(this).val());
		}
	});

	var displayMode = "compact";
	function displayModeChanged(str, parent) {
		if (displayMode == "full") {
			$(".recipe-item-compact",parent).hide();
			$(".recipe-item-full",parent).show();
		} else {
			$(".recipe-item-compact",parent).show();
			$(".recipe-item-full",parent).hide();
		}
	}
	$("input[name='recipe-conflict-displaymode']",card).change(function() {
		if ($(this).is(":checked")) {
			displayMode = $(this).val();
			displayModeChanged(displayMode, card);
		}
	});


	var logicMode = "split";
	function logicModeChanged(str) {
		logicMode = str;
		if (logicMode == "split") {
			$(".detected-conflicts-header",card).text("List of required machines separated by circuit");
		} else {
			$(".detected-conflicts-header",card).text("Detected conflicts");
		}
		calculateConflicts();
	}
	$("input[name='recipe-conflict-logic']",card).change(function() {
		if ($(this).is(":checked")) {
			logicModeChanged($(this).val());
		}
	});

	$(".btn-group-toggle label",card).tooltip({trigger:"hover"});
	$(".card-title .text-muted",card).tooltip({trigger:"hover"});


	var selected_machine = "";
	var downloaded_machines = {};
	var downloaded_grouped = {};
	var current_recipes_list = {};

	tabChanged("search");
	displayModeChanged("compact");
	logicModeChanged("split");

	var machine_search = $(".machine-search", card);
	var recipe_search_input = $(".recipe-search-input", card);
	var recipe_search_output = $(".recipe-search-output", card);
	var recipe_search_result = $(".recipe-search-result", card);
	var added_recipes = $(".added-recipes", card);
	var conflict_results = $(".conflict-results", card);
	var settings_input = $(".settings-input", card);
	var loading_settings = false;

	var added_recipes_list = [];
	var autosave_name = "";

	var folderName = "2022-10-07_15-16-48";
	var filesList = [
	    "Ore Washing Plant.json","Thermal Centrifuge.json","Compressor.json","Extractor.json","Disassembler.json","Scanner.json","Rock Breaker.json","Ore Byproduct List.json","Replicator.json","Assemblyline Process.json",
	    "Plasma Arc Furnace.json","Arc Furnace.json","Printer.json","Sifter.json","Forming Press.json","Precision Laser Engraver.json","Mixer.json","Autoclave.json","Electromagnetic Separator.json","Electromagnetic Polarizer.json",
	    "Pulverization.json","Chemical Bath.json","Fluid Canning Machine.json","Brewing Machine.json","Fluid Heater.json","Distillery.json","Fermenter.json","Fluid Solidifier.json","Fluid Extractor.json","Packager.json",
	    "Unpackager.json","Fusion Reactor.json","Centrifuge.json","Electrolyzer.json","Blast Furnace.json","DTPF.json","Primitive Blast Furnace.json","Implosion Compressor.json","Vacuum Freezer.json","Chemical Reactor.json",
	    "Large Chemical Reactor.json","Distillation Tower.json","Oil Cracker.json","Pyrolyse Oven.json","Wiremill.json","Bending Machine.json","Alloy Smelter.json","Assembler.json","Circuit Assembler.json","Canning Machine.json",
	    "Lathe.json","Cutting Machine.json","Slicing Machine.json","Extruder.json","Forge Hammer.json","Amplifabricator.json","Mass Fabrication.json","Combustion Generator Fuels.json","Extreme Diesel Engine Fuel.json",
	    "Gas Turbine Fuel.json","Thermal Generator Fuels.json","Semifluid Boiler Fuels.json","Plasma Generator Fuels.json","Magic Energy Absorber Fuels.json","Naquadah Reactor MkI.json","Naquadah Reactor MkII.json",
	    "Naquadah Reactor MkIII.json","Naquadah Reactor MkIV.json","Naquadah Reactor MkV.json","Fluid Naquadah Reactor.json","Large Boiler.json","Rocket Engine Fuel.json","RTG.json","Semifluid Generator Fuels.json",
	    "Bio Lab.json","Bacterial Vat.json","Acid Generator.json","Circuit Assembly Line.json","Radio Hatch Material List.json","High Temperature Gas-cooled Reactor.json","Draconic Evolution Fusion Crafter.json",
	    "Large Naquadah Reactor.json","Naquadah Fuel Refine Factory.json","Neutron Activator.json","Extreme Heat Exchanger.json","Precise Assembler.json","Research station.json","Digester.json","Dissolution Tank.json",
	    "Electric Implosion Compressor.json"
	];
	filesList.sort();
	machine_search.append("<option value='-' disabled selected>Select Machine</option>");
	machine_search.append(filesList.map(i => `<option value='${i}'>${i.replace(/\.json$/,"")}</option>`));
	machine_search.selectpicker({liveSearch:true,maxOptions:1});
	var selectpicker_created = false;

	machine_search.off( "changed.bs.select" );
	machine_search.on( "changed.bs.select", function() {
		selected_machine = machine_search.val();
		//console.log("SELECTED",selected_machine);
		added_recipes_list = [];
		added_recipes.empty();
		downloadMachine(selected_machine);
		saveSettings();
	});

	function doSearch() {
		var inp = recipe_search_input.val().toLowerCase();
		var out = recipe_search_output.val().toLowerCase();
		var searched_recipes_list = [];

		if (inp != "" || out != "") {
			searched_recipes_list = current_recipes_list.filter(r => {
				var inp_b = inp == "";
				var out_b = out == "";
				r.lev = 999999;

				if (inp != "" && r.iNames.indexOf(inp) > -1) {
					r.lev = Math.min(r.lev, ...r.recipe.iI.concat(r.recipe.fI).map(i => levenshtein(i.lN.toLowerCase(),inp)));
					inp_b = true;
				}

				if (out != "" && r.oNames.indexOf(out) > -1) {
					r.lev = Math.min(r.lev, ...r.recipe.iO.concat(r.recipe.fO).map(i => levenshtein(i.lN.toLowerCase(),inp)));
					out_b = true;
				}

				return inp_b && out_b;
			});
			searched_recipes_list.sort((a,b) => Math.sign(a.lev - b.lev));
		} else {
			searched_recipes_list = [...current_recipes_list];
			searched_recipes_list.sort((a,b) => Math.sign(a.recipe.idx - b.recipe.idx));
		}

		recipe_search_result.empty().append(searched_recipes_list.slice(0,500).map(v => {
			v.pnl.click(() => {
				addRecipe(v.recipe.idx);
			})
			return v.pnl
		}));
	}

	var search_tid;
	recipe_search_input.on("input",function() {
		if (!selected_machine) return;
		if (!downloaded_machines[selected_machine]) return;
		if (search_tid) {clearTimeout(search_tid);}
		search_tid = setTimeout(doSearch,150);
	});
	recipe_search_output.on("input",function() {
		if (!selected_machine) return;
		if (!downloaded_machines[selected_machine]) return;
		if (search_tid) {clearTimeout(search_tid);}
		search_tid = setTimeout(doSearch,150);
	});

	function buildTbl(list) {
		var ret = ["<table class='table table-borderless table-xs mb-0'>"];

		list.sort((i1,i2) => {
			if (i1.cfg && !i2.cfg) {
				return -1;
			} else if (!i1.cfg && i2.cfg) {
				return 1;
			}
			return 0;
		})

		for(let i of list) {
			let name = "<span class='align-baseline d-inline-block'>" + i.lN + "</span>";
			if (i.cfg) {name = "<span class='text-muted align-baseline d-inline-block'>["+i.cfg+"]</span> " + name;}
			if (i.a > 0) {name += "<span class='text-muted ml-1 align-baseline d-inline-block'>x" + i.a + "</span>";}
			if (i.a == 0) {
				ret.push("<tr style='background-color:rgba(0,0,0,0.2); white-space:nowrap'><td>");
			} else {
				ret.push("<tr><td style='white-space:nowrap;'>");
			}
			ret.push(name);
			ret.push("</td></tr>")
		}

		return ret.join("");
	}

	function buildRecipePanel(recipe, removebtn) {
		let eut = recipe.eut;
		let dur = recipe.dur;
		let stats = eut + " EU/t, " + (dur>20 ? Math.floor(dur/20*1000+0.5)/1000 + "s" : dur + "t");
		let pnl = $("<div class='p-1 m-0 recipe-item'>");


		//////////////////////////////////
		// compact display
		let compact = $("<div class='m-0 recipe-item-compact'>").css({
			display:"flex",
			gap:"4px"
		});

		let compact_list = [];
		let circuit = recipe.iI.find(i => i.a == 0 && typeof i.cfg != "undefined");
		if (circuit) {
			compact_list.push($("<div>").text("C" + circuit.cfg).css({
				width:"40px",
				backgroundColor:"rgba(0,0,0,0.2)",
				textAlign:"center"
			}));
		} else {
			compact_list.push($("<div>").css("width","40px"));
		}

		let tdCSS = {width: "50%",overflowX: "auto", whiteSpace: "nowrap", wordBreak: "break-all"};
		let iNames = getItemNames(recipe.iI.filter(i => i.a>0||typeof i.cfg == "undefined"),recipe.fI, "; ");
		let oNames = getItemNames(recipe.iO,recipe.fO, "; ");
		compact_list.push($("<div>").text(iNames).css(tdCSS));
		compact_list.push($("<div>").text(oNames).css(tdCSS).css("width","100%"));

		compact.append(
			compact_list
		);

		//////////////////////////////////
		// full display
		let full = $("<div class='row recipe-item-full'>");

		let colIn = $("<div class='col px-1'>").css({
			maxHeight: "200px",
			overflowY: "auto"
		});
		let colOut = $("<div class='col px-2'>").css({
			maxHeight: "200px",
			overflowY: "auto"
		});

		colIn.append(buildTbl(recipe.iI.concat(recipe.fI)));
		colOut.append(buildTbl(recipe.iO.concat(recipe.fO)));
		colOut.append($("<div class='p-2 my-1 bg-secondary'>").append(stats));

		//let names = recipe.iI.concat(recipe.fI).concat(recipe.iO).concat(recipe.fO).map(r => r.lN).join(" ");

		full.append([colIn,colOut]);
		full.attr("data-recipe-idx",recipe.idx);


		compact.attr("title",$("<div class='row p-2' style='min-width:500px;'>").html(full.html()).prop("outerHTML")).tooltip({
			html: true
		});
		pnl.append([compact,full]);

		if (removebtn) {
			pnl.addClass("position-relative");
			pnl.prepend($('<button type="button" class="close link-pointer" style="z-index:10; top:0; right:0;" aria-label="Close">'+
							'<span aria-hidden="true">&times;</span>'+
						'</button>').click(()=>removeRecipe(recipe.idx, pnl)));
		}

		displayModeChanged(displayMode,pnl);

		return pnl; // {pnl:pnl,names:names};
	}

	function getSettingsToSave() {
		return {
			machine: selected_machine,
			recipes: added_recipes_list
		}
	}

	function saveSettings() {
		var settings = getSettingsToSave();
		settings_input.val(JSON.stringify(settings));
		if (autosave_name != "") {
			for(let i in saved) {
				if (saved[i].name == autosave_name) {
					saved[i].settings = settings;
					save();
					break;
				}
			}
		}
	}

	function addRecipe(recipeIdx) {
		if (recipeIdx == null) return;
		//console.log("addRecipe",recipeIdx);
		if (!downloaded_machines[selected_machine]) return;
		var recipe;
		if (typeof recipeIdx != "number") {
			// its an object
			recipe = recipeIdx;
		} else {
			recipe = downloaded_machines[selected_machine].recs[recipeIdx];
		}

		if (added_recipes_list.some(i => i.idx == recipe.idx)) {return;}
		
		var pnl = buildRecipePanel(recipe, true);
		added_recipes.append(pnl);
		added_recipes_list.push(recipe);
		if (typeof recipeIdx != "number") {
			//{"machine":"Mixer.json","recipes":[{"en":true,"dur":200,"eut":7,"iI":[{"a":1,"uN":"gt.metaitem.01.2086","lN":"Gold Dust"},{"a":2,"uN":"gt.metaitem.01.2054","lN":"Silver Dust"},{"cfg":1,"a":0,"uN":"gt.integrated_circuit","lN":"Programmed Circuit"}],"iO":[{"a":2,"uN":"gt.metaitem.01.2303","lN":"Electrum Dust"}],"fI":[],"fO":[],"idx":728}]}
			//{"machine":"Mixer.json","recipes":[{"en":true,"dur":200,"eut":7,"iI":[{"a":1,"uN":"gt.metaitem.01.2086","lN":"Gold Dust"},{"a":1,"uN":"gt.metaitem.01.2054","lN":"Silver Dust"},{"cfg":1,"a":0,"uN":"gt.integrated_circuit","lN":"Programmed Circuit"}],"iO":[{"a":2,"uN":"gt.metaitem.01.2303","lN":"Electrum Dust"}],"fI":[],"fO":[],"idx":728}]}
			$($(".col",pnl)[0]).prepend("<small class='text-muted'>This recipe was not found, possibly due to being from a different version, but was added anyway</small>");
		}
		calculateConflicts();
		saveSettings();
	}

	function removeRecipe(recipeIdx, pnl) {
		for(let i in added_recipes_list) {
			if (added_recipes_list[i].idx == recipeIdx) {
				added_recipes_list.splice(i,1);
				if (pnl) {
					pnl.remove();
				} else {
					$("[data-recipe-idx='"+recipeIdx+"']",added_recipes).remove();
				}
				calculateConflicts();
				break;
			}
		}

		saveSettings();
	}


	/*
	function checkConflictsInGroup(machine, circuitUID, recipe) {
		var group = downloaded_grouped[machine][circuitUID];
		if (!group) {
			downloaded_grouped[machine][circuitUID] = [[recipe]];
		} else {
			let outerConflictDetected = true;
			for(let gi in group) {
				let conflictDetected = false;
				for(let i in group[gi]) {
					let otherRecipe = group[gi][i];

					if (allInputsConflict(getAllInputsForTwo(recipe), otherRecipe)) {
						// conflict detected between 2 recipes
						console.log("conflict detected between 2", recipe, otherRecipe);
						conflictDetected = true;
						break;
					}

					let allInputs = getAllInputsForTwo(recipe, otherRecipe);

					if (group[gi].length > 1) {
						for(let ii in group[gi]) {
							let thirdRecipe = group[gi][ii];
							if (thirdRecipe.idx == otherRecipe.idx) continue;

							if (allInputsConflict(allInputs, thirdRecipe)) {
								// conflict detected between 3 recipes (2 => 1), add to new group
								console.log("conflict detected between 3", recipe, otherRecipe, thirdRecipe);
								conflictDetected = true;
								break;
							}
						}
					}
				}
				if (!conflictDetected) {
					//console.log("no conflict detected in",circuitUID,"group",gi,"for recipe",recipe);
					group[gi].push(recipe);
					outerConflictDetected = false;
					break;
				}
			}
			if (outerConflictDetected) {
				console.log("conflicts detected in ",circuitUID, "in all groups, making new group for recipe", recipe);
				group.push([recipe]);
			}
		}
	}

	function groupRecipes(machine) {
		if (!downloaded_machines[machine]) return;

		downloaded_grouped[machine] = {};
		var recipes = downloaded_machines[machine].recs;
		for(let idx in recipes) {
			let recipe = recipes[idx];

			let circuitUID = getCircuitUID(getCircuitForRecipe(recipe));
			checkConflictsInGroup(machine, circuitUID, recipe)
		}

		console.log("RECIPE GROUPS",downloaded_grouped[machine]);
	}
	*/

	function calculateConflicts() {
		if (!downloaded_machines[selected_machine]) return;
		if (!downloaded_machines[selected_machine].recs) return;
		var recipes = downloaded_machines[selected_machine].recs;

		function calculateConflictsSplit() {
			// add each selected recipe to the list one by one and if adding that causes a recipe conflict, create a new group for that recipe
			conflict_results.empty();
			conflict_results.text("Calculating...");

			function checkTotalConflicts(allInputs) {
				for(let i in recipes) {
					let otherRecipe = recipes[i];

					if (allInputsConflict(allInputs, otherRecipe)) {
						return true;
					}
				}

				return false;
			}

			// allInputsGrouped - structure {[circuitNum] = [array of machines]}
			var allInputsGrouped = {none:[]}
			for(let i in added_recipes_list) {
				let recipe = added_recipes_list[i];

				let circuit = recipe.iI.find(i => i.a == 0 && typeof i.cfg != "undefined");
				if (circuit) {
					if (!allInputsGrouped[circuit.cfg]) {
						allInputsGrouped[circuit.cfg] = [];
					}
				}

				let group = allInputsGrouped[circuit ? circuit.cfg : "none"];

				if (group.length == 0) {
					// no machines added yet, add current recipe to new machine
					group.push(getAllInputs([recipe]));
				} else {
					let foundMachine = false;
					let allInputsOne = getAllInputs([recipe]);
					for(let iG = 0; iG < group.length; iG++) {
						let allInputs = getAllInputsPlusOne(group[iG], allInputsOne);

						if (!checkTotalConflicts(allInputs)) {
							// adding this recipe will not cause a conflict, add it to this machine
							group[iG] = allInputs;
							foundMachine = true;
							break;
						}
					}
					if (!foundMachine) {
						// this recipe couldn't be added to any existing machine, add it to a new machine
						group.push(allInputsOne);
					}
				}
			}

			// draw each group on screen
			conflict_results.empty();
			let machinesList = $("<div>").css({
				display:"flex",
				width:"100%",
				overflowX: "auto",
				gap: "4px",
			});
			conflict_results.append(machinesList);

			for(let i in allInputsGrouped) {
				let group = allInputsGrouped[i];
				for(let iG in group) {
					let machine = group[iG];

					let machineCont = $("<div class='card card-body d-inline-block p-1'>").css({
						width: "600px",
						height: "400px",
						flexShrink: 0
					});
					let machineTitle = $("<center>").text("Circuit: " + i);
					let listCont = $("<div class='p-1'>").css({
						display:"flex",
						flexDirection: "column",
						height: "calc(100% - 24px)",
						overflowY: "auto"
					});
					machineCont.append([machineTitle,listCont]);
					machinesList.append(machineCont);

					let recipeCount = 0;
					for(let rIdx in machine.recipeIdx) {
						let recipe = recipes[rIdx];
						if (recipe) {
							recipeCount++;
							listCont.append(buildRecipePanel(recipe));
						}
					}
					machineTitle.html(machineTitle.text() + "<span class='text-muted'>, " + recipeCount + " recipes</span>");
				}
			}
		}

		function calculateConflictsList() {
			// simply dump all inputs in one list and list the conflicts
			var allInputs = getAllInputs(added_recipes_list);
			conflict_results.empty();

			var total_conflicts = [];
			var partial_conflicts = [];

			for(let i in recipes) {
				let otherRecipe = recipes[i];

				if (allInputsConflict(allInputs,otherRecipe)) {
					var pnl = buildRecipePanel(otherRecipe);
					total_conflicts.push(pnl);
				}
			}

			if (total_conflicts.length > 0) {
				conflict_results.append("<div class='p-2 mb-2 bg-danger text-center'>Total conflicts <small class='text-muted'>(All inputs conflict)</small><br><small></div>").append(total_conflicts);
			}

			for(let i in added_recipes_list) {
				let otherRecipe = added_recipes_list[i];
				if (partialInputsConflict(allInputs, otherRecipe)) {
					var pnl = buildRecipePanel(otherRecipe);
					partial_conflicts.push(pnl);
				}
			}

			if (partial_conflicts.length > 0) {
				var partial_header = $("<div class='p-2 mb-2 bg-warning text-center link-pointer'>Partial conflicts (" + partial_conflicts.length + "x) <small>"+
					"(Parts of inputs conflict)</small><br><small>These conflicts usually don't cause any issues</small></div>");
				var partial_content = $("<div class='collapse'>");
				partial_header.click(function() {
					partial_content.collapse("toggle");
				});
				conflict_results.append().append([partial_header,partial_content.append(partial_conflicts)]);
			}
		}

		if (logicMode == "list") {
			calculateConflictsList();
		} else {
			calculateConflictsSplit();
		}
	}

	function downloadMachine(machine) {
		if (downloaded_machines[machine]) {
			listRecipes(machine);
		} else {
			$.get("data/exported_recipes/" + folderName + "/" + machine, function(data) {
				downloaded_machines[machine] = data;
				//groupRecipes(machine);
				listRecipes(machine);
			});
		}
	}

	function getAllInputsPlusOne(allInputs, plusOne) {
		return {
			items: {...allInputs.items, ...plusOne.items},
			fluids: {...allInputs.fluids, ...plusOne.fluids},
			circuits: {...allInputs.circuits, ...plusOne.circuits},
			recipeIdx: {...allInputs.recipeIdx, ...plusOne.recipeIdx}
		};

	}

	function getAllInputs(recipes) {
		var items = {};
		var fluids = {};
		var circuits = {};
		var recipeIdx = {};

		for(let i in recipes) {
			let recipe = recipes[i];
			recipeIdx[recipe.idx] = true;

			for(let item of recipe.iI) {
				if (item.a == 0 && typeof item.cfg != "undefined") {
					circuits[getCircuitUID(item)] = true;
				} else {
					if (items[item.uN]) {
						if (!items[item.uN].some(a => a == item.a)) {
							items[item.uN].push(item.a);
						}
					} else {
						items[item.uN] = [item.a];
					}
				}
			}
			for(let fluid of recipe.fI) {
				if (fluid.a == 0) continue;

				if (fluids[fluid.uN]) {
					if (!fluids[fluid.uN].some(a => a == fluid.a)) {
						fluids[fluid.uN].push(fluid.a);
					}
				} else {
					fluids[fluid.uN] = [fluid.a];
				}
			}
		}

		//console.log("all inputs for up to 2 recipes", items, fluids, circuits);

		return {items:items,fluids:fluids,circuits:circuits, recipeIdx: recipeIdx};
	}

	function getAllInputsForTwo(recipe1, recipe2) {
		var recipes = [recipe1];
		if (recipe2) recipes.push(recipe2);
		return getAllInputs(recipes);
	}

	function getCircuitUID(circuit) {
		if (typeof circuit != "undefined" && circuit != null) {
			return circuit.uN + "[" + circuit.cfg + "]";
		}

		return "-";
	}

	function getCircuitForRecipe(recipe) {
		return recipe.iI.find(i => i.uN == "gt.integrated_circuit" || i.uN == "item.BioRecipeSelector" || i.uN == "item.T3RecipeSelector");
	}

	function allInputsConflict(allInputs, otherRecipe, debug) {
		if (typeof allInputs.recipeIdx[otherRecipe.idx] != "undefined") {
			if (debug) console.log("it's already added");
			return false;
		}

		var circuit = getCircuitForRecipe(otherRecipe);
		if (circuit) {
			if (typeof allInputs.circuits[getCircuitUID(circuit)] == "undefined") {
			if (debug) console.log("needed circuit doesnt exist");
				return false;
			}
		}

		for(let i in otherRecipe.iI) {
			let item = otherRecipe.iI[i];
			if (item.a == 0) continue;

			if (typeof allInputs.items[item.uN] == "undefined") {
				if (debug) console.log("needed item ",item.lN," doesnt exist");
				// missing item = no conflict
				return false;
			}
		}

		for(let i in otherRecipe.fI) {
			let fluid = otherRecipe.fI[i];
			if (fluid.a == 0) continue;

			if (typeof allInputs.fluids[fluid.uN] == "undefined") {
				if (debug) console.log("needed fluid ",fuid.lN," doesnt exist");
				// missing fluid = no conflict
				return false;
			}
		}

		// if it got this far it means all items exist, now check if all amounts match

		for(let i in otherRecipe.iI) {
			let item = otherRecipe.iI[i];
			if (item.a == 0) continue;
			if (!allInputs.items[item.uN].every(i => i == item.a)) {
				if (debug) console.log("needed item ",item.lN," doesn't have the same amount");
				// same amounts = no conflict
				return true;
			}
		}

		for(let i in otherRecipe.fI) {
			let fluid = otherRecipe.fI[i];
			if (fluid.a == 0) continue;
			if (!allInputs.fluids[fluid.uN].every(f => f == fluid.a)) {
				if (debug) console.log("needed fluid ",fluid.lN," doesn't have the same amount");
				// same amounts = no conflict
				return true;
			}
		}
		
		return true; //allAmountsMatch;
	}

	function partialInputsConflict(allInputs, otherRecipe) {
		var circuit = getCircuitForRecipe(otherRecipe);
		if (circuit) {
			if (typeof allInputs.circuits[getCircuitUID(circuit)] == "undefined") {
				return false;
			}
		}

		for(let i in otherRecipe.iI) {
			let item = otherRecipe.iI[i];
			if (item.a == 0) continue;

			if (typeof allInputs.items[item.uN] != "undefined" && 
				allInputs.items[item.uN].some(i => i != item.a)) {
				// item found and they have different amounts
				return true;
			}
		}

		for(let i in otherRecipe.fI) {
			let fluid = otherRecipe.fI[i];
			if (fluid.a == 0) continue;
			if (typeof allInputs.fluids[fluid.uN] != "undefined" &&
				allInputs.fluids[fluid.uN].some(f => f != fluid.a)) {
				// fluid found and they have different amounts
				return true;
			}
		}
		
		return false;
	}

	function getItemNames(i,f,sep) {
		return (i.concat(f).map(r => r.lN + (r.cfg ? " " + r.cfg : "")).join(sep || " "));
	}

	function listRecipes(machine) {
		if (!downloaded_machines[machine]) return;

		recipe_search_result.empty();
		current_recipes_list = [];

		var recipes = downloaded_machines[machine].recs;
		for(let idx in recipes) {
			let recipe = recipes[idx];
			recipe.idx = parseInt(idx);

			let pnl = buildRecipePanel(recipe);
			current_recipes_list.push({
				recipe: recipe,
				pnl: pnl,
				iNames: getItemNames(recipe.iI,recipe.fI).toLowerCase(),
				oNames: getItemNames(recipe.iO,recipe.fO).toLowerCase(),
			});
		}

		recipe_search_result.append(current_recipes_list.slice(0,500).map(v => {
			v.pnl.click(() => {
				addRecipe(v.recipe.idx);
			})
			return v.pnl
		}));

		if (loading_settings !== false) {
			for(let i=loading_settings.recipes.length-1;i>=0;i--) {
				let recipe = loading_settings.recipes[i];
				if (typeof recipe.idx != "undefined") {
					let otherRecipe = recipes[recipe.idx];

					if (JSON.stringify(recipe) == JSON.stringify(otherRecipe)) {
						// match found
						loading_settings.recipes.splice(i,1);
						addRecipe(recipe.idx);
						//console.log("found recipe the normal way");
					} else {
						//console.log("match not found, deleting idx to prepare for more comparisons");
						// match not found
						delete recipe.idx;
					}
				}
			}

			if (loading_settings.recipes.length > 0) {
				let negative_indexes = 0;
				//console.log("recipes not found:",loading_settings.recipes);
				// some recipes weren't found by idx, try to find them through iteration and comparison instead
				for(let i in recipes) {
					let cpy = {...recipes[i]};
					delete cpy.idx;
					let cpyStr = JSON.stringify(cpy);

					for(let ii in loading_settings.recipes) {
						let recipe = loading_settings.recipes[ii];

						if (JSON.stringify(recipe) == cpyStr) {
							addRecipe(recipes[i].idx);
						} else {
							//alert("Loaded recipe " + JSON.stringify(recipe) + " not found. Adding it anyway, but note that it may be from a different version.");
							negative_indexes--;
							recipe.idx = negative_indexes;
							addRecipe(recipe);
							loading_settings.recipes.splice(ii,1);
							break;
						}
					}
				}
			}

			/*
			for(let i in loading_settings.recipes) {
				let recipe = loading_settings[i];
				let recipeJson
				addRecipe(loading_settings.recipes[i]);
			}
			*/

			loading_settings = false;
		}

		// TESTING
		/*
		recipe_search.selectpicker('val','442');
		recipe_search.selectpicker('val','542');
		recipe_search.selectpicker('val','672');
		recipe_search.selectpicker('val','513');
		recipe_search.selectpicker('val','199');
		*/
	}



	// TESTING
	/*
	selected_machine = "Large Chemical Reactor.json";
	downloadMachine(selected_machine);
	*/

	settings_input.on("input",() => {
		if (settings_input.val() != "") {
			var jsonObj = null;

			try {
				jsonObj = JSON.parse(settings_input.val());
			} catch (e) {
				alert("Invalid json object. Error: " + e);
				return;
			}

			loading_settings = jsonObj;
			machine_search.selectpicker("val", jsonObj.machine);
			collapse.collapse("show");
		}
	}).click((e) => {
		settings_input.select();
		e.preventDefault();
		e.stopPropagation();
	});

	function setAutosave(n) {
		autosave_name = n;
		if (autosave_name != "") {
			var pnl = $(".autosave-name",card);
			pnl.show().text("Autosaving: " + autosave_name);
			if ($("button",pnl).length == 0) {
				pnl.addClass("position-relative");
				pnl.prepend(
					$('<button type="button" class="close link-pointer" style="z-index:10; top:-6px; right:-20px;" aria-label="Close">'+
						'<span aria-hidden="true">&times;</span>'+
					'</button>')
					.click((e)=>{setAutosave(""); e.preventDefault(); e.stopPropagation(); return true;})
					.attr("title","Stop autosaving").tooltip()
				);
			}
		} else {
			$(".autosave-name",card).hide();
		}
	}

	try {
		var saved = JSON.parse(localStorage["recipe_conflict_saved"] || "[]");
		var saveload_list = $(".recipe-conflict-saveload-list",card);
		var saveload_new = $(".recipe-conflict-save-new",card);

		function save() {
			localStorage["recipe_conflict_saved"] = JSON.stringify(saved);
			listSaved();
		}

		function listSaved() {
			saveload_list.empty();

			for(let i in saved) {
				let row = saved[i];
				
				var cpy = saveload_new.clone();
				$(".btn-danger",cpy).click(() => {
					if (confirm("Are you sure you want to delete this?")) {
						if (row.name == autosave_name) {
							setAutosave("");
						}
						saved.splice(i,1);
						save();
					}
				}).show();

				$(".btn-primary",cpy).click(() => {
					setAutosave(row.name);
					loading_settings = JSON.parse(JSON.stringify(row.settings)); // clone object
					machine_search.selectpicker("val", row.settings.machine);
				}).show();

				$(".btn-success",cpy).click(() => {
					if (confirm("Are you sure you want to overwrite that save?")) {
						saved[i] = {
							name: row.name,
							settings: getSettingsToSave()
						};
						save();
					}
				}).show();

				$(".form-control",cpy).hide();
				$(".newlabel",cpy).hide();
				$(".namelabel",cpy).show().text(row.name + " (" + (row.settings.recipes ? row.settings.recipes.length : 0) + " recipes)");
				saveload_list.append(cpy);
			}
		}
		listSaved();

		$(".btn-primary",saveload_new).hide();
		$(".btn-danger",saveload_new).hide();
		$(".namelabel",saveload_new).hide()
		$(".btn-success",saveload_new).click(() => {
			var name = $(".form-control",saveload_new).val();
			if (name == "") return;

			$(".form-control",saveload_new).val("");

			for(let i in saved) {
				let row = saved[i];
				if (row.name == name) {
					if (confirm("Saved settings with that name already exists. Overwrite?")) {
						saved[i] = {
							name: name,
							settings: getSettingsToSave()
						};
						setAutosave(name);
						save();
					}
					return;
				}
			}

			saved.push({
				name: name,
				settings: getSettingsToSave()
			});

			setAutosave(name);
			save();
		});
	} catch (e) {
		alert("Unable to parse saved settings. Error: " + e + ". The json has been dumped to console.");
		console.log("--- Saved recipes:");
		console.log(localStorage["recipe_conflict_saved"]);
		console.log("--- Run the following command in console to delete saved recipes:");
		console.log("delete localStorage['recipe_conflict_saved'];");
	}
});