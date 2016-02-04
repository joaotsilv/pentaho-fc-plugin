/**
 *
 * This CDF component renders Fusion Charts Graph
 *
 */

var xLoadFunct= function(){
	window.XDashFusionChartComponent = BaseComponent.extend({
		type: "XDashFusionChartComponent",
		update: function(){

			var options = this.getOptions();

			//send the webAppPath to the plugin
			//need in realtimecharts
			options.webAppPath=webAppPath;

			var urlApi = webAppPath + '/plugin/fusion_plugin/api/renderChart';
			var urlResources = webAppPath + '/content/xfusion';
			var myself = this;

			// get the xml chart
			var resultXml = $.ajax({type: 'GET', url: urlApi, data: options, async: false}).responseText;

			// if not graph or chart,  show error
			if((resultXml.toLowerCase().indexOf("<graph") == -1) &&
					(resultXml.toLowerCase().indexOf("<chart") == -1))
			{
				if (resultXml.toLowerCase().indexOf("error:") >= 0)
				{
					var res = resultXml.replace("Error:","");

					$("#"+myself.htmlObject).html(
							"<div class=\"ui-state-error ui-corner-all\" style=\"padding: 0 .7em;\">"+
							"<p style=\"margin: 0 0 .3em;\">"+
							"<span class=\"ui-icon ui-icon-alert\" style=\"float: left; margin-right: .3em;\"></span>"+
							"<strong>Error:</strong>"+
							res+
							"</p></div>");
				}
				else
					$("#"+myself.htmlObject).html(resultXml);
			}
			// graph + warnings
			else
			{
				var hasWarning = false;
				if (resultXml.toLowerCase().indexOf("warning") >= 0)
				{
					resultXml = resultXml.replace("Warning:","");
					var index = resultXml.indexOf("<");
					var warning = resultXml.substring(0,index);
					hasWarning = true;

					resultXml = resultXml.substring(index,resultXml.lenght);
				}

				myself.xmlResultData = resultXml;

				// get chart type from xml
				options.chartType = $(resultXml).attr("chartType");

				// get HTML5 from xml
				options.isHTML5 = eval($(resultXml).attr("isHTML5"));

				//test if is for free version
				var isFree=eval($(resultXml).attr("free"));
				options.chartType=(isFree==false?options.chartType:"FCF_"+options.chartType);

				// calculate width and height of fusion chart
				var widgetNum = this.htmlObject.substring(this.htmlObject.length - 1);
				var widgetPanel = document.getElementById("content-area-Panel_" + widgetNum);

				if(widgetPanel != undefined) { //we are in an EE dashboard
					var rect = getRectangle(widgetPanel);
					options.width = rect.width - 25;
					options.height = rect.height - 20;
				}

				//if is the first time or if is the flag reload on reloadOnRefresh on the chart will be full loaded
				if(myself.chartObject == undefined || options.reloadOnRefresh ||isFree) {
					this.clear();

					//is to render in HTML5?
					if(options.isHTML5==undefined)
						options.isHTML5=false;
					var chartTypeFull=(options.isHTML5&&!isFree)?options.chartType:urlResources+"/swf/"+options.chartType+".swf";

					//create chart Object
					myself.chartObject = new FusionCharts( chartTypeFull, myself.htmlObject+"-generated", options.width, options.height, "0","1" );

					myself.chartObject.setDataXML(resultXml);

					//set extra configuration for HTML5 charts
					if (!!myself.chartObject._overrideJSChartConfiguration&&options.overrideJSChartConfiguration!=undefined) {
						myself.chartObject.chartObject._overrideJSChartConfiguration(options.overrideJSChartConfiguration);
					}

					// add the chart
					myself.chartObject.render(myself.htmlObject);
					$("#"+options.htmlObject).find("embed").attr("wmode","transparent");

					// set the back button
					if(myself.backButton) {
						var div=$('<div class="ui-state-default ui-corner-all" title="" style="position: absolute;"><span class="ui-icon ui-icon-arrowreturnthick-1-w"></span></div>');
						div.css("left",Number(myself.chartDefinition.width));
						$("#"+myself.htmlObject).prepend(div);
						div.click(myself.backButtonCallBack);
					}

					// add div with warning
					if(hasWarning){
					$("#"+myself.htmlObject).append(
							"<div class=\"ui-state-highlight ui-corner-all\" style=\"padding: 0 .7em;\">"+
							"<p style=\"margin: 0 0 .3em;\">"+
							"<span class=\"ui-icon ui-icon-alert\" style=\"float: left; margin-right: 3em;\"></span>"+
							"<strong>Warning:</strong>"+
							warning+
							"</p></div>");
					}

					//on Dashboard EE??
					try{
						if(PentahoDashboardController!=undefined)
							myself.chartObject=undefined;
					}
					catch(e)
					{
						myself.chartObject=undefined;
					}

				} else {
					// just a quick update
					myself.chartObject.setDataXML(resultXml);
				}
			}
		},

		getOptions: function(){

			var options = {};

			if(typeof this.action !== 'undefined'){
				options.solution = this.solution;
				options.path = this.path;
				options.name = this.action;
			} else if(typeof this.xFusionPath !== "undefined"){
				options.xFusionPath = this.xFusionPath;
			}

			// process parameters and build the cdaParameters string
			if(typeof this.parameters !== "undefined") {
				options["cdaParameters"] = "";
				var isFirst = true;

				$.map(this.parameters,function(k){
					options[k[0]] = k.length==3?k[2]: Dashboards.getParameterValue(k[1]);

					//update the cdaParameters string
					isFirst? isFirst=false: options["cdaParameters"] += ";";
					options["cdaParameters"] += k[0];
				});
			}

			// get all chart properties definition
			var cd = this.chartDefinition;
			for(key in cd){
				var value = typeof cd[key]=='function'?cd[key](): cd[key];
				//tranform the boolean values into FCharts  boolean style 1/0
				if(typeof(value)=="boolean")
				{
					options[key] = value?'1':'0';
				}
				else
					if(typeof(value)=="string")
					{
						//encode values
						options[key] = encodeURIComponent(value);
					}
					else //tranform all the arrays with the exception of rangeValues element
						if(value instanceof Array&&key!="rangeValues")
						{
							if(value.length>0)
								options[key] =  value.toString().replace(/,/gi,';');
						}
						else
						{
							options[key] = value;
						}
			}

			// TODO colocar aqui logica para permitir alterar entre os varios
			// tipos de operacoes
			// sem ter que saber parametros (edit, command)
			options["command"] == undefined? options["command"] = "open": false;
			options["pathMode"] == undefined? options["pathMode"] = "legacy": false;

			// default options
			options["chartXML"] = true;
			options["dashboard-mode"] = true;


			//transform the array of range values into a JSON object
			var cols='{"cols":[{"id":"[MEASURE:0]","label":"Start","type":"number"}';
			var rows='"rows":[{"c":[{"f":"0","v":0}';
			if(options.rangeValues!=undefined)
			{
				if( options.rangeValues instanceof Array)
				{

					for (var i=0;i<options.rangeValues.length;++i)
					{
						cols+=',{"id":"[MEASURE:'+i+']","label":"Range'+i+'","type":"number"}';
						rows+=',{"f":"'+options.rangeValues[i]+'","v":'+options.rangeValues[i]+'}';
					}
					cols+='],';
					rows+=']}]}';

					options.range=cols+rows;
				}

			}


			return options;
		},

		getGUID : function(){
			if(this.GUID == null){
				this.GUID = WidgetHelper.generateGUID();
			}
			return this.GUID;
		}
	});

	/**
	 *
	 * This CDF component renders Fusion Charts Widget in Pentaho Dashboard E E
	 *
	 */

	XDashFusionChartComponent.newInstance = function(prptref, localizedFileName) {

		var widget = new XDashFusionChartComponent();
		widget.executeAtStart= true;
		widget.localizedName = localizedFileName;
		widget.GUID = WidgetHelper.generateGUID();
		widget.parameters = [];
		widget.outputParameters = [];


		//check platform version
		if(XDashFusionChartComponent.pentahoVersion==undefined)
		{
			var url = webAppPath + '/plugin/fusion_plugin/api/checkVersions';
			var myself=this;
			// get the xml chart
			var result=$.ajax({url: url, async: false, type: 'GET'}).responseText;
			eval(result);
		}
		// correct the Index for pentaho version greater than 3.10
		var indexCorrection=1;
		if(XDashFusionChartComponent.pentahoVersion.MajorVersion>3||XDashFusionChartComponent.pentahoVersion.MajorVersion==3&&XDashFusionChartComponent.pentahoVersion.MinorVersion>10)
		{
			indexCorrection=0;
		}

		var selectedWidgetIndex = pentahoDashboardController.getSelectedWidget() + indexCorrection; // add one to convert to 1-based
		widget.name = 'widget' + selectedWidgetIndex;
		widget.htmlObject = 'content-area-Panel_' + selectedWidgetIndex;
		var vals = XActionHelper.parseXaction(prptref);
		widget.staticParameters=true;
		widget.xactionPath = prptref;
		widget.solution = vals[0];
		widget.path = vals[1];
		widget.action = vals[2];
		currentWidget = widget;
		var details = XActionHelper.genXaction(widget.solution, widget.path, widget.action);
		PropertiesPanelHelper.initPropertiesPanel(details);
	}

//	now load the fusion js file

	var fileref=document.createElement('script');
	fileref.setAttribute("type","text/javascript");
	fileref.setAttribute("src", webAppPath+'/content/xfusion/JSClass/FusionCharts.js');
	if (typeof fileref!="undefined") document.getElementsByTagName("head")[0].appendChild(fileref);

	if(typeof(PentahoDashboardController) != "undefined")
	{
		PentahoDashboardController.registerComponentForFileType("xfusion", XDashFusionChartComponent);
	}
};

