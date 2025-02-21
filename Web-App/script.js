var processModels = [];
var ELEMENTS_IN_TABLE = document.getElementById('modelsPerPage').value; // default 20
var POLLING_TIME_INTERVAL = document.getElementById('pollingTimeInterval').value; // default 1000
var filesLoaded = false;
var finishedModels = 0;
var bestPracticeFilterNumber = 0;
var otherFilterNumber = 0;
var syntaxFilterNumber = 0;
var criteriaCheckBoxes = {};
let timeMeasure = [];
var checkDuplicates = document.getElementById('checkDuplicatesCriteria').checked;

document.getElementById('input').addEventListener('change', function(e) {
    // Seite zurücksetzen
    processModels = [];
    deleteTable();
    deletePagination();
    filesLoaded = false;
    document.getElementById('sendBtn').classList.add('disabled');
    document.getElementById('timeMeasure').innerText = "";
    finishedModels = 0;
    document.getElementById('progressBar').style.width =  0 + '%';
    document.getElementById('inputLoadFiles').classList.toggle('d-none');
    
    // Zählt alle Validen Dateitypen
    let numberValidFileTypes = 0;
    for (const file of e.target.files) {
        if ((file.name.endsWith('bpmn') || file.name.endsWith('xml') || file.name.endsWith('json'))) {
            numberValidFileTypes += 1;
        }
    }

    // Wenn keine Dateien ausgewählt wurden
    if (numberValidFileTypes == 0) {
        filesLoaded = true;
        document.getElementById('inputLoadFiles').classList.toggle('d-none');
    }

    // Schreibt Datei in ein String um
    let actNumberValidFileTypes = 0;
    let modelIndex = 1;
    for (const file of e.target.files) {
        
        // Nur Dateien die mit bpmn, xml oder json enden werden lokal gespeichert
        if (file.name.endsWith('bpmn') || file.name.endsWith('xml') || file.name.endsWith('json')) {
            let reader = new FileReader();
            reader.onload = function() {
                processModels.push({id: modelIndex++, name: file.name, model: reader.result});
            }
            
            reader.onloadend = function() {
                actNumberValidFileTypes += 1;

                // Letztes Element
                if (actNumberValidFileTypes == numberValidFileTypes) {
                    document.getElementById('inputLoadFiles').classList.toggle('d-none');
                    filesLoaded = true;
                    let numberPagesInPagination = Math.ceil(processModels.length / ELEMENTS_IN_TABLE);
                    numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;
                    for (let j = 1; j <= numberPagesInPagination; j++) {
                        addPaginationButton(j);
                    }
                    document.getElementById('sendBtn').classList.remove('disabled');
                    addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
                }
            }
            reader.readAsText(file);
        }
    }
});

document.getElementById('sendBtn').addEventListener('click', sendData);
/**
 * Startet den verketteten Funktionsaufruf
 * createProcessInstance -> executeUploadTask -> completeUploadTask
 */
function sendData() {
    // Misst die Anfangszeit und deaktiviert den Senden Button
    timeMeasure[0] = Date.now();
    document.getElementById('sendBtn').classList.add('disabled');
    // Verzögert die Anfragen, sodass nicht zu viele Anfragen auf einmal verschickt werden
    for (let i = 0; i < processModels.length; i++) {
        window.setTimeout(() => createProcessInstance(processModels[i], i), i*2);
    }
}

/** Erstellt eine Prozessinstanz
 * 
 * @param model Ein Prozessmodell in XML
 * @param i Index des Prozessmodells im processModel Array
 */
async function createProcessInstance(model, i) {
    try {
    await fetch("http://localhost:8080/engine-rest/process-definition/key/BPMNQuality/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          //body: JSON.stringify(modelVariables)
        })
       .then(res => res.json())
       .then(data => model.processId = data.id);
    } catch (e) {
        createProcessInstance(model, i);
        return;
    }
    executeUploadTask(model, i);
}

/** Die ID der ersten Aufgabe "Modelle hochladen" wird angefragt
 * 
 * @param model Ein Prozessmodell in XML
 * @param i Index des Prozessmodells im processModel Array
 */
