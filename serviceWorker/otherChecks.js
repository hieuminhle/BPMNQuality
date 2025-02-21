/**
 *
 * @param {Object} parentProcess process, subprocess, etc.
 * @param {Object} collab collaboration element of the bpmn file (if there is one)
 * @param {Array} diagrams layout information of the bpmn file
 * @returns
 */
function checkOtherCriteria(parentProcess, collab, diagrams) {
	const flowElems = parentProcess.flowElements
		? parentProcess.flowElements
		: []; //TODO

	//>1 Aktivität
	const nonEmpty =
		flowElems.filter(
			(elem) =>
				elem.$type.includes('Task') ||
				elem.$type.includes('SubProcess') ||
				elem.$type.includes('Activity')
		).length > 0;

	//mind. eine Verzweigung (mit unterschiedlichen Nachfolgern)
	const nonLinear = flowElems.some((elem) => {
		if (elem.outgoing && elem.outgoing.length > 1) {
			const targetElems = elem.outgoing.map(out =>  out.targetRef ? out.targetRef.id : '').filter((elem) => elem !== '');
			const uniqueTargets = [...new Set(targetElems)];
			return uniqueTargets.length > 1;
		} else return false;
	});

	//mind. 4 Aktivitäten
	const min4Activities =
		flowElems.filter(
			(elem) =>
				elem.$type.includes('Task') ||
				elem.$type.includes('SubProcess') ||
				elem.$type.includes('Activity')
		).length > 3;

	//keine sehr kurzen Namen (vereinfacht: nur für benannte Elemente und nicht für Sequenzflüsse)
	const noShortNames = flowElems.every((elem) =>
		elem.name && !elem.$type.includes('SequenceFlow') ? elem.name.length > 4 : true
	);

	return {
		nonEmpty: nonEmpty,
		nonLinear: nonLinear,
		min4Activities: min4Activities,
		noShortNames: noShortNames,
	};
}

export default checkOtherCriteria;
