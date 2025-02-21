import { Client, logger, Variables } from 'camunda-external-task-client-js';
import BpmnModdle from 'bpmn-moddle';

// configuration for the Client:
//  - 'baseUrl': url to the Process Engine
//  - 'logger': utility to automatically log important events
//  - 'asyncResponseTimeout': long polling timeout (then a new request will be issued)
const config = {
	baseUrl: 'http://localhost:8080/engine-rest',
	use: logger,
	asyncResponseTimeout: 10000,
};

// create a Client instance with custom configuration
const client = new Client(config);

// susbscribe to the topic: 'xmlToJson'
client.subscribe('xmlToJson', async function ({ task, taskService }) {
	const moddle = new BpmnModdle();

	const xmlStr = task.variables.get('bpmnFile');

	try {
		var { rootElement } = await moddle.fromXML(xmlStr);
	} catch (e) {
		await taskService.handleBpmnError(task, "20000", "The provided model is not valid bpmn", 'nobpmn');
	}
	
	if (!(rootElement.rootElements)) {
		await taskService.handleBpmnError(task, "20000", "The provided model is not valid bpmn", 'nobpmn');
	}

	// Überführung in Normalform
	const elems = rootElement.rootElements
		.map((process) => {
			if ("participants" in process || "messageFlows" in process) {
					let messageFlows = ("messageFlows" in process) ? process.messageFlows.map(e => {
						return {id: e.id,
							type: e.$type,
							name: e.name ? e.name : null,
							predecessors: e.sourceRef ? [{id: e.sourceRef.id, preType: e.sourceRef.$type, preName: e.sourceRef.name}] : null,
							successors: e.targetRef ?  [{id: e.targetRef.id, sucType: e.targetRef.$type, sucName: e.targetRef.name}] : null
						}
					}) : [];
					let participants = ("participants" in process) ? process.participants.map(e => {
						return {id: e.id, 
								type: e.$type,
								name: e.name ? e.name : null, 
								predecessors: null,
								successors: null};
						}) : [];
					
					return participants.concat(messageFlows);
			} else if ("flowElements" in process) {
				const elements = process.flowElements
					.map((elem) => {
						const pres = elem.incoming
							? elem.incoming
									.map((inFlow) => {
										return {
											id: inFlow.sourceRef ? inFlow.sourceRef.id : null,
											preType: inFlow.sourceRef ? inFlow.sourceRef.$type : null,
											preName: inFlow.sourceRef ? inFlow.sourceRef.name : null,
										};
									})
									.flat()
							: null;
						const sucs = elem.outgoing
							? elem.outgoing
									.map((outFlow) => {
										return {
											id: outFlow.targetRef ? outFlow.targetRef.id : null,
											sucType: outFlow.targetRef ? outFlow.targetRef.$type : null,
											sucName: outFlow.targetRef ? outFlow.targetRef.name : null,
										};
									})
									.flat()
							: null;
						return {
							id: elem.id,
							type: elem.$type,
							name: elem.name ? elem.name : null,
							predecessors: pres,
							successors: sucs,
						};
					});
				if ("laneSets" in process) {
					const lanes = process.laneSets[0].lanes.map(lane => {
						// TODO: Lanes können beliebig tief verschachtelt werden
						if ("childLaneSet" in lane && Array.isArray(lane.childLaneSet)) {
							let parentLane = [{type: lane.$type, name: lane.name}];
							return parentLane.concat(lane.childLaneSet.lanes.map(childLane => {return {id: childLane.id, type: childLane.$type, name: childLane.name ? childLane.name : null, predecessors: null, successors: null}}));
						} else {
							return {id: lane.id, type: lane.$type, name: lane.name ? lane.name : null, predecessors: null, successors: null};
						}
						
					}).flat();
					return elements.concat(lanes);
				} else {
					return elements; //nested array for multiple processes
				}
			} else {
				// Fehlerhafter Prozess
				return [];
			}
		});

	// Sortiert das Array nach dem Namen
	const firstSorting = elems.map((processElems) => {
		processElems.sort((a,b) => (a.name && b.name) ? a.name.localeCompare(b.name) : 0);
		return processElems;
	});

	// Sortiert das Array nach dem Typ
	const sortedElementArrays = firstSorting.map((processElems) => {
		processElems.sort((a,b) => a.type.localeCompare(b.type));
		return processElems;
	});

	// Ersetzt die Vorgänger und Nachfolger mit der Id im Array
	let sortedElementArraysReplaced = sortedElementArrays.map(process => {
		return process.map(element => {
			if (element.predecessors) {
				// Nachrichtenflüsse haben Start und Ziel in verschiedenen Pools
				if (element.type == "bpmn:MessageFlow") {
					let index;
					let ValueFound = {};
					try {
						sortedElementArrays.forEach(process2 => {
							// Es wird hier angenommen, dass Nachrichtenflüsse nicht mehrere Quellelemente haben können
							let indexLocal = process2.findIndex(x => x.id == element.predecessors[0].id);
							if (indexLocal != -1) {
								index = indexLocal;
								throw ValueFound;
							}
						});
					} catch (e) {
						if (e != ValueFound) throw e;
					}
					element.predecessors = [index];
				} else {
					element.predecessors = 
						element.predecessors.map(e => {
							return process.findIndex(x => x.id == e.id);
						});
				}
			}
			if (element.successors) {
				if (element.type == "bpmn:MessageFlow") {
					let index;
					let ValueFound = {};
					try {
						sortedElementArrays.forEach(process2 => {
							// Es wird hier angenommen, dass Nachrichtenflüsse nicht mehrere Zielelemente haben können
							let indexLocal = process2.findIndex(x => x.id == element.successors[0].id);
							if (indexLocal != -1) {
								index = indexLocal;
								throw ValueFound;
							}
						});
					} catch(e) {
						if (e != ValueFound) throw e;
					}
					element.successors = [index];
				} else {
					element.successors = 
						element.successors.map(e => {
							return process.findIndex(x => x.id == e.id);
						});
				}
			}
			return element;
		});
	});

	// Sortiert jeweils die Vorgänger- und Nachfolgerliste für jedes Element (falls vorhanden)
	const sortedElementArraysReplacedSorted = sortedElementArraysReplaced.map((processElems) => {
		return processElems.map(e => {
			if (e.predecessors) {
				e.predecessors.sort((a,b) => a - b);
			}
			if (e.successors) {
				e.successors.sort((a,b) => a - b);
			}
			return e;
		});
	});

	// Löscht die Id der Elemente
	let sortedElementArraysWithoutId = sortedElementArraysReplacedSorted.map(process => process.map(element => { delete element.id; return element;}));

	// Fügt die Elemente zusammen zu einem String
	let normalform = sortedElementArraysWithoutId.map(process => {
		return process.map((element) => {
			return element.type.split(':')[1] + element.name + ((element.predecessors) ? element.predecessors.join('') : '') + ((element.successors) ? element.successors.join('') : '')
		}).join('');
	}).join('');
	

	const processVariables = new Variables();
	processVariables.set('jsonFile', rootElement);
	processVariables.set('normalform', normalform);

	// Complete the task
	await taskService.complete(task, processVariables);
});