async function executeUploadTask(model, i) {
    let response;
    try {
      response = await fetch("http://localhost:8080/engine-rest/task?processInstanceId=" + model.processId)
          .then(res => res.json())
          .then((data => {return data.filter(line => line.taskDefinitionKey === "Modell_hochladen")}));

          
    } catch(e) {
        executeUploadTask(model, i);
        return;
    }
    completeUploadTask(model, i, response[0].id);
}

/** Schickt das Prozessmodell zu Camunda
 * 
 * @param model Ein Prozessmodell in XML
 * @param i Index des Prozessmodells im processModel Array
 * @param taskId ID der Aufgabe die abgeschlossen werden soll
 */
async function completeUploadTask(model, i, taskId) {
    let modelVariables = 
    {variables: {
        bpmnFile: {
            value: model.model,
            type: "xml",
        }
    },
    withVariablesInReturn: true};
    try {
        await fetch("http://localhost:8080/engine-rest/task/"+ taskId +"/complete", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify(modelVariables)
        })
        .then(res => res.json())
        processModels[i] = model;

    } catch (e) {
        completeUploadTask(model, i, taskId);
        return;
    }
    checkIfFinished(i);
}

/** Schaut ob die Überprüfung des Prozessmodells bereits abgeschlossen ist oder nicht.
 *  Wenn nicht, dann wird im Intervall von POLLING_TIME_INTERVAL eine neue Anfrage verschickt
 * 
 * @param {*} i Index des Prozessmodells im processModel Array
 */
async function checkIfFinished(i) {
    let tasks; 
    try {
        tasks = await fetch("http://localhost:8080/engine-rest/task?processInstanceId=" + processModels[i].processId)
          .then(res => res.json())
          .then((data => {return data.filter(line => line.taskDefinitionKey === "Ergebnis_pruefen")}));
    } catch (e) {
        window.setTimeout(() => checkIfFinished(i), POLLING_TIME_INTERVAL);
        return;
    }
    
    if (tasks.length > 0) {
        finishedModels += 1;
        if (finishedModels == processModels.length) {
            window.setTimeout(() => executeResultsTask(), 1000);
        }
        let progress = (finishedModels/processModels.length)*100;
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressBarParentAria').setAttribute('aria-valuenow', progress);

    } else {
        window.setTimeout(() => checkIfFinished(i), POLLING_TIME_INTERVAL);
    }
}

/**
 * Wenn auf den "Überprüfen" Button geklickt wird, wird Camunda zur Erledigung der letzten Aufgabe "Ergebnisse prüfen" angefragt 
 * Die Werte in den Prozessvariablen werden in das processModel Array geschrieben.
 * Es wird die Tabelle sowie die Pagination neu gebaut
 */
async function executeResultsTask() {
    deleteTable();
    document.getElementById('loadTable').classList.remove('d-none');

    for (let i = 0; i < processModels.length; i++) {
        // Variablen der Prozessinstanz abfragen
        let processInstance = await fetch("http://localhost:8080/engine-rest/process-instance/" + processModels[i].processId + "/variables?deserializeValues=false")
          .then(res => res.json())

        if ("nobpmn" in processInstance) {
            processModels[i].nobpmn = true;
        } else {
            // Überträgt die Daten aus den Prozessvariablen der Prozessinstanz in das lokale Array
            processModels[i].syntax = JSON.parse(processInstance.syntaxChecks.value);
            processModels[i].normalform = processInstance.normalform.value;
            processModels[i].guideline = JSON.parse(processInstance.guidelineChecks.value);
            processModels[i].other = JSON.parse(processInstance.otherChecks.value);
        }
        

          // Aufgabe "Ergebnisse prüfen" anfangen
          let response = await fetch("http://localhost:8080/engine-rest/task?processInstanceId=" + processModels[i].processId)
          .then(res => res.json())
          .then((data => {return data.filter(line => line.taskDefinitionKey === "Ergebnis_pruefen")}));
          let taskId = response[0].id;

          // Aufgabe "Ergebnisse prüfen" beenden
          await fetch("http://localhost:8080/engine-rest/task/"+ taskId +"/complete", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: null
        });
    }

    let numberPagesInPagination = Math.ceil(processModels.length / ELEMENTS_IN_TABLE);
    numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;

    countFulfilledRules();

    // Startet die Duplikatsprüfung
    if (checkDuplicates) markDuplicates();

    // Versteckt den Ladespinner
    document.getElementById('loadTable').classList.add('d-none');
    // Updated die Tabelle
    addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
    // Misst die Endzeit und stellt sie auf der Seite dar
    timeMeasure[1] = Date.now();
    document.getElementById('timeMeasure').innerText = ((timeMeasure[1] - timeMeasure[0]) / 1000).toFixed(2) + " Sekunden";
    
    document.getElementById('sendBtn').classList.remove('disabled');
}