//try the delay way to be used inside pentaho dashboards EE
//if not inside PDEE run the function

if(typeof(delayedFunctions)!= "undefined")
{
	delayedFunctions.push(xLoadFunct);
}
else
{
	xLoadFunct();
}

/**
 *
 * This CDF component renders the chart client-side assincronously
 *
 */

var XDashFusionChartComponentAsync = UnmanagedComponent.extend({
	 update: function() {
		var render = _.bind(this.render, this);
		 this.triggerQuery(this.chartDefinition, render);
	 },

	 render: function(values) {
		 var myself = this;
		 var cd = myself.chartDefinition;
		 //validate fusion plugin key
		 var urlApi = webAppPath + '/plugin/fusion_plugin/api/verifyKey';
		 var fusionkey = $.ajax({type: 'GET', url: urlApi, async: false, error: function(xhr, textStatus, error){alert("Error while validating your key. Make sure your key is valid")}}).responseText;
		 // error validating key
		 if(fusionkey.match("<html >")){
			 $("#"+myself.htmlObject).html(fusionkey);
			 return;
		 }
		 // error key expired
		 fusionkey = fusionkey.split("-", 2);
		 if(fusionkey[0].match("Error")){
         	fusionkey[0] = fusionkey[0].replace("Error:"," ");
         	$("#"+myself.htmlObject).html("<div class=\"alert alert-danger\"><strong>Error!</strong>"+fusionkey[0]+"</div>");
         	return;
         }
		 // Error fusion XT not installed
		 if (fusionkey[1].match("true")) {
		    $("#"+myself.htmlObject).html("<div class=\"alert alert-danger\">You need to install FusionCharts XT to render the chart</div>");
			return;
		 }
		 if (!_.has(cd, 'chartType')){
			 // display missing options error
			 $("#"+myself.htmlObject).html("<div class=\"alert alert-info\">Missing Chart Type (chartType)</div>");
			 return;
		 }
		 if (!_.has(myself, 'htmlObject')){
			 // display missing options error
			 $("#"+myself.htmlObject).html("<div class=\"alert alert-info\">Missing HTML Object ID (htmlObject)</div>");
			 return;
		 }

		 //apply default value to width if not defined
		 if(!_.has(cd, 'width')){
			 cd.width = 500;
		 }
		 //apply default value to height if not defined
		 if(!_.has(cd, 'height')){
			 cd.height = 300;
		 }

		 //Fix CDE properties
		 cd = chartDefinitionCDEproperties(myself,cd,'chartProperties','chartScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'dataSetProperties','dataSetScriptProperties',[['datasetColor','color']]);
		 cd = chartDefinitionCDEproperties(myself,cd,'connectorsProperties','connectorsScriptProperties',[['connectorColor','color']]);
		 cd = chartDefinitionCDEproperties(myself,cd,'trendlinesProperties','trendlinesScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'vtrendlinesProperties','vtrendlinesScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'labelsProperties','labelsScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'categoriesProperties','categoriesScriptProperties',[['categoriesPath','path'],['categoriesDataAccessId','dataAccessId']]);
		 cd = chartDefinitionCDEproperties(myself,cd,'linesetProperties','linesetScriptProperties',[['linesetPath','path'],['linesetDataAccessId','dataAccessId']]);
		 cd = chartDefinitionCDEproperties(myself,cd,'colorRangeProperties','colorRangeScriptProperties',[['colorRangePath','path'],['colorRangeDataAccessId','dataAccessId']]);
		 cd = chartDefinitionCDEproperties(myself,cd,'trendPointProperties','trendPointScriptProperties',[['trendPointPath','path'],['trendPointDataAccessId','dataAccessId']]);

		 //CDE Gant Properties
		 cd = chartDefinitionCDEproperties(myself,cd,'tasksProperties','tasksScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'processesProperties','processesScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'datatableProperties','datatableScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'milestonesProperties','milestonesScriptProperties');
		 cd = chartDefinitionCDEproperties(myself,cd,'legendProperties','legendScriptProperties');

		 // Creating chart basic options
		 var fusionOptions = {
			 "type": cd.chartType,
			 "renderAt": myself.htmlObject,
			 "width": cd.width,
			 "height": cd.height,
			 "dataFormat": "json"
		 };

		 // verify if chartProperties exists
		 if(!_.has(cd,'chartProperties')){
			 cd.chartProperties = {};
		 }

		 //allow chartProperties functions
		 $.map(cd.chartProperties,function(v,k){return typeof cd.chartProperties[k]=="function"?cd.chartProperties[k]=cd.chartProperties[k]():cd.chartProperties[k]=v});

		 // implementation of charts
		 switch (fusionOptions.type.toLowerCase()) {
			 case "dragnode":
			 	//error missing connectorsDataAccessId
				if (!_.has(cd,'connectorsDataAccessId')){
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Property!</strong> Connectors Data Access ID</div>");
					return;
				}
				//error missing connectors properties
				if(!_.has(cd, 'connectorsProperties')){
					$("#"+myself.htmlObject).html("<div class=\"alert alert-danger\"><strong>Error!</strong>Missing connectorsProperties</div>");
					return;
				}

				// build the parameters for the dataSet
				var queryDataset = buildData(values);

				//build the parameters for the connectors
				if(_.has(cd,'connectorsPath')){
					var queryResult = doCDAQuery(cd.connectorsPath,cd.connectorsDataAccessId,myself.parameters);
				}else{
					var queryResult = doCDAQuery(cd.path,cd.connectorsDataAccessId,myself.parameters);
				}
				var resultset = JSON.parse(queryResult);
				var queryConnectors = buildData(resultset);

				//verify if dataSetProperties exists
				if(!_.has(cd,'dataSetProperties')){
					cd.dataSetProperties = {};
				}
				//apply node callback function
				if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};

				//verify if dataSetProperties exists
				if(!_.has(cd,'connectorsProperties')){
					cd.connectorsProperties = {};
				}
				//apply connectors callback function
				if(_.has(cd.connectorsProperties, 'connectorCallback')){queryConnectors = applyCallBack(queryConnectors,cd.connectorsProperties.connectorCallback);};

				//verify if dataset has required properties
				var hasProperties = hasRequiredProperties(queryDataset,['x','y','id']);

				if(!hasProperties[0]){
					hasProperties[1] = "Nodes are "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties!</strong>"+hasProperties[1]+"</div>");
					return;
				}

			 	//verify if connectors have required parameters
				hasProperties = hasRequiredProperties(queryConnectors,['from','to']);
				if(!hasProperties[0]){
					hasProperties[1] = "Connectors are "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties!</strong>"+hasProperties[1]+"</div>");
					return;
				}

				// add nodes data to dataset
				cd.dataSetProperties.data = queryDataset;
				// add connectors data to connectors properties
				cd.connectorsProperties.connector = queryConnectors;
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dataset": [cd.dataSetProperties],
					"connectors":[cd.connectorsProperties]
				};
		 		break;
			 // Single Series Charts
			 case "column2d":
			 case "column3d":
			 case "line":
			 case "area2d":
			 case "bar2d":
			 case "bar3d":
			 case "pie2d":
			 case "pie3d":
			 case "doughnut2d":
			 case "doughnut3d":
			 case "pareto2d":
			 case "pareto3d":
			 //Others (Widgets)
			 case "funnel":
			 case "pyramid":
			 //Spline Charts
			 case "spline":
			 case "splinearea":
			 //Miscellaneous Power Charts
			 case "waterfall2d":
			 case "kagi":
			  // build data
				var queryDataset = buildData(values);
				// apply callback
				if(_.has(cd,'dataSetProperties')){
					if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
				}
				//verify properties
				var hasProperties = hasRequiredProperties(queryDataset,['value']);
				if(!hasProperties[0]){
					hasProperties[1] = "Data is "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties!</strong>"+hasProperties[1]+"</div>");
					return;
				};
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"data": queryDataset
				};
				break;
			 // Multi Series Charts
			 case "mscolumn2d":
			 case "mscolumn3d":
			 case "msline":
			 case "msbar2d":
			 case "msbar3d":
			 case "msarea":
			 case "marimekko":
			 case "zoomline":
			 case "zoomlinedy":
			 // Stacked Charts
			 case "stackedcolumn2d":
			 case "stackedcolumn3d":
			 case "stackedbar2d":
			 case "stackedbar3d":
			 case "stackedarea2d":
			 //XY Plot Charts
			 case "scatter":
			 case "zoomscatter":
			 case "bubble":
			 //Scroll Charts
			 case "scrollstackedcolumn2d":
			 //RealTimeCharts
			 case "realtimearea":
			 case "realtimecolumn":
			 case "realtimeline":
			 case "realtimestackedarea":
			 case "realtimestackedcolumn":
			 case "realtimelinedy":
			 //Logarithmic Charts
			 case "logmscolumn2d":
			 case "logmsline":
			 //Spline Charts
			 case "msspline":
			 case "mssplinearea":
			 //Error Charts
			 case "errorbar2d":
			 case "errorline":
			 case "errorscatter":
			 //Inverse Y Axis Chart
			 case "inversemsarea":
			 case "inversemscolumn2d":
			 case "inversemsline":
			 //Miscellaneous Power Charts
			 case "selectscatter":
				// build dataset
				var queryDataset = buildGroupedData(values,'seriesname','data');
				//apply callback
				if(_.has(cd,'dataSetProperties')){
						if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
						if(_.has(cd.dataSetProperties, 'dataCallback')){queryDataset = applyGroupedCallBack(queryDataset,cd.dataSetProperties.dataCallback,'seriesname','data');};
				}

				// Verify required properties
				var hasProperties = hasRequiredProperties(queryDataset,['seriesname']);
				if(!hasProperties[0]){
					hasProperties[1] = "Data is "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties!</strong>"+hasProperties[1]+"</div>");
					return;
				};
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dataset": queryDataset
				};
				break;
				//Special Cases Charts
			 case "msstackedcolumn2d":
			 case "msstackedcolumn2dlinedy":
			 	// chart requires a array of objects (datasets)
			 	var dataset = [];
			 	// build the first dataset
			 	var queryDataset = buildGroupedData(values,'seriesname','data');
				//apply callback
				if(_.has(cd,'dataSetProperties')){
						if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
						if(_.has(cd.dataSetProperties, 'dataCallback')){queryDataset = applyGroupedCallBack(queryDataset,cd.dataSetProperties.dataCallback,'seriesname','data');};
				}
				// Verify required properties
				var hasProperties = hasRequiredProperties(queryDataset,['seriesname']);
				if(!hasProperties[0]){
					hasProperties[1] = "Data is "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties!</strong>"+hasProperties[1]+"</div>");
					return;
				};
				dataset.push({dataset:queryDataset});

				//build the other datasets
				for (var i = 0; i < cd.cdaArray.length; i++) {
					var responseText = doCDAQuery(cd.cdaArray[i].path,cd.cdaArray[i].dataAccessId,myself.parameters);
 				 	var resultset = JSON.parse(responseText);
					queryDataset = buildGroupedData(resultset,'seriesname','data');
					//apply callback
					if(_.has(cd,'dataSetProperties')){
							if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
							if(_.has(cd.dataSetProperties, 'dataCallback')){queryDataset = applyGroupedCallBack(queryDataset,cd.dataSetProperties.dataCallback,'seriesname','data');};
					}
					// Verify required properties
					var hasProperties = hasRequiredProperties(queryDataset,['seriesname']);
					if(!hasProperties[0]){
						hasProperties[1] = "Data is "+ hasProperties[1];
						$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
						return;
					};
					dataset.push({dataset:queryDataset});
				}
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dataset": dataset
				};
				break;
			//Combination Charts
			case "mscombi2d":
			case "mscombi3d":
			case "mscolumnline3d":
			case "stackedcolumn2dline":
			case "stackedcolumn3dline":
			case "mscombidy2d":
			case "mscolumn3dlinedy":
			case "stackedcolumn3dlinedy":
			//Scroll Charts
			case "scrollcombi2d":
			case "scrollcombidy2d":
			//Drag-able Charts
			case "dragcolumn2d":
			case "dragline":
			case "dragarea":
			//Miscellaneous Power Charts
			case "radar":
			case "msstepline":
				// build data
				var queryDataset = buildGroupedColumnData(values,'seriesname','data','value');
				//apply callback
				if(_.has(cd,'dataSetProperties')){
						if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
						if(_.has(cd.dataSetProperties, 'dataCallback')){queryDataset = applyGroupedCallBack(queryDataset,cd.dataSetProperties.dataCallback,'seriesname','data');};
				}
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dataset": queryDataset
				};
				break;
			//Scroll Charts
			case "scrollcolumn2d":
			case "scrollline2d":
			case "scrollarea2d":
			//Spark charts
			case "sparkline":
			case "sparkcolumn":
			case "sparkwinloss":
				// build data
				var queryDataset = buildData(values);
				//verify datasetproperties
				if(!_.has(cd,'dataSetProperties')){
					cd.dataSetProperties = {};
				}
				//apply callback
				if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};

				cd.dataSetProperties.data = queryDataset;
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dataset": [cd.dataSetProperties],
				};
				break;
			//Gauge
			case "angulargauge":
				// build data
				var queryDataset = buildData(values);
				//apply callback
				if(_.has(cd, 'dataSetProperties')){
					if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
				};
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"dials":{"dial":queryDataset}
				};
				break;
			//Gauge
			case "bulb":
			case "cylinder":
			case "hled":
			case "thermometer":
			case "vled":
			//Bullet Graphs
			case "hbullet":
			case "vbullet":
				// build data
				var queryDataset = buildData(values);
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
				};
				//add to chart data properties like value and target
				for(var key in queryDataset[0]){
					data[key] = queryDataset[0][key];
				}
				break;
			//Gauge
			case "hlineargauge":
				// build data
				var queryDataset = buildData(values);
				//apply callback
				if(_.has(cd, 'dataSetProperties')){
					if(_.has(cd.dataSetProperties, 'dataSetCallback')){queryDataset = applyCallBack(queryDataset,cd.dataSetProperties.dataSetCallback);};
				};
				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"pointers":{"pointer":queryDataset}
				};
				break;
			case "gantt":

				// verify Properties
				if(!_.has(cd,'processesProperties')){cd.processesProperties = {}};
				if(!_.has(cd,'datatableProperties')){cd.datatableProperties = {}};
				if(!_.has(cd,'tasksProperties')){cd.tasksProperties = {}};
				if(!_.has(cd,'milestonesProperties')){cd.milestonesProperties = {}};
				if(!_.has(cd,'connectorsProperties')){cd.connectorsProperties = {}};

				//Tasks
				//get Chart Data
				var tasksData = buildData(values);
				// apply Callback
				if(_.has(cd.tasksProperties,'taskCallback')){tasksData = applyCallBack(tasksData,cd.tasksProperties.taskCallback);};
				//Verify Required Properties
				hasProperties = hasRequiredProperties(tasksData,['processid','id','start','end']);
				if(!hasProperties[0]){
					hasProperties[1] = "Tasks are "+ hasProperties[1];
					$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
					return;
				};
				//apply Properties
				cd.tasksProperties.task = tasksData;

				//Processes
				if(_.has(cd,'processesPath') && _.has(cd,'processesDataAccessId')){
					// get Chart data
					var responseText = doCDAQuery(cd.processesPath,cd.processesDataAccessId,myself.parameters);
					responseText = JSON.parse(responseText);
					var processesData = buildData(responseText);
					//apply Callback
					if(_.has(cd.processesProperties,'processCallback')){processesData = applyCallBack(processesData,cd.processesProperties.processCallback);};
					//verify requiredProperties
					var hasProperties = hasRequiredProperties(processesData,['id','label']);
					if(!hasProperties[0]){
						hasProperties[1] = "Processes are "+ hasProperties[1];
						$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
						return;
					};
					//apply Properties
					cd.processesProperties.process = processesData;
				}

				//Datatable
				if(_.has(cd,'datatablePath') && _.has(cd,'datatableDataAccessId')){
					// get Chart data
					responseText = doCDAQuery(cd.datatablePath,cd.datatableDataAccessId,myself.parameters);
					responseText = JSON.parse(responseText);
					var datatableData = buildGroupedColumnData(responseText,'headertext','text','label');
					//apply Callback
					if(_.has(cd.datatableProperties,'textCallback')){datatableData = applyGroupedCallBack(datatableData,cd.datatableProperties.textCallback,'headertext','text');};
					if(_.has(cd.datatableProperties,'datacolumnCallback')){datatableData = applyCallBack(datatableData,cd.datatableProperties.datacolumnCallback);};
					//verify requiredProperties
					hasProperties = hasRequiredProperties(datatableData,['label'],'text');
					if(!hasProperties[0]){
						hasProperties[1] = "DataTable is "+ hasProperties[1];
						$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
						return;
					};
					//apply Properties
					cd.datatableProperties.datacolumn = datatableData;
				}

				//Milestones
				if(_.has(cd,'milestonesPath') && _.has(cd,'milestonesDataAccessId')){
					// get Chart data
					responseText = doCDAQuery(cd.milestonesPath,cd.milestonesDataAccessId,myself.parameters);
					responseText = JSON.parse(responseText);
					var milestonesData = buildData(responseText);
					//apply Callback
					if(_.has(cd.milestonesProperties,'milestoneCallback')){milestonesData = applyCallBack(milestonesData,cd.milestonesProperties.milestoneCallback);};
					//verify requiredProperties
					hasProperties = hasRequiredProperties(milestonesData,['taskid','date']);
					if(!hasProperties[0]){
						hasProperties[1] = "Milestones are "+ hasProperties[1];
						$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
						return;
					};
					//apply Properties
					cd.milestonesProperties.milestone = milestonesData;
				}

				//Connectors
				if(_.has(cd,'connectorsPath') && _.has(cd,'connectorsDataAccessId')){
					// get Chart data
					responseText = doCDAQuery(cd.connectorsPath,cd.connectorsDataAccessId,myself.parameters);
					responseText = JSON.parse(responseText);
					var connectorsData = buildData(responseText);
					//apply Callback
					if(_.has(cd.connectorsProperties,'connectorCallback')){connectorsData = applyCallBack(connectorsData,cd.connectorsProperties.connectorCallback);};
					//verify requiredProperties
					hasProperties = hasRequiredProperties(connectorsData,['fromtaskid','totaskid']);
					if(!hasProperties[0]){
						hasProperties[1] = "Connectors are "+ hasProperties[1];
						$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Missing Properties! </strong>"+hasProperties[1]+"</div>");
						return;
					};
					//apply Properties
					cd.connectorsProperties.connector = connectorsData;
				}

				// create the chart data
				var data = {
					"chart": cd.chartProperties,
					"processes":cd.processesProperties,
					"datatable":cd.datatableProperties,
					"tasks":cd.tasksProperties,
					"milestones":cd.milestonesProperties,
					"connectors":[cd.connectorsProperties],
				};
				break;
		 	default:
				$("#"+myself.htmlObject).html("<div class=\"alert alert-info\"><strong>Chart Not Supported!</strong> This chart is not supported by the component</div>");
				return;

		 }

		 // add trend lines to chart
		 if(_.has(cd, 'trendlinesProperties')){
			 if(_.has(cd.trendlinesProperties, 'dataAccessId') && _.has(cd.trendlinesProperties, 'path')){
				 var responseText = doCDAQuery(cd.trendlinesProperties.path,cd.trendlinesProperties.dataAccessId,myself.parameters);
				 var resultset = JSON.parse(responseText);

				 resultset = buildData(resultset);
				 //apply trendlines callback function
				 if(_.has(cd.trendlinesProperties, 'lineCallback')){
					 resultset = applyCallBack(resultset, cd.trendlinesProperties.lineCallback);
				 };
				 // draw horizontal trendlines
				 data.trendlines = [{line: resultset}];
			 }else{
				 if(_.has(cd.trendlinesProperties, 'trendlines')){
					 data.trendlines = cd.trendlinesProperties.trendlines;
				 };
			 };
		 };

		 // add trend lines to chart
		 if(_.has(cd, 'vtrendlinesProperties')){
			 if(_.has(cd.vtrendlinesProperties, 'dataAccessId') && _.has(cd.vtrendlinesProperties, 'path')){
				 var responseText = doCDAQuery(cd.vtrendlinesProperties.path,cd.vtrendlinesProperties.dataAccessId,myself.parameters);
				 var resultset = JSON.parse(responseText);

				 resultset = buildData(resultset);
				 //apply trendlines callback function
				 if(_.has(cd.vtrendlinesProperties, 'vlineCallback')){
					 resultset = applyCallBack(resultset, cd.vtrendlinesProperties.vlineCallback);
				 };
				 // draw vertical trendlines
				 data.vtrendlines = [{line: resultset}];
			 }else{
				 if(_.has(cd.vtrendlinesProperties, 'vtrendlines')){
					 data.vtrendlines = cd.vtrendlinesProperties.vtrendlines;
				 };
			 };
		 };


		 // add labels to chart
		 if(_.has(cd, 'labelsProperties')){
			 if(_.has(cd.labelsProperties, 'dataAccessId') && _.has(cd.labelsProperties, 'path')){
				 var responseText = doCDAQuery(cd.labelsProperties.path,cd.labelsProperties.dataAccessId,myself.parameters);

				 var resultset = JSON.parse(responseText);

				 resultset = buildData(resultset);
				 //apply trendlines callback function
				 if(_.has(cd.labelsProperties, 'labelCallback')){
					 resultset = applyCallBack(resultset, cd.labelsProperties.labelCallback);
				 };
				 data.labels = {label: resultset};
			 }else{
				 if(_.has(cd.labelsProperties, 'labels')){
					 data.labels = cd.labelsProperties.labels;
				 };
			 };
		 };

		 // add categories to chart
		 if(_.has(cd, 'categoriesProperties')){
			 if(_.has(cd.categoriesProperties, 'dataAccessId') && _.has(cd.categoriesProperties, 'path')){
				 var responseText = doCDAQuery(cd.categoriesProperties.path,cd.categoriesProperties.dataAccessId,myself.parameters);

				 var resultset = JSON.parse(responseText);

				 //Evaluate chart type (Gantt or other)
				 if(fusionOptions.type.toLowerCase()==="gantt"){
					 resultset = buildGroupedData(resultset,'categoryName','category');
					 if(_.has(cd.categoriesProperties, 'categoriesCallback')){resultset = applyCallBack(resultset, cd.categoriesProperties.categoriesCallback);};
					 if(_.has(cd.categoriesProperties, 'categoryCallback')){resultset = applyGroupedCallBack(resultset, cd.categoriesProperties.categoryCallback,'categoryName','category');};
					 data.categories = resultset;
				 }else{
					  resultset = buildData(resultset);
						//apply trendlines callback function
	 				 	if(_.has(cd.categoriesProperties, 'categoryCallback')){resultset = applyCallBack(resultset, cd.categoriesProperties.categoryCallback);};
	 				 	data.categories = [cd.categoriesProperties];
	 				 	data.categories[0].category = resultset;
				 }
			 }else{
				 if(_.has(cd.categoriesProperties, 'categories')){
					 data.categories = cd.categoriesProperties.categories;
				 };
			 };
		 };

		 // add trendPoints to chart
		 if(_.has(cd, 'trendPointProperties')){
			 if(_.has(cd.trendPointProperties, 'dataAccessId') && _.has(cd.trendPointProperties, 'path')){
				 var responseText = doCDAQuery(cd.trendPointProperties.path,cd.trendPointProperties.dataAccessId,myself.parameters);

				 var resultset = JSON.parse(responseText);
				 resultset = buildData(resultset);
				 //apply trendlines callback function
				 if(_.has(cd.trendPointProperties, 'pointCallback')){
					 resultset = applyCallBack(resultset, cd.trendPointProperties.point);
				 };
				 data.trendpoints = [cd.trendPointProperties];
				 data.trendpoints[0].point = resultset;
			 }else{
				 if(_.has(cd.trendPointProperties, 'trendPoint')){
					 data.trendpoints = cd.trendPointProperties.trendPoint;
				 };
			 };
		 };

		 // add lineset to chart
		 if(_.has(cd, 'linesetProperties')){
			 if(_.has(cd.linesetProperties, 'dataAccessId') && _.has(cd.linesetProperties, 'path')){
				 var responseText = doCDAQuery(cd.linesetProperties.path,cd.linesetProperties.dataAccessId,myself.parameters);
				 var resultset = JSON.parse(responseText);
				 resultset = buildGroupedData(resultset,'seriesname','data');
				 if(_.has(cd.linesetProperties, 'linesetCallback')){resultset = applyCallBack(resultset,cd.linesetProperties.linesetCallback);};
				 if(_.has(cd.linesetProperties, 'linesetDataCallback')){resultset = applyGroupedCallBack(resultset,cd.linesetProperties.linesetDataCallback,'seriesname','data');};

				 data.lineset = resultset;
			 }
		 };

		 // add lineset to chart
		 if(_.has(cd, 'colorRangeProperties')){
			 if(_.has(cd.colorRangeProperties, 'dataAccessId') && _.has(cd.colorRangeProperties, 'path')){
				 var responseText = doCDAQuery(cd.colorRangeProperties.path,cd.colorRangeProperties.dataAccessId,myself.parameters);
				 var resultset = JSON.parse(responseText);
				 resultset = buildData(resultset);
				 if(_.has(cd.colorRangeProperties, 'colorCallback')){resultset = applyCallBack(resultset,cd.colorRangeProperties.colorCallback);};
				 data.colorrange = {color: resultset};
			 }else{
				 if(_.has(cd.colorRangeProperties, 'colorRange')){
					 data.colorrange = {color: cd.colorRangeProperties.colorRange};
				 };
			 }
		 };

		 // add lineset to chart
		 if(_.has(cd, 'legendProperties')){
			 if(_.has(cd.legendProperties, 'dataAccessId') && _.has(cd.legendProperties, 'path')){
				 var responseText = doCDAQuery(cd.legendProperties.path,cd.legendProperties.dataAccessId,myself.parameters);
				 var resultset = JSON.parse(responseText);
				 resultset = buildData(resultset);
				 cd.legendProperties.item = resultset;
				 data.legend = cd.legendProperties;
			 }else{
					data.legend = cd.legendProperties;
			 }
		 };

		 // create Fusion chart and render
		 if(myself.chartObject == undefined) {
			 myself.chartObject = new FusionCharts(fusionOptions);
			 myself.chartObject.setJSONData(data);
			 myself.chartObject.render();
		 } else {
			 myself.chartObject.setJSONData(data);
		 }

		 //Apply refresh to realtime chart
		 if(_.has(cd,'cdaRefreshInterval')){
			 setInterval(function(){
				 	var responseText = doCDAQuery(cd.path,cd.dataAccessId,myself.parameters);
 					var resultset = JSON.parse(responseText);
					var dataset = buildRealTimeData(resultset);
					myself.chartObject.feedData(dataset);
			 }, cd.cdaRefreshInterval*1000);
		 };
	 }
 });

