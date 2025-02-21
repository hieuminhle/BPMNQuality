# BPMNQuality

## Über das Projekt

Dieses Tool (BPMNQuality) wurde entwickelt, um BPMN-Diagramme auf Konformität mit gängigen Standards und Best Practices zu überprüfen.
Es ist im Rahmen des Masterprojekts "System Quality Engineering" im Sommersemester 2024 an der Technischen Universität Berlin in Zusammenarbeit mit dem Fraunhofer FOKUS entstanden.

Projektbeteiligte: Luisa Wittig, Miriam Richter, Leonhardt Hollatz, Minh Hieu Le

Unter der Betreuung von Lukas Strey

## Allgemeine Voraussetzungen

[NodeJS](https://nodejs.org/en): [Download und Installation](https://nodejs.org/en/download) <br>
[NPM](https://www.npmjs.com/): [Download und Installation](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) <br>
Die Installation von NodeJS enthält bereits eine npm Version.

## Projektvorbereitung

Es wird die Camunda Platform 7 in der Community Edition benötigt. Für die Installation siehe die [Downloadseite von Camunda](https://camunda.com/de/download/platform-7/). Wir empfehlen eine [Installation über docker](https://docs.camunda.org/manual/7.21/installation/docker/).
Die Camunda Platform ist dann unter [localhost:8080](http://localhost:8080) erreichbar. Die initialen Accountdaten sind demo / demo.

Um das Projekt vorzubereiten, müssen im Hauptordner "wfmCamunda" die beiden folgenden Befehle ausgeführt werden:
```
npm install
npm install express
```

Außerdem müssen im Ordner "wfmCamunda/serviceWorker" die folgenden Befehle ausgeführt werden:
```
npm install
npm install bpmn-moddle
```

npm install fügt einen "node_modules"-Ordner dem jeweiligen Ordner hinzu.
[Express](https://expressjs.com) wird für die Ausführung des Webservers benötigt, um die Weboberfläche auszuliefern.
[bpmn-moddle](https://github.com/bpmn-io/bpmn-moddle) wird als externe Library benötigt, um BPMN-Modelle in JSON zu übersetzen.

Das BPMN-Modell muss initial "deployt" werden, d.h. in der Camunda Plattform hinterlegt werden. Am einfachsten geschieht das über den [Camunda Modeler](https://camunda.com/de/download/modeler). Die Version des Modelers spielt keine Rolle. Diese muss lediglich die Camunda Platform 7 unterstützen. Wir empfehlen die derzeit aktuellste Version 5.25.
Dazu muss das BPMN-Modell "BPMNQuality.bpmn" im Modeler geöffnet werden und in der unteren Leiste links auf das Raketen-Symbol gedrückt werden. Es öffnet sich ein Fenster, bei dem nur noch auf "Deploy" gedrückt werden muss. Die Camunda Platform muss für diesen Schritt im Hintergrund erreichbar sein. Es sollte ein kleines Erfolgsfenster erscheinen.
Eine andere Möglichkeit ist es, das Modell über die REST API zu deployen. Weitere Informationen dazu finden sich in der [REST API Spezifikation](https://docs.camunda.org/rest/camunda-bpm-platform/7.21/#tag/Deployment/operation/createDeployment) der Camunda Platform.
Wenn alles funktioniert hat, ist das BPMN-Modell im [Camunda Cockpit](http://localhost:8080/camunda/app/cockpit/default/#/dashboard) einsehbar.

## Ausführung der Projekts

Die Weboberfläche wird über den Express-Server im wfmCamuda-Ordner ausgeliefert. Dazu muss der Server zuerst gestartet werden. Dafür gibt es mehrere Möglichkeiten:
``
npm run start
``
oder
``
node start.js
``. 
Einer dieser Befehle muss über die Eingabeaufforderung/Konsole/Terminal im Ordner "wfmCamunda" ausgeführt werden.

Der Server läuft auf dem Port 5500. Die Weboberfläche ist damit erreichbar, wenn im Browser [localhost:5500](http://localhost:5500) aufgerufen wird.

Die Service Worker müssen einzeln gestartet werden. Diese befinden sich im Ordner "wfmCamunda/serviceWorker". Dazu muss jeweils in einer eigenen Eingabeaufforderung/Konsole/Terminal der genannte Ordner geöffnet werden und folgende Befehle eingegeben werden (ein Befehl pro Konsole):
```
node workerXmlToJson.js
node workerSyntaxChecks.js
node workerGuidelineChecks.js
node workerOtherChecks.js
```

Die Camunda Platform muss auch für diesen Schritt im Hintergrund erreichbar sein. Wenn alles funktioniert hat, erscheint in der Konsole ein grüner Schriftzug "subscribed to topic ...". 