/**
 * Zählt die Anzahl der erfüllten Regeln
 */
function countFulfilledRules() {
    for (let i = 0; i < processModels.length; i++) {
        if ("nobpmn" in processModels[i]) {
            continue;
        }
        let syntaxCount = 0;
        let guidelineCount = 0;
        let otherCount = 0;
        // Syntax
        let localSyntaxObj = intersection(processModels[i].syntax);
        for (let key in localSyntaxObj[0]) {
            if (localSyntaxObj[0][key] == true && criteriaCheckBoxes["syntax"][key] == true) {
                syntaxCount += 1;
            }
        }
        // Guidelines
        let localGuidelineObj = intersection(processModels[i].guideline);
        for (let key in localGuidelineObj[0]) {
            if (localGuidelineObj[0][key] == true && criteriaCheckBoxes["guidelines"][key] == true) {
                guidelineCount += 1;
            }
        }
        // Other
        let localOtherObj = intersection(processModels[i].other);
        for (let key in localOtherObj[0]) {
            if (localOtherObj[0][key] == true && criteriaCheckBoxes["other"][key] == true) {
                otherCount += 1;
            }
        }
        processModels[i].syntaxCount = syntaxCount;
        processModels[i].guidelineCount = guidelineCount;
        processModels[i].otherCount = otherCount;
    }
}

/**
 * Löscht die gesamte Tabelle
 */
function deleteTable() {
    // Den Inhalt der Tabelle löschen
    let tableBody = document.getElementById('tableBody');
    tableBody.remove();

    // Einen neuen Table Body erstellen
    let tableParent = document.getElementById('tableParent');
    let newTableBody = document.createElement('tbody');
    newTableBody.setAttribute('id', 'tableBody');
    tableParent.appendChild(newTableBody);
}

/** 
 * Löscht alle Pagination Buttons
 */
function deletePagination() {
    document.getElementById('paginationList').remove();

    // Neue Pagination List erstellen
    let listParent = document.getElementById('paginationContainer');
    let newPagination = document.createElement('div');
    newPagination.setAttribute('id', 'paginationList');
    newPagination.classList.add('row');
    listParent.appendChild(newPagination);
}

/** Baut die Tabelle um die Prozessmodelle anzuzeigen
 * 
 * @param files Dateien die der Tabelle hinzugefügt werden sollen 
 */