/*
* This function fixes the CDE properties that should be inside de chartDefinition but are outside of it.
* Parameters: Chart, Chart Definition, Properties Name,(Optional) JavaScript Properties Name and properties that need the name changed
* Returns: Chart Definition
*/
 function chartDefinitionCDEproperties(chart, chartDefinition, properties, scriptproperties, changeproperties){
	 if(_.has(chart,properties)){
		 if(typeof scriptproperties === 'object'){changeproperties = scriptproperties; scriptproperties = undefined;}
		 if (typeof scriptproperties != 'undefined'){
			 if(_.has(chart[properties],scriptproperties)){
  			 $.extend(chart[properties],chart[properties][scriptproperties]);
  			 delete chart[properties][scriptproperties];
  		 }
		 }
		 //apparently CDE does not care for the output name we give him so some properties need to be fixed
		 if (typeof changeproperties != 'undefined'){
			 $.each(changeproperties, function(i, el){
				 if(_.has(chart[properties],el[0])){
					 chart[properties][el[1]] = chart[properties][el[0]]
				 }
			 });
		 }
		 chartDefinition[properties] = chart[properties];
	 }
	 return chartDefinition;
 };

 /*
 * Apply Functions to Data Set
 * Parameter: data, function
 * Output: New Data Set
 */
 function applyCallBack(dataset, _function){
	 dataset = dataset.map(function(i){
		 _function(i);
		 return i
	 });
	 return dataset;
 };

 /*
 * Apply Functions to Data Set with series
 * Parameter: data, function
 * Output: New Data Set
 */
 // function applySeriesCallBack(dataset, _function){
 // dataset = dataset.map(function(i){
 // 	i.data = i.data.map(function(j){
 // 		_function(i.seriesname,j);
 // 		return j;
 // 	});
 // 	return i
 // });
 // return dataset;
 // };

 /*
 * Apply Functions to Data Set grouped by property
 * Parameter: data, function, propertyname
 * Output: New Data Set
 */
 function applyGroupedCallBack(dataset, _function, propertyName, subGroupName){
	dataset = dataset.map(function(i){
		i[subGroupName] = i[subGroupName].map(function(j){
			_function(i[propertyName],j);
			return j;
		});
		return i
	});
	return dataset;
 };

 /*
 * Do CDA query with or without parameters
 */
 function doCDAQuery(cdaPath, cdaDataAcessId, parameters){
 	var prefix = 'param';
 	var queryData={};
 	if(typeof parameters != undefined){
 		for (var i = 0; i < _.size(parameters); i++) {
 			queryData[prefix.concat(parameters[i][0])]=parameters[i][1];
 		};
 	};
 	var responseText = $.ajax({type: 'GET', dataType: 'json',url: webAppPath + "/plugin/cda/api/doQuery?dataAccessId="+cdaDataAcessId+"&path="+cdaPath, data: queryData, async: false}).responseText;
	return responseText;
 };

 /*
 * Build the data for the chart
 */
 function buildData(queryData){
 	var cdacolumns = [];
 	for (var i = 0; i < queryData.metadata.length; i++) {
 		cdacolumns.push(queryData.metadata[i].colName);
 	}
 	return queryData.resultset.map(function(dt) {
 		var data ={};
 		for (var i = 0; i < cdacolumns.length; i++) {
 			data[cdacolumns[i]]=dt[i];
 		}
 		return data;
 	});
 };

 /*
 * Build the data for the chart with series
 */
 // function buildSeriesData(queryData){
 // 	var qData = [];
 // 	var cdacolumns = [];
 // 	var seriescolumn = 0;
 // 	for (var i = 0; i < queryData.metadata.length; i++) {
 // 		if(queryData.metadata[i].colName==="seriesname"){seriescolumn = i;}
 // 		cdacolumns.push(queryData.metadata[i].colName);
 // 	}
 //
 // 	for (var i = 0; i < queryData.resultset.length; i++) {
 // 		var data = {};
 // 		var row = queryData.resultset[i];
 // 		for (var j = 0; j < row.length; j++) {
 // 			if(j!=seriescolumn){data[cdacolumns[j]]=row[j]}
 // 		}
 // 		var serie_row = lookup_seriesname(row[seriescolumn],qData, 'seriesname');
 // 		if(serie_row===qData.length){
 // 			qData.push({'seriesname':row[seriescolumn],'data':[data]});
 // 		}else{
 // 			qData[serie_row].data.push(data);
 // 		}
 // 	}
 // 	return qData;
 // };

 /*
 * Build the data grouped by a property with the other values in the subgroup
 */
 function buildGroupedData(queryData, groupby, subgroup){
 	var qData = [];
 	var cdacolumns = [];
 	var seriescolumn = 0;
 	for (var i = 0; i < queryData.metadata.length; i++) {
 		if(queryData.metadata[i].colName===groupby){seriescolumn = i;}
 		cdacolumns.push(queryData.metadata[i].colName);
 	}

 	for (var i = 0; i < queryData.resultset.length; i++) {
 		var data = {};
 		var row = queryData.resultset[i];
 		for (var j = 0; j < row.length; j++) {
 			if(j!=seriescolumn){data[cdacolumns[j]]=row[j]}
 		}
 		var serie_row = lookup_seriesname(row[seriescolumn],qData, groupby);
 		if(serie_row===qData.length){
			var hash = {};
			hash[groupby] = row[seriescolumn];
			hash[subgroup] = [data];
 			qData.push(hash);
 		}else{
 			qData[serie_row][subgroup].push(data);
 		}
 	}
 	return qData;
 };

 /*
 * Build the data for the chart with series
 */
 // function buildSeriesColumnData(queryData){
 // 	var qData = [];
 // 	var cdacolumns = [];
 // 	for (var i = 0; i < queryData.metadata.length; i++) {
 // 	qData.push({seriesname: queryData.metadata[i].colName,data:[]});
 // 	}
 //
 // 	for (var i = 0; i < queryData.resultset.length; i++) {
 // 		var row = queryData.resultset[i];
 // 	for (var j = 0; j < row.length; j++) {
 // 		qData[j].data.push({value: row[j]});
 // 	}
 // 	}
 // 	return qData;
 // };

 /*
 * Build the data for the chart grouped by columns name
 */
 function buildGroupedColumnData(queryData,groupName,subGroupName,propertyName){
 	var qData = [];
 	var cdacolumns = [];
 	for (var i = 0; i < queryData.metadata.length; i++) {
		hash = {};
		hash[groupName] = queryData.metadata[i].colName;
		hash[subGroupName] = [];
		qData.push(hash);
 	}

 	for (var i = 0; i < queryData.resultset.length; i++) {
 		var row = queryData.resultset[i];
		for (var j = 0; j < row.length; j++) {
			hash = {};
			hash[propertyName] = row[j];
			qData[j][subGroupName].push(hash);
		}
 	}
 	return qData;
 };

 /*
 * Build the data to feed Realtime Charts
 */
 function buildRealTimeData(queryData){
 	var cols = [];
 	for (var i = 0; i < queryData.metadata.length; i++) {
		cols.push([queryData.metadata[i].colName,""]);
 	}
 	for (var i = 0; i < queryData.resultset.length; i++) {
 		var row = queryData.resultset[i];
		for (var j = 0; j < row.length; j++) {
			if(cols[j][0].match("label")){
				if(cols[j][1].length === 0){
					cols[j][1] = cols[j][1].concat(row[j] + "|");
				}
			}else{
				cols[j][1] = cols[j][1].concat(row[j] + "|");
			}
		}
 	}
	var qData ="";
	for (var i = 0; i < cols.length; i++) {
		qData = qData + "&"+cols[i][0]+"="+cols[i][1].substring(0, cols[i][1].length - 1);;
	}
 	return qData;
 };


 function lookup_seriesname( name , array, seriesname) {
 	for(var i = 0, len = array.length; i < len; i++) {
 			if( array[ i ][seriesname] === name )
 					return i;
 	};
 	return array.length;
};

/*
* Verify the parameters
*/
function hasRequiredProperties(queryDataset,properties,subProperty){
	if(subProperty != undefined){
		var arr = [];
		for (var i = 0; i < queryDataset.length; i++) {
			arr = arr.concat(queryDataset[i][subProperty]);
		}
		queryDataset = arr;
	}
	for (var i = 0; i < queryDataset.length; i++) {
		for (var j = 0; j < properties.length; j++) {
			if(!queryDataset[i].hasOwnProperty(properties[j])){
				return [false,"missing property '"+ properties[j]+"'"]
			};
		};
	};
	return [true,""];
};
