/** Function that checks the adherence of a BPMN file to a specific group of criteria specified in a function
 *
 * @param {Object} bpmn bpmn file in json format
 * @param {Function} checkFunction function that checks the adherence of a process to a specific group of criteria
 * @returns checkResults object with boolean values for each check
 */
function checkProcess(bpmn, checkFunction) {
	const collab = bpmn.rootElements.find((elem) => elem.$type.includes('Collaboration'));
	const diagrams = bpmn.diagrams ? bpmn.diagrams : null;
	const checkResults = bpmn.rootElements
		.filter((root) => 'flowElements' in root)
		.map((process) =>
			handleNestedChecks(process, collab, diagrams, checkFunction)
		);
	return checkResults;
}

/**Function that wraps the checkFunction to handle nested processes and combine the results
 *
 * @param {Object} parentProcess a process, subprocess, etc.
 * @param {Object} collab the collaboration element of the bpmn file (if there is one)
 * @param {Array} diagrams the layout information of the bpmn file
 * @param {Function} checkFunction function that checks the adherence of a process to a specific group of criteria
 * @returns
 */
function handleNestedChecks(parentProcess, collab, diagrams, checkFunction) {
	const checkedParentProcess = checkFunction(parentProcess, collab, diagrams);

	const nestedProcesses = parentProcess.flowElements.filter(
		(elem) => 'flowElements' in elem
	);
	if (nestedProcesses.length == 0) {
		return checkedParentProcess;
	} else {
		const checkedNestedProcesses = nestedProcesses.map((nestedProcess) =>
			handleNestedChecks(nestedProcess, collab, diagrams, checkFunction)
		);
		const combinedCheckedProcesses = checkedNestedProcesses.reduce(
			(acc, curr) => {
				Object.keys(acc).forEach((key) => {
					acc[key] = acc[key] && curr[key];
				});
				return acc;
			},
			checkedParentProcess
		);
		return combinedCheckedProcesses;
	}
}

export default checkProcess;
