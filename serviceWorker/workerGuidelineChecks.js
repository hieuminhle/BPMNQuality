import { Client, logger, Variables } from 'camunda-external-task-client-js';
import checkProcess from './checkWrappers.js';
import checkGuidelineCriteria from './guidelineChecks.js';
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

// susbscribe to the topic: 'examCorrection'
client.subscribe('guidelineChecks', async function ({ task, taskService }) {
	const xmlStr = task.variables.get('bpmnFile');
	const moddle = new BpmnModdle();

	const { rootElement } = await moddle.fromXML(xmlStr);

	//guideline checks
	const guidelineCheckResults = checkProcess(rootElement, checkGuidelineCriteria);

	const processVariables = new Variables();
	processVariables.set('guidelineChecks', guidelineCheckResults);

	// Complete the task
	resolveTask();
	async function resolveTask() {
		try {
			await taskService.complete(task, processVariables);
		} catch (e) {
			resolveTask();
		}
	}
});