function addFilesToTable(files) {
    let tableBody = document.getElementById('tableBody');

    // Für jede Zeile
    for (let i = 0; i < files.length; i++) {
        let tableRow = document.createElement('tr');

        tableRow.setAttribute('data-bs-toggle', "collapse");
        tableRow.setAttribute('href', "#moreInformationCollapse"+i);
        tableRow.setAttribute('aria-expanded', false);
        tableRow.setAttribute('aria-controls', 'moreInformationCollapse');

        let tableDataNumber = document.createElement('td');
        let tableDataName = document.createElement('td');
        
        tableDataNumber.innerText = files[i].id;
        tableDataName.innerText = files[i].name;

        tableBody.appendChild(tableRow);
        tableRow.appendChild(tableDataNumber);
        tableRow.appendChild(tableDataName);

        // Wrapper für Collapse
        let moreInformationCollapseWrapper = document.createElement('tr');
        moreInformationCollapseWrapper.classList.add('collapse');
        moreInformationCollapseWrapper.setAttribute('id', 'moreInformationCollapse'+i);

        // Details zu den Syntaxregeln im Collapse
        let moreInformationCollapseDetail = document.createElement('td');
        moreInformationCollapseDetail.setAttribute('colspan', 7);

        if ("nobpmn" in files[i]) {
            // Hinweis anzeigen, dass es sich nicht um ein gültiges BPMN-Modell handelt 
            let tableDataSyntaxNumber = document.createElement('td');
            let tableDataProcessNumber = document.createElement('td');
            let tableDataGuidelineNumber = document.createElement('td');
            let tableDataOtherNumber = document.createElement('td');
            let tableDataDuplicate = document.createElement('td');
            moreInformationCollapseDetail.innerText = "Kein gültiges BPMN!";
            tableRow.appendChild(tableDataProcessNumber);
            tableRow.appendChild(tableDataSyntaxNumber);
            tableRow.appendChild(tableDataGuidelineNumber); 
            tableRow.appendChild(tableDataOtherNumber);
            tableRow.appendChild(tableDataDuplicate);
            tableRow.classList.add('bg-danger', 'text-white');
            moreInformationCollapseWrapper.appendChild(moreInformationCollapseDetail);
            tableBody.appendChild(moreInformationCollapseWrapper);
        } else if ("syntax" in files[i] && "guideline" in files[i] && "other" in files[i]) {
            // Table Data Element welches direkt zu sehen ist in der Tabelle
            let tableDataSyntaxNumber = document.createElement('td');
            let tableDataProcessNumber = document.createElement('td');
            let tableDataGuidelineNumber = document.createElement('td');
            let tableDataOtherNumber = document.createElement('td');

            // Prüft ob mehrere Prozesse im Modell vorhanden sind
            if (files[i].syntax.length > 1 && files[i].guideline.length > 1 && files[i].other.length > 1) {
                for (let j = 0; j < files[i].syntax.length; j++) {
                    moreInformationCollapseDetail.innerHTML += "<br><h5>Prozess " + (j+1) + "</h5>";
                    // Syntaxregeln
                    moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Syntax</h6>";
                    for (let key in files[i].syntax[j]) {
                        moreInformationCollapseDetail.innerHTML += key + ": " + files[i].syntax[j][key];
                        if (criteriaCheckBoxes["syntax"][key] == false) {
                            moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                        }
                        moreInformationCollapseDetail.innerHTML += "<br>";
                    }
                    // Guidelineregeln
                    moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Guidelines</h6>";
                    for (let key in files[i].guideline[j]) {
                        moreInformationCollapseDetail.innerHTML += key + ": " + files[i].guideline[j][key];
                        if (criteriaCheckBoxes["guidelines"][key] == false) {
                            moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                        }
                        moreInformationCollapseDetail.innerHTML += "<br>";
                    }
                    // Andere Regeln
                    moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Other</h6>";
                    for (let key in files[i].other[j]) {
                        moreInformationCollapseDetail.innerHTML += key + ": " + files[i].other[j][key];
                        if (criteriaCheckBoxes["other"][key] == false) {
                            moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                        }
                        moreInformationCollapseDetail.innerHTML += "<br>";
                    }
                }
            } else {
                // Syntaxregeln
                moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Syntax</h6>";
                for (let key in files[i].syntax[0]) {
                    moreInformationCollapseDetail.innerHTML += key + ": " + files[i].syntax[0][key];
                    if (criteriaCheckBoxes["syntax"][key] == false) {
                        moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                    }
                    moreInformationCollapseDetail.innerHTML += "<br>";
                }
                // Guidelineregeln
                moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Guidelines</h6>";
                for (let key in files[i].guideline[0]) {
                    moreInformationCollapseDetail.innerHTML += key + ": " + files[i].guideline[0][key];
                    if (criteriaCheckBoxes["guidelines"][key] == false) {
                        moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                    }
                    moreInformationCollapseDetail.innerHTML += "<br>";
                }
                // Andere Regeln
                moreInformationCollapseDetail.innerHTML += "<h6 class='my-1'>Other</h6>";
                for (let key in files[i].other[0]) {
                    moreInformationCollapseDetail.innerHTML += key + ": " + files[i].other[0][key];
                    if (criteriaCheckBoxes["other"][key] == false) {
                        moreInformationCollapseDetail.innerHTML += " <i>(deaktiviert)</i>";
                    }
                    moreInformationCollapseDetail.innerHTML += "<br>";
                }
            }
            // Anzahl der erfüllten Regeln in die Tabelle schreiben
            tableDataSyntaxNumber.innerText = files[i].syntaxCount;
            tableDataGuidelineNumber.innerText = files[i].guidelineCount;
            tableDataOtherNumber.innerText = files[i].otherCount;

            // Markiert die Duplikate
            if (files[i].duplicate) {
                tableRow.classList.add('bg-warning');
            }

            // Markiert die Modelle die herausgefiltert werden
            if (files[i].guidelineCount < bestPracticeFilterNumber || files[i].otherCount < otherFilterNumber || files[i].syntaxCount < syntaxFilterNumber || files[i].nobpmn) {
                tableRow.classList.add('bg-danger', 'text-white');
            }

            // Anzahl der Prozesse auslesen
            tableDataProcessNumber.innerText = files[i].syntax.length;

            // Elemente zum DOM hinzufügen
            tableRow.appendChild(tableDataProcessNumber);
            tableRow.appendChild(tableDataSyntaxNumber);
            tableRow.appendChild(tableDataGuidelineNumber);
            tableRow.appendChild(tableDataOtherNumber);
            moreInformationCollapseWrapper.appendChild(moreInformationCollapseDetail);
            tableBody.appendChild(moreInformationCollapseWrapper);
        }
            
        if ("duplicate" in files[i]) {
            let tableDataDuplicate = document.createElement('td');
            tableDataDuplicate.innerText = files[i].duplicate;
            tableRow.appendChild(tableDataDuplicate);
        }
    }
}

