/**
 *
 * @param {Object} parentProcess process, subprocess, etc.
 * @param {Object} collab collaboration element of the bpmn file (if there is one)
 * @param {Array} diagrams layout information of the bpmn file
 * @returns
 */
function checkGuidelineCriteria(parentProcess, collab, diagrams) {
	const parentType = parentProcess.$type;
	const flowElems = parentProcess.flowElements
		? parentProcess.flowElements
		: [];

	const allMessageFlows = collab
		? collab.messageFlow
			? collab.messageFlow
			: []
		: [];

	const pools = collab ? (collab.participants ? collab.participants : []) : [];

	const laneSets = parentProcess.laneSets ? parentProcess.laneSets : [];

	const gateways = flowElems.filter((elem) => elem.$type.includes('Gateway'));

	// Benennung

	// Der Name eines Elements selbst, z.B. Nachrichtenevent, sollte nicht in der Bezeichnung vorkommen
	const englishBlacklist = ['Process', 'Pool', 'Lane', 'Artifact', 'Annotation', 'Gateway', 'Exclusive', 'Inclusive', 
		'Parallel', 'Event-Based', 'Data Object', 'Data Store', 'Activity', 'Task',  'Subprocess', 'Call Activity', 
		'Transaction', 'Event', 'Start', 'Intermediate', 'End', 'Boundary', 'Multiple', 'Flow',
	];
	const germanBlacklist = ['Prozess', 'Pool', 'Bahn', 'Artefakt', 'Annotation', 'Gateway', 'Exklusiv', 'Inklusiv', 
		'Parallel', 'Ereignisbasiert', 'Datenobjekt', 'Datenspeicher', 'Aktivität', 'Aufgabe', 'Teilprozess', 'Unterprozess',
		'Aufrufaktivität', 'Transaktion', 'Ereignis', 'Start', 'Zwischen', 'Ende',
	]; 
	const noLabelNames = flowElems.every((elem) => {
		const name = elem.name ? elem.name : '';
		return (
			!englishBlacklist.some((word) =>
				name.toLowerCase().includes(word.toLowerCase())
			) &&
			!germanBlacklist.some((word) =>
				name.toLowerCase().includes(word.toLowerCase())
			)
		);
	});

	// Artikel sollen in Bezeichnungen vermieden werden
	const englishArticles = ['the', 'a', 'an'];
	const germanArticles = ['der', 'die', 'das', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',];
	const noArticles = flowElems.every((elem) => {
		const nameArray = elem.name ? elem.name.split(' ') : [];
		const lowerCaseNameArray = nameArray.map((word) => word.toLowerCase());
		return (
			!englishArticles.some((word) => lowerCaseNameArray.includes(word)) &&
			!germanArticles.some((word) => lowerCaseNameArray.includes(word))
		);
	});

	// Alle Aufgaben sollen einen Namen haben
	const allTasksNamed = flowElems.every((elem) =>
		elem.$type.includes('Task') ? elem.name && elem.name.length > 0 : true
	);

	// Aufgaben sollen mit einer Nomen-Verb (Infinitiv) Kombination benannt werden (Sprache beachten) - schwierig

	// Joins sollen normalerweise (außer bei komplexen Gateways) unbenannt sein
	const unnamedJoins = gateways
		.filter(
			(gateway) =>
				gateway.incoming &&
				gateway.incoming.length > 1 &&
				gateway.outgoing &&
				gateway.outgoing.length == 1 &&
				!gateway.$type.includes('Complex')
		)
		.every((join) => !join.name || join.name.length == 0);

	// Splits (außer parallel/eventbasiert) sollen mit einer eindeutigen Frage benannt werden - nur Existenz des Fragezeichens wird geprüft
	const splitQuestions = gateways
		.filter(
			(gateway) =>
				gateway.outgoing &&
				gateway.outgoing.length > 1 &&
				!gateway.$type.includes('Parallel') &&
				!gateway.$type.includes('EventBased')
		)
		.every((split) =>
			split.name ? split.name.includes('?') && split.name.length > 1 : false
		);

	// Sequenzflüsse sollen nach entsprechenden Gateways mit eindeutigen Bedingungen disjunkt und erschöpfend bezeichnet werden - nur für ja/nein Fragen
	const correctYesNo = gateways
		.filter(
			(gateway) =>
				gateway.outgoing &&
				gateway.outgoing.length > 1 &&
				gateway.$type.includes('Exclusive')
		)
		.every((split) => {
			const conditions = split.outgoing.map(
				(out) =>
					out.name ? out.name.toLowerCase() : out.isDefault ? 'default' : '' //TODO - überprüfen
			);
			if (conditions.some((cond) => cond.length == 0)) {
				return false;
			}
			if (conditions.includes('yes')) {
				return (
					conditions.includes('no') &&
					(conditions.length == 2 ||
						(conditions.length == 3 && conditions.includes('default')))
				); //verbesserungsfähig
			} else if (conditions.includes('ja')) {
				return (
					conditions.includes('nein') &&
					(conditions.length == 2 ||
						(conditions.length == 3 && conditions.includes('default')))
				); //verbesserungsfähig
			} else if (conditions.includes('no') || conditions.includes('nein')) {
				return false;
			} else return true;
		});

	// Alle Events sollen benannt werden (Ausnahme für unbestimmte Start/Endevents - siehe GFW Paper)
	const noneTypeStartsEnds = flowElems.filter(
		(elem) =>
			elem.$type.includes('Start') ||
			(elem.$type.includes('End') &&
				(!elem.eventDefinitions || elem.eventDefinitions.length == 0))
	);
	const allEventsNamed = flowElems
		.filter(
			(elem) =>
				elem.$type.includes('Event') &&
				!noneTypeStartsEnds.includes(elem) &&
				!elem.$type.includes('Gateway')
		)
		.every((elem) => elem.name && elem.name.length > 0);

	// Alle Datenobjekte sollen benannt werden (ggf. mit [Zustand] siehe Spezifikation (42))
	const allDataObjectsNamed = flowElems.every((elem) =>
		elem.$type.includes('DataObject') ? elem.name && elem.name.length > 0 : true
	);

	// Pools und Lanes sollten immer einen Namen haben (ggf. Ausnahme, falls es nur eine einzige Lane gibt)
	const poolNames = pools.every((pool) =>
		pool.name ? pool.name.length > 0 : false
	);
	const laneNames = laneSets.every((laneSet) =>
		laneSet.lanes && laneSet.lanes.length > 1
			? laneSet.lanes.every((lane) =>
					lane.name ? lane.name.length > 0 : false
			  )
			: true
	);
	const poolsAndLanesNamed = poolNames && laneNames;

	// Für Poolnamen soll nicht der Prozessnamen verwendet werden, sondern der “Teilnehmer”/die Partei (ggf. Ausnahmen)
	const correctPoolNames = pools.every(
		(pool) =>
			pool.name
				? parentProcess.name
					? parentProcess.name.toLowerCase() != pool.name.toLowerCase()
					: true
				: false //TODO: should this be true or false?
	);

	// Layout

	// Es sollten horizontale Sequenzflüsse und vertikale Nachrichtenflüsse/Assoziationen verwendet werden (ggf. nur auf bestimmte Elemente bezogen)
	// 70% der Sequenzflüsse sollten horizontal sein/ 70% der Nachrichtenflüsse vertikal
	const seqFlowsHorizontal = flowElems
		.filter((elem) => elem.$type.includes('SequenceFlow'))
		.map((flow) =>
			diagrams.every((diagram) => {
				const diagramElems = diagram.plane.planeElement;
				if (!diagramElems) {
					return false;
				}
				const diagramFlow = diagramElems.find(
					(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == flow.id
				);
				if (
					!diagramFlow ||
					!diagramFlow.waypoint ||
					diagramFlow.waypoint.length < 2
				) {
					return false;
				}
				const waypoints = diagramFlow.waypoint;
				const noYChanges = waypoints.every((point) =>
					point.y && waypoints[0].y ? point.y == waypoints[0].y : false
				);
				return noYChanges;
			})
		);

	const messageFlowsVertical = allMessageFlows.map((msg) =>
		diagrams.every((diagram) => {
			const diagramElems = diagram.plane.planeElement;
			if (!diagramElems) {
				return false;
			}
			const diagramMsg = diagramElems.find(
				(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == msg.id
			);
			if (
				!diagramMsg ||
				!diagramMsg.waypoint ||
				diagramMsg.waypoint.length < 2
			) {
				return false;
			}
			const waypoints = diagramMsg.waypoint;
			const noXChanges = waypoints.every((point) =>
				point.x && waypoints[0].x ? point.x == waypoints[0].x : false
			);
			return noXChanges;
		})
	);

	const seventyPercentHorizontal =
		seqFlowsHorizontal.filter((horizontal) => horizontal == true).length >=
		0.7 * seqFlowsHorizontal.length;
	const seventyPercentVertical =
		messageFlowsVertical.filter((vertical) => vertical == true).length >=
		0.7 * messageFlowsVertical.length;

	const flowDirection = seventyPercentHorizontal && seventyPercentVertical;

	// Es sollte von links nach rechts (bzw. mit konsistenter Orientierung) modelliert werden (ggf. nur für bestimmte Elemente) -> konsistentes ein-/ausgehendes Verhalten von Sequenzflüssen
	// Entweder sollen alle Sequenzflüsse links in die Elemente eingehen und rechts herausgehen oder oben eingehen und unten herausgehen
	// Hinweis: Es wird die genaue Position bzw. Übereinstimmung der bounds/waypoint Kooridnaten geprüft, das ist ggf. aber zu genau?
	const modellingDirection = diagrams.every((diagram) => {
		const diagramElems = diagram.plane.planeElement;
		if (!diagramElems) {
			return false;
		}
		const relevantElemArray = [
			'Task',
			'Event',
			'SubProcess',
			'Activity',
			'Transaction',
		];
		const relevantElems = flowElems.filter((elem) =>
			relevantElemArray.some(
				(rel) => elem.$type.includes(rel) && !elem.$type.includes('Gateway')
			)
		);
		const orientation = relevantElems.map((elem) => {
			//find the respective diagram element
			const diagramElem = diagramElems.find(
				(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == elem.id
			);
			if (!diagramElem) {
				return false;
			}
			//note the left, right, top and bottom lines
			const bounds = {
				left: diagramElem.bounds.x,
				right: diagramElem.bounds.x + diagramElem.bounds.width,
				top: diagramElem.bounds.y,
				bottom: diagramElem.bounds.y + diagramElem.bounds.height,
			};
			//find the incoming and outgoing sequence flow diagram elements
			const diagramInFlows = elem.incoming
				? diagramElems.filter(
						(diElem) =>
							diElem.bpmnElement &&
							elem.incoming.some((inFlow) => inFlow.id == diElem.bpmnElement.id)
				  )
				: [];
			const diagramOutFlows = elem.outgoing
				? diagramElems.filter(
						(diElem) =>
							diElem.bpmnElement &&
							elem.outgoing.some(
								(outFlow) => outFlow.id == diElem.bpmnElement.id
							)
				  )
				: [];
			//note the waypoints of the sequence flows
			const inWaypoints =
				diagramInFlows.length > 0
					? diagramInFlows.map((flow) => flow.waypoint)
					: [];
			const outWaypoints =
				diagramOutFlows.length > 0
					? diagramOutFlows.map((flow) => flow.waypoint)
					: [];

			const horizontal =
				inWaypoints.every(
					//the incoming sequence flow waypoints should include a waypoint on the left line
					(waypoints) => waypoints.some((point) => point.x == bounds.left)
				) &&
				outWaypoints.every((waypoints) =>
					//the outgoing sequence flow waypoints should include a waypoint on the right line
					waypoints.some((point) => point.x == bounds.right)
				);
			const vertical =
				inWaypoints.every(
					//the incoming sequence flow waypoints should include a waypoint on the top line
					(waypoints) => waypoints.some((point) => point.y == bounds.top)
				) &&
				outWaypoints.every((waypoints) =>
					//the outgoing sequence flow waypoints should include a waypoint on the bottom line
					waypoints.some((point) => point.y == bounds.bottom)
				);

			return { horizontal: horizontal, vertical: vertical };
		});
		const consistentOrientation =
			orientation.every((orient) => orient.horizontal) ||
			orientation.every((orient) => orient.vertical);

		return consistentOrientation;
	});

	// Es sollten möglichst lineare Sequenz- und Nachrichtenflüsse verwendet werden
	const msgAndSeqFlows = flowElems
		.filter((elem) => elem.$type.includes('SequenceFlow'))
		.concat(allMessageFlows);
	const flowsLinear = msgAndSeqFlows.map((flow) =>
		diagrams.every((diagram) => {
			const diagramElems = diagram.plane.planeElement;
			if (!diagramElems) {
				return false;
			}
			const diagramFlow = diagramElems.find(
				(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == flow.id
			);
			if (
				!diagramFlow ||
				!diagramFlow.waypoint ||
				diagramFlow.waypoint.length < 2
			) {
				return false;
			}
			const waypoints = diagramFlow.waypoint;
			const noYChanges = waypoints.every((point) =>
				point.y && waypoints[0].y ? point.y == waypoints[0].y : false
			);
			const noXChanges = waypoints.every((point) =>
				point.x && waypoints[0].x ? point.x == waypoints[0].x : false
			);
			return noYChanges || noXChanges;
		})
	);

	const sixtyPercentLinear =
		flowsLinear.filter((linear) => linear == true).length >=
		0.6 * flowsLinear.length;

	// Überkreuzungen/Überlappungen sollten vermieden werden
	const noOverlaps = diagrams.every((diagram) => {
		const diagramElems = diagram.plane.planeElement;
		if (!diagramElems) {
			return false;
		}
		const shapesToCompare = diagramElems.filter(
			(elem) =>
				elem.$type.includes('Shape') &&
				elem.bpmnElement &&
				!elem.bpmnElement.$type.includes('Participant') &&
				!elem.bpmnElement.$type.includes('Lane')
		);
		const flowsToCompare = diagramElems.filter((elem) =>
			elem.$type.includes('Edge')
		);
		const shapesToConsider = shapesToCompare.filter(
			(shape) => shape.bpmnElement && !shape.isExpanded
		);
		return (
			// alle Shape Elemente (außer Pool oder Lane oder ausgeklappter Teilprozess) sollten sich nicht überlappen - näherungsweise mittels Ecken
			shapesToCompare.every((shape) => {
				if (!shape.bounds) {
					return false;
				}
				const shapeCorners = [
					{ x: shape.bounds.x, y: shape.bounds.y },
					{ x: shape.bounds.x + shape.bounds.width, y: shape.bounds.y },
					{ x: shape.bounds.x, y: shape.bounds.y + shape.bounds.height },
					{
						x: shape.bounds.x + shape.bounds.width,
						y: shape.bounds.y + shape.bounds.height,
					},
				];
				return shapeCorners.every((corner) =>
					shapesToConsider.every((otherShape) => {
						if (shape.id == otherShape.id) {
							return true;
						}
						if (!otherShape.bounds) {
							return false;
						}
						const cornerInside =
							corner.x > otherShape.bounds.x &&
							corner.x < otherShape.bounds.x + otherShape.bounds.width &&
							corner.y > otherShape.bounds.y &&
							corner.y < otherShape.bounds.y + otherShape.bounds.height;
						return !cornerInside;
					})
				);
			}) &&
			// die Sequenzflüsse sollten nicht in andere Elemente hineinragen - näherungsweise nur die Eck- und Endpunkte...
			flowsToCompare.every((flow) => {
				if (!flow.waypoint) {
					return false;
				}
				const flowPointCorners = flow.waypoint;
				return flowPointCorners.every((point) =>
					shapesToConsider.every((shape) => {
						if (!shape.bounds) {
							return false;
						}
						const pointInside =
							point.x > shape.bounds.x &&
							point.x < shape.bounds.x + shape.bounds.width &&
							point.y > shape.bounds.y &&
							point.y < shape.bounds.y + shape.bounds.height;
						return !pointInside;
					})
				);
			})
		);
	});

	// Modellierung

	// Es sollten immer Start- und Endevents genutzt werden
	const explicitStartAndEnd = parentType.includes('AdHoc')
		? true
		: flowElems.some((elem) => elem.$type.includes('Start')) &&
		  flowElems.some((elem) => elem.$type.includes('End'));

	// Es sollte optimalerweise ein Startevent verwendet werden
	const oneStart = parentType.includes('AdHoc')
		? true
		: flowElems.filter((elem) => elem.$type.includes('Start')).length == 1;

	// Es soll möglichst ein Event pro Start-/Endstatus verwendet werden (konsistente Verwendung)
	const startNames = flowElems
		.filter((elem) => elem.$type.includes('Start'))
		.map((elem) => (elem.name ? elem.name : ''));
	const uniqueStartNames = startNames ? [...new Set(startNames)] : [];

	const endNames = flowElems
		.filter((elem) => elem.$type.includes('End'))
		.map((elem) => (elem.name ? elem.name : ''));
	const uniqueEndNames = endNames ? [...new Set(endNames)] : [];

	const differentiatedStartsAndEnds =
		startNames.length == uniqueStartNames.length &&
		endNames.length == uniqueEndNames.length;

	// Zum Splitten und Joinen vom Fluss sollten immer explizit Gateways genutzt werden
	const explicitSplitsJoins = flowElems.every((elem) => {
		if (elem.$type.includes('Gateway') || elem.$type.includes('SequenceFlow')) {
			return true;
		} else {
			const inLength = elem.incoming ? elem.incoming.length : 0;
			const outLength = elem.outgoing ? elem.outgoing.length : 0;
			return inLength <= 1 && outLength <= 1;
		}
	});

	// Ein Gateway sollte nicht gleichzeitig zum Splitten und Mergen verwendet werden (kein Mixed Gateway)
	const noMixedGateways = gateways.every((gateway) => {
		const inLength = gateway.incoming ? gateway.incoming.length : 0;
		const outLength = gateway.outgoing ? gateway.outgoing.length : 0;
		return (inLength <= 1 && outLength > 1) || (inLength > 1 && outLength <= 1);
	});

	// Komplexe aufeinanderfolgende Gatewaykonstrukte sollten in Geschäftsregeln überführt werden - max. 2 Gateways hintereinander
	const noThreeConsecutiveGateways = !gateways.some((gateway) => {
		const twoConsecGateways = gateway.outgoing
			? gateway.outgoing
					.map((out) =>
						out.targetRef && out.targetRef.$type.includes('Gateway')
							? out.targetRef
							: null
					)
					.filter((elem) => elem)
			: [];
		if (twoConsecGateways.length == 0) {
			return false;
		} else
			return twoConsecGateways.some(
				(gateway) =>
					gateway.outgoing &&
					gateway.outgoing.some(
						(out) => out.targetRef && out.targetRef.$type.includes('Gateway')
					)
			);
	});

	/*const maxThreeConsecutiveGateways = !gateways.some((gateway) => {
		const twoConsecGateways = gateway.outgoing
			? gateway.outgoing
					.map((out) =>
						out.targetRef && out.targetRef.$type.includes('Gateway')
							? out.targetRef
							: null
					)
					.filter((elem) => elem)
			: [];
		if (twoConsecGateways.length == 0) {
			return false;
		} else
			return !twoConsecGateways.some((gw) => {
				const threeConsecGateways = gw.outgoing
					? gw.outgoing
							.map((out) =>
								out.targetRef && out.targetRef.$type.includes('Gateway')
									? out.targetRef
									: null
							)
							.filter((elem) => elem)
					: [];
				if (threeConsecGateways.length == 0) {
					return false;
				} else
					return threeConsecGateways.some(
						(g) =>
							g.outgoing &&
							g.outgoing.some(
								(out) =>
									out.targetRef && out.targetRef.$type.includes('Gateway')
							)
					);
			});
	});*/

	// Gateways sollten balanciert verwendet werden (Split und Join vom gleichen Typ, außer falls eventbasiert/komplex) - eher oberflächlich
	const splits = gateways.filter(
		(gateway) => gateway.outgoing && gateway.outgoing.length > 1
	);
	const joins = gateways.filter(
		(elem) => elem.incoming && elem.incoming.length > 1
	);
	const exclusiveSplits = splits.filter(
		// für eventbasierte Gateways gibt es auch instantiate und eventGatewayType -> vielleicht damit noch erweitern ?
		(split) =>
			split.$type.includes('Exclusive') || split.$type.includes('EventBased')
	);
	const exclusiveJoins = joins.filter((join) =>
		join.$type.includes('Exclusive')
	);
	const inclusiveSplits = splits.filter(
		// etwas ungenau, da hier alles zusammengefasst wird
		(split) =>
			split.$type.includes('Inclusive') ||
			split.$type.includes('Parallel') ||
			split.$type.includes('Complex')
	);
	const inclusiveJoins = joins.filter(
		// etwas ungenau, da hier alles zusammengefasst wird
		(join) =>
			join.$type.includes('Inclusive') ||
			join.$type.includes('Parallel') ||
			join.$type.includes('Complex')
	);

	const balancedGateways = noMixedGateways
		? exclusiveSplits.length == exclusiveJoins.length &&
		  inclusiveSplits.length == inclusiveJoins.length
		: false;

	// Gateways sollten nur sinnvoll verwendet werden, also für mehrere ein/ausgehende Flüsse
	const meaningfulGateways = gateways.every((gateway) => {
		const inLength = gateway.incoming ? gateway.incoming.length : 0;
		const outLength = gateway.outgoing ? gateway.outgoing.length : 0;
		return inLength > 1 || outLength > 1;
	});

	// Nach (hauptsächlich inklusiven) Gateways sollten Default Sequenzflüsse verwendet werden
	const defaultAfterIncl = gateways.every((gateway) =>
		gateway.$type.includes('Inclusive') && gateway.outgoing && gateway.outgoing.length > 1
			? gateway.outgoing.some((out) => out.isDefault)
			: true
	);

	// Loop-Aufgaben sollten mit ihrer Bedingung annotiert sein
	const annotatedLoops = flowElems
		.filter((elem) => elem.loopCharacteristics)
		.every((loop) => {
			const artifacts = parentProcess.artifacts ? parentProcess.artifacts : [];
			if (artifacts.length == 0) {
				return false;
			}
			const annotations = artifacts.filter((art) =>
				art.$type.includes('Annotation')
			);
			const associations = artifacts.filter((art) =>
				art.$type.includes('Association')
			);
			if (associations.length == 0 || annotations.length == 0) {
				return false;
			}
			return associations.some(
				(assoc) =>
					assoc.sourceRef &&
					loop.id == assoc.sourceRef.id &&
					assoc.targetRef &&
					annotations.some((ann) => ann.id == assoc.targetRef.id)
			);
		});

	// Aufgaben sollten Beschreibungen enthalten
	const taskDescriptions = flowElems.every((elem) =>
		elem.$type.includes('Task')
			? elem.documentation &&
			  elem.documentation.text &&
			  elem.documentation.text.length > 4
			: true
	);

	// Die Anzahl der Elemente sollte minimiert werden und x Elemente nicht überschreiten ->  40 Elemente
	const max40Elements = flowElems.length <= 40; //TODO: should this include sequence flows or not?

	// Es sollten Nachrichtenflüsse verwendet werden, insb. bei Nachrichtenevents und Sende/Empfangsaufgaben
	const sendingMessageElems = flowElems
		.filter(
			(elem) =>
				elem.$type.includes('SendTask') ||
				((elem.$type.includes('IntermediateThrow') ||
					elem.$type.includes('EndEvent')) &&
					elem.eventDefinitions &&
					elem.eventDefinitions.some((def) => def.$type.includes('Message')))
		)
		.every((elem) =>
			allMessageFlows.some(
				(msg) => msg.sourceRef && msg.sourceRef.id == elem.id
			)
		);

	const receivingMessageElems = flowElems
		.filter(
			(elem) =>
				elem.$type.includes('ReceiveTask') ||
				((elem.$type.includes('IntermediateCatch') ||
					elem.$type.includes('StartEvent')) &&
					elem.eventDefinitions &&
					elem.eventDefinitions.some((def) => def.$type.includes('Message')))
		)
		.every((elem) =>
			allMessageFlows.some(
				(msg) => msg.targetRef && msg.targetRef.id == elem.id
			)
		);

	const messageFlowUsage = sendingMessageElems && receivingMessageElems;

	// Die Anbindung von Datenobjekten sollte konsistent mit gerichteten Assoziationen erfolgen (mittels DataOjectReference)
	const directedDataConnections = flowElems
		.filter((elem) => elem.$type.includes('DataObjectRef'))
		.every((dataObject) => {
			flowElems.some(
				(elem) =>
					(elem.dataInputAssociations &&
						elem.dataInputAssociations.some(
							(assoc) =>
								assoc.targetRef &&
								assoc.targetRef.id == dataObject.id &&
								assoc.associationDirection &&
								assoc.associationDirection == 'One'
						)) ||
					(elem.dataOutputAssociations &&
						elem.dataOutputAssociations.some(
							(assoc) =>
								assoc.sourceRef &&
								assoc.sourceRef.id == dataObject.id &&
								assoc.associationDirection &&
								assoc.associationDirection == 'One'
						))
			);
		});

	// Es sollte keine redundanten Sequenzflüsse geben (nur ein Sequenzfluss zw. zwei Elementen)
	const sourceTargetCombos = flowElems
		.filter(
			(elem) =>
				elem.$type.includes('Sequence') && elem.sourceRef && elem.targetRef
		)
		.map((elem) => elem.sourceRef.id + elem.targetRef.id);
	const uniqueCombos = [...new Set(sourceTargetCombos)];
	const noRedundantFlows = sourceTargetCombos.length == uniqueCombos.length;

	// Teilprozess-Beziehungen sollten strikt hierarchisch sein und keine Loops enthalten - zu komplex

	return {
		noLabelNames: noLabelNames,
		noArticles: noArticles,
		allTasksNamed: allTasksNamed,
		unnamedJoins: unnamedJoins,
		splitQuestions: splitQuestions,
		correctYesNo: correctYesNo,
		allEventsNamed: allEventsNamed,
		allDataObjectsNamed: allDataObjectsNamed,
		explicitStartEnd: explicitStartAndEnd,
		oneStart: oneStart,
		diffStartsEnds: differentiatedStartsAndEnds,
		explicitSplitsJoins: explicitSplitsJoins,
		noMixedGateways: noMixedGateways,
		maxConsecGateways: noThreeConsecutiveGateways,
		balancedGateways: balancedGateways,
		meaningfulGateways: meaningfulGateways,
		defaultAfterIncl: defaultAfterIncl,
		annotatedLoops: annotatedLoops,
		taskDescriptions: taskDescriptions,
		max40Elements: max40Elements,
		messageFlowUsage: messageFlowUsage,
		noRedundantFlows: noRedundantFlows,
		poolsAndLanesNamed: poolsAndLanesNamed,
		correctPoolNames: correctPoolNames,
		flowDirection: flowDirection,
		modellingDirection: modellingDirection,
		linearFlows: sixtyPercentLinear,
		noOverlaps: noOverlaps,
		directedDataConnections: directedDataConnections,
	};
}

export default checkGuidelineCriteria;
