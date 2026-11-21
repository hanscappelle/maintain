# Garageboek

Een web-app met enkel lokale data om voertuigen en hun onderhoudshistoriek bij te houden. Voeg motorfietsen, auto's of ander rollend materiaal toe en registreer per onderhoudsbeurt de datum, kilometerstand, werkzaamheden, notities en optionele kosten. Per voertuig zie je de historiek en een grafiek van de kilometerstand doorheen de tijd. Registraties en voertuigen kunnen worden aangepast of verwijderd.

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.08.png>)

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.15.png>)

![Finlit-demo](<assets/Screenshot 2026-11-19 at 10.54.24.png>)

## Online versie & Data opslag

De gepubliceerde website is beschikbaar op [betyre.alwaysdata.net/maintain](https://betyre.alwaysdata.net/maintain/). Let op want ook daar slaan wij geen gegvens op. Alle data is enkel in je browser cache beschikbaar. Je browser cache verwijderen betekent dat ook je data weg is. 

Je kan de data wel exporteren en opnieuw inladen om zo zelf bij te houden. Doe dit regelmatig om altijd een kopie van de laatste versie te bewaren. Het voordeel van deze implementatie is dat we geen login nodig hebben en geen centrale data opslag. 

## Gebruik

### Voertuigen aanmaken & beheren

Maak eerst een voertuig aan. Kies het in de zijbalk en voeg onderhoud toe. De laatst gekozen weergave (het algemene dashboard of een voertuig) wordt in de browser onthouden en na vernieuwen hersteld. Bestaat het laatst geselecteerde voertuig niet meer, dan wordt het eerste beschikbare voertuig gekozen. De weergave en voertuigselectie maken geen deel uit van de JSON-back-up. 

Met de menuknop naast het logo kun je de zijbalk inklappen en weer openen. In de ingeklapte zijbalk blijven voertuigknoppen met initialen zichtbaar; houd de aanwijzer boven een knop om de volledige naam te zien. 

De grafiek gebruikt de exacte datum en kilometerstand van elke registratie en toont op de kilometeras ronde stappen van minimaal 100 km; de tabel is gesorteerd op datum, nieuwste eerst. Bij meerdere registraties op dezelfde datum geldt de laatst aangemaakte registratie als de meest recente. Kilometerstanden hoeven niet op te lopen, zodat bijvoorbeeld een tellervervanging ook kan worden vastgelegd. De kosten zijn optioneel en worden in euro getoond.

Bij het verwijderen van een voertuig worden ook alle bijbehorende onderhoudshistoriek, voertuignotities en geplande werkzaamheden permanent verwijderd.

### Notities

Bij elk voertuig kun je afzonderlijke notities toevoegen in het post-it-raster tussen de grafiek en de historiek. Gebruik het driepuntjesmenu op een notitie om die te bewerken, te verwijderen of als belangrijk te markeren. De markering kan via hetzelfde menu weer worden verwijderd en wordt mee geëxporteerd. Deze notities staan los van de notities bij een onderhoudsregistratie.

Webadressen die beginnen met `http://` of `https://` zijn aanklikbaar in notities en onderhoudsbeschrijvingen. Ze openen in een nieuw tabblad of venster, afhankelijk van je browserinstellingen.

### Algemeen Dashboard

Via **Dashboard** in de zijbalk zie je statistieken en belangrijke notities van actieve voertuigen. Het kilometerverloop staat per voertuig op een kaartje in een raster. Bij twee of meer registraties op verschillende datums verschijnt op de achtergrond een grafiek van de geregistreerde kilometerstand tot en met vandaag; horizontale afstanden volgen de tijd en de schaal is per voertuig. Vanuit een kaartje of notitie kun je het bijbehorende voertuig openen. Het gemiddelde per jaar gebruikt de afstand tussen de eerste en laatste registratie tot en met vandaag, omgerekend met 365,25 dagen per jaar. Bij een dalende teller of registraties op slechts één datum wordt geen gemiddelde berekend.

De gemiddelde kost per kalenderjaar is de som van de opgegeven kosten tot en met vandaag, gedeeld door het aantal kalenderjaren met registraties voor dat voertuig. Jaren zonder registraties tellen niet mee; het lopende jaar telt mee zodra er een registratie is. Ontbrekende kosten worden niet meegerekend. Zonder opgegeven kosten wordt geen gemiddelde getoond.

### Archief

Kies **Archiveren** op een voertuigpagina wanneer je het voertuig niet langer actief wilt opvolgen. Het verschijnt daarna apart onder **Archief** in de zijbalk; selecteer het daar om de historiek te bekijken of kies **Terugzetten** om het opnieuw actief te maken. Alle registraties, notities en geplande werkzaamheden blijven bewaard en worden mee geëxporteerd. Gearchiveerde voertuigen en hun gegevens tellen niet mee op het algemene dashboard, inclusief de belangrijke notities en planning. Na terugzetten verschijnen hun geplande werkzaamheden opnieuw.

### Geplande werkzaamheden

Bij **Geplande werkzaamheden** op de voertuigpagina stel je zelf een datum, kilometerstand of beide in. Het dashboard toont de geplande werkzaamheden van actieve voertuigen, met bereikte en naderende werkzaamheden bovenaan. Een werkzaamheid nadert binnen 30 dagen of 1.000 km; de teller **Aandacht nodig** telt alleen naderende en bereikte werkzaamheden. De eerste bereikte grens telt; de kilometerstand is de laatst geregistreerde stand tot en met vandaag, geen voorspelling van de actuele stand. Zonder kilometerregistratie kan een kilometergrens niet worden beoordeeld; die werkzaamheden worden apart aangeduid en niet als naderend geteld. Dit zijn geen automatische meldingen en geen onderhoudsadvies; open de app om ze te bekijken. Na **Afgehandeld** verdwijnt de werkzaamheid uit de planning; maak indien gewenst afzonderlijk een onderhoudsregistratie aan en plan een volgende beurt.

## Optionele lokale Installatie

Als je niet de online versie wilt gebruiken kun je dit project ook uitchecken en met NodeJs zelf lokaal opstarten. Alles rond opslag blijft hetzelfde. 

Vereist: Node.js 20 of nieuwer.

```sh
npm install
npm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Voor automatisch herstarten tijdens ontwikkeling is er `npm run dev`. Stel indien gewenst de omgevingsvariabele `PORT` in om een andere poort te gebruiken.

## Opslag en JSON-bestanden

De app bewaart wijzigingen automatisch in de lokale opslag van **de huidige browser en het huidige adres**. De gegevens staan niet op de Node.js-server en worden niet automatisch naar een bestand geschreven. Een andere browser, computer of poort heeft eigen opslag. Het wissen van browsergegevens of het gebruik van een privévenster kan deze gegevens verwijderen.

- Kies **Backup maken** om alle voertuigen, onderhoud, voertuignotities en geplande werkzaamheden als back-upbestand op te slaan. De bestandsnaam bevat de lokale datum en tijd tot op de seconde, bijvoorbeeld `garageboek-2026-11-21_09-42-49.json`. Download opnieuw na wijzigingen; een eerder gedownload bestand wordt niet automatisch bijgewerkt. Back-ups die in dezelfde seconde worden gemaakt krijgen dezelfde voorgestelde naam; je browser kan die aanpassen.
- Kies **Bestand openen** om een eerder gedownload Garageboek-bestand te openen. Na validatie toont de bevestiging het aantal voertuigen en het totaal aantal records in de huidige sessie en het bestand. Records omvatten onderhoudsregistraties, notities en geplande werkzaamheden; gearchiveerde voertuigen tellen mee. Na bevestiging start automatisch een download van de huidige gegevens als back-up, waarna het bestand alle huidige browsergegevens vervangt; het voegt ze niet samen. Controleer of je browser de download toestaat en het bestand heeft opgeslagen. Ongeldige bestanden en geannuleerde imports vervangen de bestaande gegevens niet en starten geen back-up.
- Om gegevens op een andere computer te gebruiken: download de nieuwste versie, kopieer het bestand en upload het daar. Wijzigingen op verschillende computers worden niet automatisch gesynchroniseerd.
- De melding dat gegevens alleen in deze browser worden bewaard, kan worden gesloten. De sluitkeuze wordt lokaal onthouden en de melding verschijnt opnieuw wanneer je een voertuig toevoegt aan een lege garage of een back-upbestand opent.

Nieuwe bestanden hebben versie `5` en bevatten `vehicles`, `maintenance`, `notes` en `reminders`, met verwijzingen via voertuig-ID's en de archiefstatus per voertuig. Bestaande bestanden en browsergegevens van versie `1` tot en met `4` blijven leesbaar en worden bij de volgende wijziging naar versie `5` omgezet; voertuigen uit oudere bestanden zijn standaard actief. Oudere versies van de app kunnen versie `5` niet lezen. Herlaad daarom ook eventuele andere open tabbladen na een update. Alleen bestanden in dit Garageboek-formaat worden ondersteund. Browseropslag kan door browserinstellingen of opslaglimieten geweigerd worden; de app meldt dat als opslaan of importeren mislukt.

## Tests

```sh
npm test
```

## Beveiliging

De applicatie luistert alleen op `127.0.0.1` en heeft geen gebruikersaccounts of toegangscontrole. Ze is bedoeld voor lokaal, vertrouwd gebruik. Iedereen met toegang tot de browseropslag of een geëxporteerd bestand kan de gegevens lezen. Stel de app niet rechtstreeks bloot aan een netwerk of het internet zonder passende beveiliging.
