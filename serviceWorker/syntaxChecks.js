/**
 *
 * @param {Object} parentProcess process, subprocess, etc.
 * @param {Object} collab collaboration element of the bpmn file (if there is one)
 * @param {Array} diagrams layout information of the bpmn file
 * @returns
 */
function checkSyntaxCriteria(parentProcess, collab, diagrams) {
	const parentType = parentProcess.$type;

	const flowElems = parentProcess.flowElements
		? parentProcess.flowElements
		: []; //TODO

	const isEventSubProcess = parentProcess.triggeredByEvent
		? parentProcess.triggeredByEvent
		: false;

	const allMessageFlows = collab
		? collab.messageFlows
			? collab.messageFlows
			: []
		: [];

	// Startevents von Teilprozessen müssen unbestimmt sein
	const correctSubStarts = !flowElems.some(
		(elem) =>
			parentType.includes('bpmn:SubProcess') &&
			!isEventSubProcess &&
			elem.$type.includes('Start') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.length > 0
	);

	// Eventunterprozesse dürfen keinen eingehenden und ausgehenden Sequenzfluss haben
	const noEventSubFlows = !flowElems.some(
		(elem) =>
			(elem.$type.includes('SubProcess') &&
				elem.triggeredByEvent &&
				((elem.incoming && elem.incoming.length > 0) ||
					(elem.outgoing && elem.outgoing.length > 0))) ||
			(elem.$type.includes('SequenceFlow') &&
				((elem.sourceRef &&
					elem.sourceRef.$type.includes('SubProcess') &&
					elem.sourceRef.triggeredByEvent) ||
					(elem.targetRef &&
						elem.targetRef.$type.includes('SubProcess') &&
						elem.targetRef.triggeredByEvent)))
	);

	// Kompensationsaufgaben dürfen keinen eingehenden und ausgehenden Sequenzfluss haben
	const noCompensationTaskFlows = !flowElems.some(
		(elem) =>
			(elem.$type.includes('Task') &&
				elem.isForCompensation &&
				((elem.incoming && elem.incoming.length > 0) ||
					(elem.outgoing && elem.outgoing.length > 0))) ||
			(elem.$type.includes('SequenceFlow') &&
				((elem.sourceRef &&
					elem.sourceRef.$type.includes('Task') &&
					elem.sourceRef.isForCompensation) ||
					(elem.targetRef &&
						elem.targetRef.$type.includes('Task') &&
						elem.targetRef.isForCompensation)))
	);

	// Eine Aufgabe darf nicht gleichzeitig verschiedene Schleifentypen haben
	// -> scheint problematisch, da automatisch die letzte Option übernommen wird, wenn es mehrere gibt

	// Ein Eventunterprozess hat genau ein typisiertes Startevent
	const correctEventSubStarts = isEventSubProcess
		? flowElems.filter((elem) => elem.$type.includes('Start')).length == 1
		: true;

	// Ein Ad-hoc Unterprozess darf kein Start- oder Endevent haben
	const noAdHocStartEnd = parentType.includes('AdHoc')
		? !flowElems.some(
				(elem) => elem.$type.includes('Start') || elem.$type.includes('End')
		  )
		: true;

	// Ein Ad-hoc Unterprozess muss mindestens eine Aufgabe beinhalten
	const atLeastOneTask = flowElems.every((elem) =>
		elem.$type.includes('AdHoc')
			? elem.flowElements &&
			  elem.flowElements.some((elem) => elem.$type.includes('Task'))
			: true
	);

	// Es dürfen keine angehefteten auslösenden Events verwendet werden - keine ausgehenden Nachrichten und keine attachedToRef bei auslösenden Events
	const noBoundaryMessageSources = !flowElems.some(
		(elem) =>
			elem.$type.includes('Boundary') &&
			allMessageFlows.some(
				(msg) => msg.sourceRef && msg.sourceRef.id == elem.id
			)
	);
	const noAttachedIntermediateThrow = !flowElems.some(
		(elem) =>
			elem.$type.includes('Throw') &&
			elem.attachedToRef &&
			elem.attachedToRef.$type.includes('Task')
	);
	const noThrowingBoundaryEvents =
		noBoundaryMessageSources && noAttachedIntermediateThrow;

	// Es dürfen keine angehefteten unbestimmten Zwischenevents verwendet werden
	const noUndefinedBoundaryEvents = !flowElems.some(
		(elem) =>
			(elem.$type.includes('Boundary') &&
				(!elem.eventDefinitions || elem.eventDefinitions.length == 0)) ||
			(elem.$type.includes('Intermediate') &&
				(!elem.eventDefinitions || elem.eventDefinitions.length == 0) &&
				elem.attachedToRef)
	);

	// Es dürfen keine auslösenden Startevents verwendet werden (Startevents haben keinen ausgehenden Nachrichtenfluss)
	const noThrowingStartEvents = !flowElems.some(
		(elem) =>
			elem.$type.includes('Start') &&
			allMessageFlows.some(
				(msg) => 'sourceRef' in msg && msg.sourceRef.id == elem.id
			)
	);

	// Es dürfen keine eintretenden Endevents verwendet werden (Endevents haben keinen eingehenden Nachrichtenfluss)
	const noCatchingEndEvents = !flowElems.some(
		(elem) =>
			elem.$type.includes('End') &&
			allMessageFlows.some(
				(msg) => 'targetRef' in msg && msg.targetRef.id == elem.id
			)
	);

	// Boundary Events müssen mind. einen ausgehenden Sequenzfluss haben, keinen eingehenden
	const correctBoundaryFlows = flowElems.every(
		(elem) =>
			!elem.$type.includes('Boundary') ||
			(elem.$type.includes('Boundary') &&
				elem.outgoing &&
				elem.outgoing.length > 0 &&
				elem.incoming &&
				elem.incoming.length == 0)
	);

	// Abbruchendevents dürfen nur innerhalb von Transaktionen verwendet werden
	const correctCancelEndEvents = !flowElems.some(
		(elem) =>
			!parentType.includes('Transaction') &&
			elem.$type.includes('End') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Cancel'))
	);

	// Eintretende Abbruchzwischenevents dürfen nur als angeheftetes Event an Transaktionen verwendet werden
	const correctCancelIntermediateEvents = !flowElems.some(
		(elem) =>
			(elem.$type.includes('Intermediate') || elem.$type.includes('Boundary')) &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Cancel')) &&
			!(elem.attachedToRef && elem.attachedToRef.$type.includes('Transaction'))
	);

	// Kompensationsstartevents dürfen nur in Eventunterprozessen (nicht in top-level Prozessen) verwendet werden
	const correctCompensationStartEvents = !flowElems.some(
		(elem) =>
			!isEventSubProcess &&
			elem.$type.includes('Start') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Compensate'))
	);

	// Eintretende Kompensationszwischenevents dürfen nur als angeheftetes Event an einer Aufgabe verwendet werden
	const correctCompensationIntermediateEvents = !flowElems.some(
		(elem) =>
			!elem.$type.includes('Boundary') &&
			elem.$type.includes('Intermediate') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Compensate'))
	);

	// Wenn es ein Startevent gibt, muss es auch ein Endevent geben
	// Wenn es ein Endevent gibt, muss es auch ein Startevent geben
	const correctStartEndCombo =
		flowElems.some((elem) => elem.$type.includes('Start')) ==
		flowElems.some((elem) => elem.$type.includes('End'));

	// Startevents dürfen keinen eingehenden Sequenzfluss haben
	// Startevents müssen mindestens einen ausgehenden Sequenzfluss haben
	const correctStartEventFlows = !flowElems.some(
		(elem) =>
			elem.$type.includes('Start') &&
			((elem.incoming && elem.incoming.length > 0) ||
				!elem.outgoing ||
				elem.outgoing.length == 0)
	);

	// Endevents dürfen keinen ausgehenden Sequenzfluss haben
	// Endevents müssen mindestens einen eingehenden Sequenzfluss haben
	const correctEndEventFlows = !flowElems.some(
		(elem) =>
			elem.$type.includes('End') &&
			((elem.outgoing && elem.outgoing.length > 0) ||
				!elem.incoming ||
				elem.incoming.length == 0)
	);

	// Ein Linkevent darf nicht gleichzeitig einen eingehenden und ausgehenden Sequenzfluss haben
	const correctLinkEventFlows = !flowElems.some(
		(elem) =>
			(elem.$type.includes('Link') ||
				(elem.$type.includes('Event') &&
					elem.eventDefinitions &&
					elem.eventDefinitions.some((def) => def.$type.includes('Link')))) &&
			elem.incoming &&
			elem.incoming.length > 0 &&
			elem.outgoing &&
			elem.outgoing.length > 0
	);

	// Ein auslösendes Linkevent muss ein entsprechendes eintretendes Linkevent haben (mit gleichen Namen) (und andersrum)
	const throwLinks = flowElems.filter(
		(elem) =>
			elem.$type.includes('IntermediateThrow') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Link'))
	);

	const catchLinks = flowElems.filter(
		(elem) =>
			elem.$type.includes('IntermediateCatch') &&
			elem.eventDefinitions &&
			elem.eventDefinitions.some((def) => def.$type.includes('Link'))
	);

	const linkPairs =
		throwLinks.every(
			(throwLink) =>
				throwLink.eventDefinitions.some(
					(def) =>
						def.$type.includes('Link') &&
						def.target &&
						def.target.name &&
						def.target.name == def.name
				) || catchLinks.some((catchLink) => catchLink.name == throwLink.name)
		) &&
		catchLinks.every(
			(catchLink) =>
				catchLink.eventDefinitions.some(
					(def) =>
						def.$type.includes('Link') &&
						def.sources &&
						def.sources.every(
							(source) => source.name && source.name == def.name
						)
				) || throwLinks.some((throwLink) => catchLink.name == throwLink.name)
		);

	// Es darf nicht mehrere Ziel Linkevents für ein auslösendes Linkevent geben
	const singleTargetLinks = throwLinks.every((throwLink) => {
		const matches = catchLinks.filter(
			(catchLink) =>
				catchLink.eventDefinitions.some(
					(def) =>
						def.$type.includes('Link') &&
						def.sources &&
						def.sources.some((source) => source.id == throwLink.id)
				) || catchLink.name == throwLink.name
		);
		return matches.length == 1;
	});

	// Ein- und Ausgangsrichtung von Nachrichtenevents müssen zum Eventtypen passen
	const messageDirection = !allMessageFlows.some(
		(msg) =>
			'sourceRef' in msg &&
			'targetRef' in msg &&
			(msg.sourceRef.$type.includes('Receive') ||
				msg.targetRef.$type.includes('Send') ||
				msg.sourceRef.$type.includes('Catch') ||
				msg.targetRef.$type.includes('Throw'))
	);

	// Keine Nachrichtenflüsse von oder zu Gateways
	const noGatewayMessageFlows = !allMessageFlows.some(
		(msg) =>
			'sourceRef' in msg &&
			'targetRef' in msg &&
			(msg.sourceRef.$type.includes('Gateway') ||
				msg.targetRef.$type.includes('Gateway'))
	);

	// Wenn es ein Startevent gibt, muss ein Gateway einen eingehenden Sequenzfluss haben
	const correctGatewayIncomingFlow =
		flowElems.some((elem) => elem.$type.includes('Start')) &&
		flowElems.some((elem) => elem.$type.includes('Gateway'))
			? !flowElems.some(
					(elem) =>
						elem.$type.includes('Gateway') &&
						(!elem.incoming || (elem.incoming && elem.incoming.length == 0))
			  )
			: true;

	// Ein eventbasiertes Gateway muss mind. 2 ausgehende Sequenzflüsse haben
	const correctEventBasedGateway = !flowElems.some(
		(elem) =>
			elem.$type.includes('EventBasedGateway') &&
			(!elem.outgoing || (elem.outgoing && elem.outgoing.length < 2))
	);

	// Ausgehende Sequenzflüsse aus einem eventbasierten Gateway dürfen keine Bedingung haben
	const correctEventBasedFlows = !flowElems.some(
		(elem) =>
			elem.$type.includes('SequenceFlow') &&
			elem.sourceRef &&
			elem.sourceRef.$type.includes('EventBasedGateway') &&
			// Die ConditionExpression wird nur gesetzt, wenn Attribute hinterlegt sind
			(elem.conditionExpression || (elem.name && elem.name.length > 0))
	);

	// Nach einem eventbasierten Gateway dürfen nur empfangende Aufgaben oder Nachrichten-, Signal-, Zeit-, Bedingungs- oder Mehrfach-Zwischenevents sein
	const correctElemsAfterEventBased = !flowElems.some(
		(elem) =>
			elem.incoming &&
			elem.incoming.some(
				(flow) =>
					'sourceRef' in flow &&
					flow.sourceRef.$type.includes('EventBasedGateway')
			) &&
			!(
				elem.$type.includes('ReceiveTask') ||
				(elem.$type.includes('IntermediateCatch') &&
					elem.eventDefinitions &&
					elem.eventDefinitions.some(
						(def) =>
							def.$type.includes('Message') ||
							def.$type.includes('Signal') ||
							def.$type.includes('Timer') ||
							def.$type.includes('Conditional') ||
							def.$type.includes('Multiple')
					))
			)
	);

	// Elemente nach einem eventbasierten Gateway dürfen keinen weiteren eingehenden Sequenzfluss haben (nur den vom eventbasierten Gateway)
	const inFlowAfterEventBased = !flowElems.some(
		(elem) =>
			elem.incoming &&
			elem.incoming.some(
				(flow) =>
					flow.sourceRef && flow.sourceRef.$type.includes('EventBased')
			) &&
			elem.incoming.length > 1
	);

	// Empfangende Aufgaben nach einem eventbasierten Gateway dürfen keine angeheften Events haben
	const noBoundaryAfterEventBased = !flowElems.some(
		(elem) =>
			elem.$type.includes('EventBased') &&
			elem.outgoing &&
			elem.outgoing.some(
				(flow) =>
					flow.targetRef &&
					flow.targetRef.$type.includes('Task') &&
					((flow.targetRef.boundaryEventRefs &&
					flow.targetRef.boundaryEventRefs.length > 0) || 
					flowElems.some((elem) => elem.attachedToRef && elem.attachedToRef.id == flow.targetRef.id))
			)
	);

	// Wenn Nachrichtenzwischenevents nach einem eventbasierten Gateway verwendet werden, darf es keine empfangende Aufgaben geben und umgekehrt
	const noTaskAndMessageAfterEventBased = !flowElems.some(
		(elem) =>
			elem.$type.includes('EventBasedGateway') &&
			elem.outgoing &&
			elem.outgoing.some(
				(flow) =>
					'targetRef' in flow && flow.targetRef.$type.includes('ReceiveTask')
			) &&
			elem.outgoing.some(
				(flow) =>
					flow.targetRef.$type.includes('Intermediate') &&
					flow.targetRef.eventDefinitions &&
					flow.targetRef.eventDefinitions.some((def) =>
						def.$type.includes('Message')
					)
			)
	);

	// Layout-Info:
	// x/y beschreibt die obere linke Ecke des Elements relativ zur oberen linken Ecke des Diagramms
	// width/height beschreibt die Größe des Elements
	// waypoints sind die End- und Eckpunkte von Flüssen (Sequenzflüsse, Nachrichtenflüsse, etc.)
	const pools = collab ? (collab.participants ? collab.participants : []) : [];

	const laneSets = parentProcess.laneSets ? parentProcess.laneSets : [];

	// Hinweis: Es gibt hier fast immer noch Möglichkeiten, die Kriterien genauer/feingliedriger zu prüfen, allerdings mit erhöhtem Aufwand und höherer Komplexität

	// Flussobjekte (Aufgaben, Events, Gateways...) dürfen sich nur innerhalb von Pools befinden
	// wenn es einen Pool gibt, dann müssen alle Flusselemente innerhalb eines Pools sein
	// wenn es keinen Pool gibt -> Kriterium nicht verletzt (theoretisch existiert dann trotzdem ein Pool, aber nur imaginär...)
	const withinPools =
		pools.length > 0
			? diagrams.every((diagram) => {
					const diagramElems = diagram.plane.planeElement;
					if (!diagramElems) {
						return false;
					}
					const poolElems = diagramElems.filter((elem) =>
						pools.some(
							(pool) => elem.bpmnElement && elem.bpmnElement.id == pool.id
						)
					);
					const allPoolBounds = poolElems.map((pool) => pool.bounds);
					return (
						flowElems
							// Sequenzflüsse werden separat geprüft
							.filter((element) => !element.$type.includes('Flow'))
							.every((elem) => {
								const diagramElem = diagramElems.find(
									(diElem) =>
										diElem.bpmnElement && diElem.bpmnElement.id == elem.id
								);
								if (!diagramElem || !diagramElem.bounds) {
									return false;
								}
								const elemBounds = diagramElem.bounds;
								return allPoolBounds.some(
									(poolBounds) =>
										elemBounds.x > poolBounds.x &&
										elemBounds.y > poolBounds.y &&
										elemBounds.x + elemBounds.width <
											poolBounds.x + poolBounds.width &&
										elemBounds.y + elemBounds.height <
											poolBounds.y + poolBounds.height
								);
							})
					);
			  })
			: true;

	// Flussobjekte müssen eindeutig einer Lane zugeordnet sein (nicht mehreren)
	// wenn es Lanes gibt, dann darf ein Flusselement nur innerhalb einer Lane sein
	// Version mittels der Lane Layout Informationen im Diagramm
	const withinLaneBounds = diagrams.every((diagram) => {
		const diagramElems = diagram.plane.planeElement;
		if (!diagramElems) {
			return false;
		}
		const diagramLanes = diagramElems.filter(
			(elem) => elem.bpmnElement && elem.bpmnElement.$type.includes('Lane')
		);
		if (diagramLanes.length == 0) {
			return true;
		}
		const laneBounds = diagramLanes.map((lane) => lane.bounds);
		return flowElems.every((elem) => {
			if(elem.$type.includes('SequenceFlow')){
				return true;
			}
			const diagramElem = diagramElems.find(
				(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == elem.id
			);
			if (!diagramElem || !diagramElem.bounds) {
				return false;
			}
			const elemBounds = diagramElem.bounds;
			return (
				laneBounds.filter(
					(laneBound) =>
						elemBounds.x > laneBound.x &&
						elemBounds.y > laneBound.y &&
						elemBounds.x + elemBounds.width < laneBound.x + laneBound.width &&
						elemBounds.y + elemBounds.height < laneBound.y + laneBound.height
				).length == 1
			);
		});
	});

	// Version mittels der Lane Elemente im Prozess
	const flatLanes =
		laneSets.length > 0
			? laneSets
					.map((laneSet) => (laneSet.lanes ? laneSet.lanes : null))
					.filter((elem) => elem != null)
					.flat()
			: [];
	const flatLaneElements =
		flatLanes.length > 0
			? flatLanes
					.map((lane) => (lane.flowNodeRef ? lane.flowNodeRef : null))
					.filter((elem) => elem != null)
					.flat()
			: [];
	const laneElementSet = [...new Set(flatLaneElements)];
	const uniqueLaneAssigned = laneElementSet.length == flatLaneElements.length;

	const withinUniqueLanes = withinLaneBounds && uniqueLaneAssigned;

	// Sequenzflüsse dürfen nicht über Poolgrenzen hinweg verwendet werden
	// alle waypoints müssen sich innerhalb des Pools befinden
	const sequenceFlowsWithinPools =
		pools.length > 0
			? diagrams.every((diagram) => {
					const diagramElems = diagram.plane.planeElement;
					if (!diagramElems) {
						return false;
					}
					const poolElems = diagramElems.filter((elem) =>
						pools.some(
							(pool) => elem.bpmnElement && elem.bpmnElement.id == pool.id
						)
					);
					const allPoolBounds = poolElems.map((pool) => pool.bounds);
					const sequenceFlows = flowElems.filter((elem) =>
						elem.$type.includes('SequenceFlow')
					);
					return sequenceFlows.every((flow) => {
						const diagramFlow = diagramElems.find(
							(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == flow.id
						);
						if (!diagramFlow || !diagramFlow.waypoint) {
							return false;
						}
						const waypoints = diagramFlow.waypoint;
						return allPoolBounds.some((poolBounds) =>
							waypoints.every(
								(waypoint) =>
									waypoint.x > poolBounds.x &&
									waypoint.y > poolBounds.y &&
									waypoint.x < poolBounds.x + poolBounds.width &&
									waypoint.y < poolBounds.y + poolBounds.height
							)
						);
					});
			  })
			: true;

	// Nachrichtenflüsse dürfen nicht innerhalb eines Pools verwendet werden
	// die waypoints dürfen sich nicht alle innerhalb eines Pools befinden - hier nur anhand von Layoutinformationen
	const noMessageFlowsWithinPools =
		pools.length > 0
			? diagrams.every((diagram) => {
					const diagramElems = diagram.plane.planeElement;
					if (!diagramElems) {
						return false;
					}
					const poolElems = diagramElems.filter((elem) =>
						pools.some(
							(pool) => elem.bpmnElement && elem.bpmnElement.id == pool.id
						)
					);
					const allPoolBounds = poolElems.map((pool) => pool.bounds);
					return allMessageFlows.every((msg) => {
						const diagramMessage = diagramElems.find(
							(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == msg.id
						);
						if (!diagramMessage || !diagramMessage.waypoint) {
							return false;
						}
						const waypoints = diagramMessage.waypoint;
						return !allPoolBounds.some((poolBounds) =>
							waypoints.every(
								(waypoint) =>
									waypoint.x > poolBounds.x &&
									waypoint.y > poolBounds.y &&
									waypoint.x < poolBounds.x + poolBounds.width &&
									waypoint.y < poolBounds.y + poolBounds.height
							)
						);
					});
			  })
			: true;

	// Sequenzflüsse dürfen nicht über Teilprozessgrenzen hinweg verwendet werden
	// alle waypoints müssen sich entweder komplett innerhalb des Teilprozesses oder komplett außerhalb (im Elternprozess) befinden
	const subProcesses = flowElems.filter(
		(elem) =>
			elem.$type.includes('SubProcess') || elem.$type.includes('Transaction')
	);
	const withinSubs =
		subProcesses.length > 0
			? diagrams.every((diagram) => {
					const diagramElems = diagram.plane.planeElement;
					if (!diagramElems) {
						return false;
					}
					const diSubs = diagramElems.filter(
						(elem) =>
							subProcesses.some(
								(sub) => elem.bpmnElement && elem.bpmnElement.id == sub.id
							) && elem.isExpanded
					);
					if (diSubs.length == 0) {
						return true;
					}
					const allSubBounds = diSubs.map((sub) => sub.bounds);
					const sequenceFlows = flowElems.filter((elem) =>
						elem.$type.includes('SequenceFlow')
					);
					return sequenceFlows.every((flow) => {
						const diagramFlow = diagramElems.find(
							(diElem) => diElem.bpmnElement && diElem.bpmnElement.id == flow.id
						);
						if (!diagramFlow || !diagramFlow.waypoint) {
							return false;
						}
						const waypoints = diagramFlow.waypoint;
						return allSubBounds.every(
							(subBounds) =>
								//komplett innerhalb
								waypoints.every(
									(waypoint) =>
										waypoint.x > subBounds.x &&
										waypoint.y > subBounds.y &&
										waypoint.x < subBounds.x + subBounds.width &&
										waypoint.y < subBounds.y + subBounds.height
								) ||
								//komplett außerhalb
								waypoints.every(
									(waypoint) =>
										!(
											waypoint.x > subBounds.x &&
											waypoint.y > subBounds.y &&
											waypoint.x < subBounds.x + subBounds.width &&
											waypoint.y < subBounds.y + subBounds.height
										)
								)
						);
					});
			  })
			: true;

	// Alle Flusselemente (bis auf ein paar Ausnahmen) innerhalb eines Pools müssen verbunden sein (mit Sequenzflüssen)
	// if start event/s exist/s, then every other element needs to have a predecessor
	const predecessors = flowElems.some((elem) => elem.$type.includes('Start'))
		? flowElems
				.filter(
					(elem) =>
						!elem.$type.includes('Start') &&
						!elem.$type.includes('Boundary') &&
						!elem.$type.includes('SequenceFlow') &&
						!elem.$type.includes('Data') &&
						!(elem.$type.includes('SubProcess') && elem.triggeredByEvent) &&
						!(elem.$type.includes('Task') && elem.isforCompensation)
				)
				.every(
					(elem) =>
						elem.incoming &&
						elem.incoming.length > 0 &&
						elem.incoming.some((inFlow) => inFlow.sourceRef)
				)
		: flowElems.filter(
				(elem) =>
					!elem.$type.includes('Boundary') &&
					!elem.$type.includes('SequenceFlow') &&
					!elem.$type.includes('Data') &&
					!(elem.$type.includes('SubProcess') && elem.triggeredByEvent) &&
					!(elem.$type.includes('Task') && elem.isforCompensation) &&
					!(
						elem.incoming &&
						elem.incoming.length > 0 &&
						elem.incoming.some((inFlow) => inFlow.sourceRef)
					)
		  ).length == 1; //this could be improved

	//if an end event/s exist/s, then every other element needs to have a successor
	const successors = flowElems.some((elem) => elem.$type.includes('End'))
		? flowElems
				.filter(
					(elem) =>
						!elem.$type.includes('End') &&
						!elem.$type.includes('SequenceFlow') &&
						!elem.$type.includes('Data') &&
						!(elem.$type.includes('SubProcess') && elem.triggeredByEvent) &&
						!(elem.$type.includes('Task') && elem.isforCompensation)
				)
				.every(
					(elem) =>
						elem.outgoing &&
						elem.outgoing.length > 0 &&
						elem.outgoing.some((outFlow) => outFlow.targetRef)
				)
		: flowElems.filter(
				(elem) =>
					!elem.$type.includes('SequenceFlow') &&
					!elem.$type.includes('Data') &&
					!(elem.$type.includes('SubProcess') && elem.triggeredByEvent) &&
					!(elem.$type.includes('Task') && elem.isforCompensation) &&
					!(
						elem.outgoing &&
						elem.outgoing.length > 0 &&
						elem.outgoing.some((outFlow) => outFlow.targetRef)
					)
		  ).length == 1; //this could be improved

	const connectedElements = !parentType.includes('AdHoc')
		? predecessors && successors
		: true;

	// Für das Anbinden von Artefakten/Datenobjekten müssen Assoziationen verwendet werden bzw.
	// Artefakte ((Association?), Group, Annotation) dürfen nicht Source oder Target von Sequenz- oder Nachrichtenflüssen sein
	// Datenobjekte/speicher/etc. (Data...) dürfen nicht Source oder Target von Sequenz- oder Nachrichtenflüssen sein
	const artifactIds = parentProcess.artifacts
		? parentProcess.artifacts.map((artifact) => artifact.id)
		: [];
	const dataElementIds = flowElems
		.filter((elem) => elem.$type.includes('Data'))
		.map((dataElem) => dataElem.id);
	const noSequenceConnections = !flowElems
		.filter((elem) => elem.$type.includes('Sequence'))
		.some((elem) => {
			let source = elem.sourceRef?.id; //when the bpmn file is manually manipulated, the sourceRef might not always present
			let target = elem.targetRef?.id; //when the bpmn file is manually manipulated, the targetRef might not always present
			return (
				artifactIds.some(
					(artifactId) => artifactId == source || artifactId == target
				) ||
				dataElementIds.some((dataId) => dataId == source || dataId == target)
			);
		});
	const noMessageConnections = !allMessageFlows.some((msg) => {
		let source = msg.sourceRef?.id; //when the bpmn file is manually manipulated, the sourceRef might not always present
		let target = msg.targetRef?.id; //when the bpmn file is manually manipulated, the targetRef might not always present
		return (
			artifactIds.some(
				(artifactId) => artifactId == source || artifactId == target
			) || dataElementIds.some((dataId) => dataId == source || dataId == target)
		);
	});

	const correctArtifactAndDataConnections =
		noSequenceConnections && noMessageConnections;

	return {
		connectedElements: connectedElements,
		noUndefinedBoundary: noUndefinedBoundaryEvents,
		noThrowingStarts: noThrowingStartEvents,
		noCatchingEnds: noCatchingEndEvents,
		correctBoundaryFlows: correctBoundaryFlows,
		correctCancelEnds: correctCancelEndEvents,
		correctCancelInterEvents: correctCancelIntermediateEvents,
		correctCompStartEvents: correctCompensationStartEvents,
		correctCompInterEvents: correctCompensationIntermediateEvents,
		correctStartEndCombo: correctStartEndCombo,
		correctStartEventFlows: correctStartEventFlows,
		correctEndEventFlows: correctEndEventFlows,
		correctLinkEventFlows: correctLinkEventFlows,
		noGatewayMessageFlows: noGatewayMessageFlows,
		correctGatewayInFlow: correctGatewayIncomingFlow,
		correctEventBased: correctEventBasedGateway,
		correctEventBasedFlows: correctEventBasedFlows,
		elemsAfterEventBased: correctElemsAfterEventBased,
		inFlowAfterEventBased: inFlowAfterEventBased,
		noBoundaryAfterEventBased: noBoundaryAfterEventBased,
		comboAfterEventBased: noTaskAndMessageAfterEventBased,
		correctSubStarts: correctSubStarts,
		correctEventSubStarts: correctEventSubStarts,
		noAdHocStartEnd: noAdHocStartEnd,
		atLeastOneTask: atLeastOneTask,
		noEventSubFlows: noEventSubFlows,
		messageDirection: messageDirection,
		noCompTaskFlows: noCompensationTaskFlows,
		noThrowingBoundary: noThrowingBoundaryEvents,
		linkPairs: linkPairs,
		singleTargetLinks: singleTargetLinks,
		withinPools: withinPools,
		withinLanes: withinUniqueLanes,
		seqFlowsInPools: sequenceFlowsWithinPools,
		noMsgFlowsInPools: noMessageFlowsWithinPools,
		withinSubs: withinSubs,
		artifactAndDataConnects: correctArtifactAndDataConnections,
	};
}

export default checkSyntaxCriteria;