/**  Fügt Pagination Buttons hinzu. Die Tabelle der Prozessmodelle ist beschränkt auf einen festen Wert der angezeigt wird
@param number Seitenzahl die der Button als Text anzeigt
*/
function addPaginationButton(number) {
    let parent = document.getElementById('paginationList');
    let newPage = document.createElement('li');
    let newPageLink = document.createElement('a');

    newPageLink.innerText = number;
    newPage.classList.add('page-item');
    newPage.classList.add('col-1');
    newPageLink.classList.add('page-link');

    newPage.appendChild(newPageLink);
    parent.appendChild(newPage);

    newPageLink.addEventListener('click', () => {
        deleteTable();
        addFilesToTable(processModels.slice(number*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, number*ELEMENTS_IN_TABLE));
    });
}

// Für den Download von einem zip-Ordner der Modell im processModel Array
import { Zip } from "./zip.js";

document.getElementById('downloadModels').addEventListener('click', downloadModels);
/** 
 * Lädt die Modelle als zip-Ordner und die dazugehörige CSV-Datei der Ergebnisse herunter
 */
function downloadModels() {
    // Zip-Ordner der Modelle downloaden
    let z = new Zip('Models'); 
    let filteredProcessModels = processModels.filter(e => 
        e.guidelineCount >= bestPracticeFilterNumber
        && e.otherCount >= otherFilterNumber
        && e.syntaxCount >= syntaxFilterNumber
    ).filter(e => {
        if (e.duplicate) {
            // Es wird das qualitativ bessere Duplikat gesucht
            if (e.id == processModels.filter(e2 => e2.duplicate == e.duplicate)
            .reduce((acc, cur) => {
                if (acc.syntaxCount < cur.syntaxCount) {
                    return cur;
                } else if (acc.syntaxCount == cur.syntaxCount && acc.guidelineCount + acc.otherCount < cur.guidelineCount + cur.otherCount) {
                    return cur;
                } else {
                    return acc;
                }
            }).id) {
                return true;
            } else {
                return false;
            }
        } else {
            return true;
        }
    });


    for (let i = 0; i < filteredProcessModels.length; i++) {
        z.str2zip(filteredProcessModels[i].name, filteredProcessModels[i].model, '');
    }
    z.makeZip();

    // CSV-Datei der Ergebnisse downloaden
    // basierend auf https://stackoverflow.com/questions/19327749/javascript-blob-filename-without-link/19328891#19328891
    var saveData = (function () {
        var a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return function (data, fileName) {
            var blob = new Blob([data], { type: 'text/csv;charset=utf-8;' }),
                url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }());
    saveData(convertToCSV(), 'Results');

}

/** 
 * Überführt das Array processModels in ein CSV-String
 * @returns CSV-String
 */
function convertToCSV() {
    // basierend auf https://stackoverflow.com/questions/11257062/converting-json-object-to-csv-format-in-javascript
    let newArr = [];
    // Löscht nicht notwendige Eigenschaften
    newArr = processModels.map(e => {delete e.model; delete e.normalform; delete e.processId; delete e.nobpmn; return e;});

    // Schreibt alle Keys in ein Array
    let array = [[]];
    for (let key of Object.keys(newArr[0])) {
        if (Array.isArray(newArr[0][key])) {
            for (let subKey in newArr[0][key][0]) {
                array[0].push(subKey);
            }
        } else {
            array[0].push(key);
        }
    }
    array = array.concat(newArr);

    // Löst die Objekte auf zu einem Array
    array = array.map(e => {
        if (typeof e === 'object') {
            let toReturn;
            if ("syntax" in e && e.syntax.length > 1) {
                e.syntax = intersection(e.syntax);
                e.guideline = intersection(e.guideline);
                e.other = intersection(e.other)
            }
            toReturn = Object.values(e).flat();
            toReturn = toReturn.map(x => (typeof x === 'object') ? Object.values(x) : x);
            
            return toReturn.flat();
        } else {
            return e;
        }
    });
    array = array.join('\n');

    return array;
}

/** Berechnet die Schnittmenge zwischen den Werten von mehreren Objekten in einem Array.
 *  Der Wert false wird immer bevorzugt.
 * @param arr Ein Array welches Objekte enthält welches boolean-Werte beinhaltet
 * @returns Ein Array wo genau ein Objekt drin ist
 */
function intersection(arr) {
    let intersectionObj = arr[0];
    for (let i = 0; i < arr.length; i++) {
        for (let key in arr[i]) {
            if (arr[i][key] == false) {
                intersectionObj[key] = false;
            }
        }
    }
    return [intersectionObj];
}

/** 
 *  Markiert Duplikate im processModel Array
 */ 
function markDuplicates() {
    let realBpmnProcessModels = processModels.filter(e => !("nobpmn" in e));
    let duplicatesMinus1 = realBpmnProcessModels.filter((e, i, a) => a.map(e2 => e2.normalform).indexOf(e.normalform) !== i);

    realBpmnProcessModels.forEach((e) => {
        let duplicate = duplicatesMinus1.find(e2 => e2.normalform == e.normalform);
        if (duplicate) {
            e.duplicate = duplicate.id + " " + duplicate.name;
        } else {
            e.duplicate = false;
        }
        return e;
    });
}

// Wenn der Range Slide der "Modellierungsrichtlinien" verschoben wird
document.getElementById('guidelineFilterNumber').addEventListener('change', function(e) {
    bestPracticeFilterNumber = e.target.value;
    document.getElementById('curFilterNumber').innerText = bestPracticeFilterNumber;
    document.getElementById('guidelineRulesChecked').innerText = bestPracticeFilterNumber;
    // Updated die Tabelle
    deleteTable();
    let numberPagesInPagination = processModels.length / ELEMENTS_IN_TABLE;
    numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;
    addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
});

// Wenn der Range Slide der "Anderen" Regeln verschoben wird
document.getElementById('otherFilterNumber').addEventListener('change', function(e) {
    otherFilterNumber = e.target.value;
    document.getElementById('curOtherFilterNumber').innerText = otherFilterNumber;
    document.getElementById('otherRulesChecked').innerText = otherFilterNumber;
    // Updated die Tabelle
    deleteTable();
    let numberPagesInPagination = processModels.length / ELEMENTS_IN_TABLE;
    numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;
    addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
});

// Wenn die Filter Option geändert wird zur Anzahl der Modelle pro Seite
document.getElementById('modelsPerPage').addEventListener('change', function(e) {
    // Wenn kein gültiger Wert eingegeben wird, dann wird der Wert auf 20 gesetzt
    if (e.target.value > 0 && !isNaN(e.target.value)) {
        ELEMENTS_IN_TABLE = e.target.value;
    } else {
        e.target.value = 20;
        ELEMENTS_IN_TABLE = 20;
    }
    
    // Pagination löschen und neu bauen
    deletePagination();
        
    let numberPagesInPagination = Math.ceil(processModels.length / ELEMENTS_IN_TABLE);
    numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;
    for (let j = 1; j <= numberPagesInPagination; j++) {
        addPaginationButton(j);
    }
    // Tabelle aktualisieren
    deleteTable();
    addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
});

// Wenn die Filter Option geändert wird zum Polling Zeitintervall
document.getElementById('pollingTimeInterval').addEventListener('change', function(e) {
    // Wenn kein gültiger Wert eingegeben wird, dann wird der Wert auf 1000 gesetzt
    if (e.target.value >= 100 && !isNaN(e.target.value)) {
        POLLING_TIME_INTERVAL = e.target.value;
    } else {
        e.target.value = 1000;
        POLLING_TIME_INTERVAL = 1000;
    }
});

// Wenn die Duplikatsprüfung Checkbox verändert wird
document.getElementById('checkDuplicatesCriteria').addEventListener('change', (evt) => {
    checkDuplicates = evt.target.checked;
});

loadCriterias();
/**
 * Lädt die Kriterien die implementiert sind. 
 * Jedes Kriterium kann als Checkbox ein- und ausgeschaltet werden.
 */
async function loadCriterias() {
    let criteria = await fetch('./criteria.json').then(res => res.json());
    let syntaxCriteriaArea = document.getElementById('criteriaAreaSyntaxCheckBoxes');
    let guidelineCriteriaArea = document.getElementById('criteriaAreaGuidelineCheckBoxes');
    let otherCriteriaArea = document.getElementById('criteriaAreaOtherCheckBoxes');

    // Setzt die Startwerte in der Weboberfläche basierend auf der JSON-Datei
    let currentGuidelineFilterNumber = Math.ceil(criteria.guidelines.length/2);
    let maxGuidelineFilterNumber = criteria.guidelines.length;
    document.getElementById('guidelineFilterNumber').setAttribute('max', maxGuidelineFilterNumber);
    document.getElementById('guidelineFilterNumber').setAttribute('value', currentGuidelineFilterNumber);
    document.getElementById('curFilterNumber').innerText = currentGuidelineFilterNumber;
    document.getElementById('maxFilterNumber').innerText = maxGuidelineFilterNumber;
    bestPracticeFilterNumber = currentGuidelineFilterNumber;

    let currentOtherFilterNumber = Math.ceil(criteria.other.length/2);
    let maxOtherFilterNumber = criteria.other.length;
    document.getElementById('otherFilterNumber').setAttribute('max', maxOtherFilterNumber);
    document.getElementById('otherFilterNumber').setAttribute('value', currentOtherFilterNumber);
    document.getElementById('curOtherFilterNumber').innerText = currentOtherFilterNumber;
    document.getElementById('maxOtherFilterNumber').innerText = maxOtherFilterNumber;
    otherFilterNumber = currentOtherFilterNumber;

    syntaxFilterNumber = criteria.syntax.length;

    document.getElementById('syntaxRulesChecked').innerText = criteria.syntax.length;
    document.getElementById('syntaxRulesTotal').innerText = criteria.syntax.length;
    document.getElementById('guidelineRulesChecked').innerText = bestPracticeFilterNumber;
    document.getElementById('guidelineRulesTotal').innerText = criteria.guidelines.length;
    document.getElementById('otherRulesChecked').innerText = otherFilterNumber;
    document.getElementById('otherRulesTotal').innerText = criteria.other.length;

    criteriaCheckBoxes["syntax"] = {};
    criteriaCheckBoxes["guidelines"] = {};
    criteriaCheckBoxes["other"] = {};

    // Fügt die Checkboxen hinzu
    for(let i = 0; i < criteria.syntax.length; i++) {
        addCheckbox(i, criteria, syntaxCriteriaArea, "syntax");
    }
    for(let i = 0; i < criteria.guidelines.length; i++) {
        addCheckbox(i, criteria, guidelineCriteriaArea, "guidelines");
    }
    for (let i = 0; i < criteria.other.length; i++) {
        addCheckbox(i, criteria, otherCriteriaArea, "other");
    }
}

/** Fügt eine Checkbox hinzu
 * 
 * @param {*} i Index welcher als ID für die Checkbox gesetzt wird
 * @param {*} criteria Kriteriumobjekt welches alle Kriterien beinhaltet
 * @param {*} criteriaArea Element im DOM wo die Checkbox eingefügt werden soll
 * @param {*} type Typ der Regel (Guideline oder Other)
 */
function addCheckbox(i, criteria, criteriaArea, type) {
    criteriaCheckBoxes[type][criteria[type][i].name] = true;

    let wrapper = document.createElement('div');
    wrapper.classList.add('col-6', 'col-md-4');

    let form = document.createElement('div');
    form.classList.add('form-check');

    let input = document.createElement('input');
    input.classList.add('form-check-input');
    input.setAttribute('type', 'checkbox');
    input.setAttribute('value', criteria[type][i].name);
    input.setAttribute('id', 'criteriaCheck'+type+i);
    input.setAttribute('checked', true);
    input.addEventListener('change', (evt) => {
        criteriaCheckBoxes[type][evt.target.value] = evt.target.checked;
        // Zählt die Anzahl der Regeln die geprüft werden sollen
        let counter = 0;
        for (let key in criteriaCheckBoxes[type]) {
            if (criteriaCheckBoxes[type][key]) {
                counter += 1;
            }
        }
        if (type == "syntax") {
            if (syntaxFilterNumber > counter) {
                syntaxFilterNumber = counter;
                document.getElementById('syntaxRulesChecked').innerText = syntaxFilterNumber;
            }
            document.getElementById('syntaxRulesTotal').innerText = counter;
        }
        if (type == "guidelines") {
            document.getElementById('guidelineFilterNumber').setAttribute('max', counter);
            if (bestPracticeFilterNumber > counter) {
                bestPracticeFilterNumber = counter;
                document.getElementById('curFilterNumber').innerText = bestPracticeFilterNumber;
                document.getElementById('guidelineRulesChecked').innerText = bestPracticeFilterNumber;
            }
            document.getElementById('guidelineRulesTotal').innerText = counter;
            document.getElementById('maxFilterNumber').innerText = counter;
        }
        if (type == "other") {
            document.getElementById('otherFilterNumber').setAttribute('max', counter);
            if (otherFilterNumber > counter) {
                otherFilterNumber = counter;
                document.getElementById('curOtherFilterNumber').innerText = otherFilterNumber;
                document.getElementById('otherRulesChecked').innerText = otherFilterNumber;
            }
            document.getElementById('otherRulesTotal').innerText = counter;
            document.getElementById('maxOtherFilterNumber').innerText = counter;
        }
        
        // Updated die Tabelle und die Anzahl der erfüllten Regeln
        deleteTable();
        if (finishedModels>0) countFulfilledRules();
        let numberPagesInPagination = processModels.length / ELEMENTS_IN_TABLE;
        numberPagesInPagination = (numberPagesInPagination < 1) ? 1 : numberPagesInPagination;
        addFilesToTable(processModels.slice(numberPagesInPagination*ELEMENTS_IN_TABLE-ELEMENTS_IN_TABLE, numberPagesInPagination*ELEMENTS_IN_TABLE));
    });

    let label = document.createElement('label');
    label.classList.add('form-check-label');
    label.setAttribute('for', 'criteriaCheck'+type+i);
    label.innerText = criteria[type][i].description + " [" + criteria[type][i].name + "]";

    form.appendChild(input);
    form.appendChild(label);
    wrapper.appendChild(form);
    criteriaArea.appendChild(wrapper);
}