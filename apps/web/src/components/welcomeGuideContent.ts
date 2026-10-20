import type { Account } from '../api/auth'

// Keep this catalogue current when adding or changing user-facing features.
export const guideCopy = {
  en: {
    open: 'Welcome guide', familyGuide: 'Family settings guide', back: 'Previous tip', next: 'Next tip', finish: 'Finish guide', skip: 'Close guide', visit: 'Try this page', progress: 'Step',
    steps: [
      ['Welcome to Mad Planner', 'Keep your recipes, weekly meals, and groceries together. Follow these tips at your own pace. You can close the guide and reopen it using Welcome guide.', ''],
      ['Your recipe collection', 'Search and filter recipes, open one to see ingredients and cooking steps, and use cooking mode to follow along. Long descriptions have a Read more button. Owners and editors can use Edit recipe on their own family recipes to change details, ingredients, and steps.', '/recipes'],
      ['Bring your own recipes', 'Add a recipe yourself, import a recipe from a website, or scan a cookbook. Review the ingredients and steps before saving.', '/recipes/import'],
      ['Plan meals together', 'Choose meals for your week or review smart suggestions. Family settings control household size, leftovers, and meal types.', '/planner'],
      ['Shop with your family', 'Your planned meals provide the grocery list. Add extra items and tick off purchases as you shop.', '/grocery-list'],
      ['Make the app your own', 'In Family, Personal settings lets you choose your language, dark mode, menu colour, nutrition display, and browser notifications. These preferences belong to your own account, not the whole family.', '/family#personal-settings'],
      ['Protect your account', 'In Account security, set up an authenticator app for two-step sign-in. Keep the recovery codes somewhere safe so you can still sign in if you lose your phone.', '/family#account-security'],
      ['Family planning settings', 'Family options apply to everyone. The owner can set household size, meal types, leftovers, cooking mode, planning reminders and how suggestions are chosen. Rating-based planning becomes available when enough recipes have ratings. Use Save family options to save changes; other members can view these settings.', '/family#family-options'],
      ['Recipe types and family members', 'Recipe types organise your collection and can connect recipes to a planner meal. The owner can manage these types and invite members as editors, planners, or viewers. Choose permissions carefully and share the generated invitation link with the intended person.', '/family#recipe-types'],
      ['Your family and your voice', 'Manage your preferences in Family. Send feedback as an improvement, bug, or feature request. Answers to your questions appear there, with a red badge for unread replies. Completion notices disappear after five days or when dismissed; completed requests stay in Closed requests.', '/family#family-feedback'],
      ['Keep discovering', 'Visit Updates to see improvements, bug fixes, and new features in the installed version. You can reopen this guide whenever you need it. System administrators can implement approved feedback in Admin, test a separate preview, request changes, and approve the tested commit for merging.', '/updates'],
    ],
  },
  da: {
    open: 'Velkomstguide', familyGuide: 'Guide til familieindstillinger', back: 'Forrige tip', next: 'Næste tip', finish: 'Afslut guiden', skip: 'Luk guiden', visit: 'Prøv denne side', progress: 'Trin',
    steps: [
      ['Velkommen til Mad Planner', 'Saml opskrifter, ugens måltider og indkøb ét sted. Følg guiden i dit eget tempo. Du kan lukke den og åbne den igen via Velkomstguide.', ''],
      ['Din opskriftssamling', 'Søg og filtrér opskrifter. Åbn en opskrift for at se ingredienser og fremgangsmåde, og følg trinene i madlavningstilstand. Lange beskrivelser har en Læs mere-knap. Ejere og redaktører kan bruge Redigér opskrift på familiens egne opskrifter for at ændre detaljer, ingredienser og trin.', '/recipes'],
      ['Tilføj dine opskrifter', 'Opret en opskrift selv, importér fra en hjemmeside eller scan en kogebog. Gennemgå ingredienser og trin, før du gemmer.', '/recipes/import'],
      ['Planlæg måltider sammen', 'Vælg ugens måltider eller gennemgå smarte forslag. Familieindstillinger styrer antal personer, rester og måltidstyper.', '/planner'],
      ['Køb ind med familien', 'Dine planlagte måltider danner indkøbslisten. Tilføj ekstra varer og markér dem som købt undervejs.', '/grocery-list'],
      ['Gør appen til din egen', 'Under Familie kan du vælge sprog, mørk tilstand, menufarve, næringsindhold og browsernotifikationer i Personlige indstillinger. Disse valg gælder din egen konto, ikke hele familien.', '/family#personal-settings'],
      ['Beskyt din konto', 'Under Kontosikkerhed kan du tilføje en godkendelsesapp til login i to trin. Gem gendannelseskoderne et sikkert sted, så du stadig kan logge ind, hvis du mister din telefon.', '/family#account-security'],
      ['Familiens planlægningsindstillinger', 'Familieindstillinger gælder alle. Ejeren kan vælge antal personer, måltidstyper, rester, madlavningstilstand, påmindelser og hvordan forslag vælges. Planlægning efter bedømmelser bliver tilgængelig, når nok opskrifter er bedømt. Brug Gem familieindstillinger for at gemme ændringer; andre medlemmer kan se indstillingerne.', '/family#family-options'],
      ['Opskriftstyper og familiemedlemmer', 'Opskriftstyper organiserer samlingen og kan knytte opskrifter til et måltid i planen. Ejeren kan administrere typerne og invitere medlemmer som redaktører, planlæggere eller læsere. Vælg rettigheder omhyggeligt og del invitationslinket med den rette person.', '/family#recipe-types'],
      ['Din familie og dine ønsker', 'Tilpas dine indstillinger under Familie. Send forbedringer, fejl eller funktionsønsker. Svar på dine spørgsmål vises her med et rødt mærke for ulæste svar. Beskeder om afsluttede ønsker forsvinder efter fem dage, eller når du afviser dem; ønskerne bliver i Lukkede ønsker.', '/family#family-feedback'],
      ['Se det nye', 'Under Opdateringer finder du forbedringer, fejlrettelser og nye funktioner i den installerede version. Åbn guiden igen, når du har brug for den. Systemadministratorer kan implementere godkendt feedback under Admin, teste en separat forhåndsvisning, bede om ændringer og godkende det testede commit til sammenfletning.', '/updates'],
    ],
  },
  nl: {
    open: 'Welkomstgids', familyGuide: 'Gids voor gezinsinstellingen', back: 'Vorige tip', next: 'Volgende tip', finish: 'Gids afronden', skip: 'Gids sluiten', visit: 'Probeer deze pagina', progress: 'Stap',
    steps: [
      ['Welkom bij Mad Planner', 'Bewaar recepten, weekmaaltijden en boodschappen op één plek. Volg de tips in je eigen tempo. Je kunt de gids sluiten en opnieuw openen via Welkomstgids.', ''],
      ['Je receptenverzameling', 'Zoek en filter recepten. Open een recept voor ingrediënten en stappen en volg de kookmodus. Lange beschrijvingen hebben een Lees meer-knop. Eigenaren en bewerkers kunnen eigen gezinsrecepten aanpassen met Recept bewerken, inclusief details, ingrediënten en stappen.', '/recipes'],
      ['Voeg je recepten toe', 'Maak zelf een recept, importeer van een website of scan een kookboek. Controleer ingrediënten en stappen voordat je opslaat.', '/recipes/import'],
      ['Plan samen maaltijden', 'Kies maaltijden voor de week of bekijk slimme suggesties. Gezinsinstellingen bepalen personen, restjes en maaltijdtypen.', '/planner'],
      ['Doe samen boodschappen', 'Geplande maaltijden vormen je boodschappenlijst. Voeg extra artikelen toe en vink aankopen af tijdens het winkelen.', '/grocery-list'],
      ['Maak de app persoonlijk', 'Bij Gezin kies je onder Persoonlijke instellingen je taal, donkere modus, menukleur, voedingswaarden en browsermeldingen. Deze voorkeuren gelden voor je eigen account, niet voor het hele gezin.', '/family#personal-settings'],
      ['Beveilig je account', 'Stel bij Accountbeveiliging een authenticator-app in voor aanmelden in twee stappen. Bewaar de herstelcodes veilig, zodat je kunt inloggen als je je telefoon verliest.', '/family#account-security'],
      ['Gezinsinstellingen voor planning', 'Gezinsopties gelden voor iedereen. De eigenaar kiest personen, maaltijdtypen, restjes, kookmodus, herinneringen en hoe suggesties worden gekozen. Plannen op beoordeling wordt beschikbaar zodra genoeg recepten beoordelingen hebben. Gebruik Gezinsopties opslaan om wijzigingen te bewaren; andere leden kunnen deze instellingen bekijken.', '/family#family-options'],
      ['Recepttypen en gezinsleden', 'Recepttypen ordenen de verzameling en kunnen recepten aan een maaltijd in de planner koppelen. De eigenaar beheert typen en nodigt leden uit als bewerker, planner of kijker. Kies rechten zorgvuldig en deel de uitnodigingslink met de bedoelde persoon.', '/family#recipe-types'],
      ['Je gezin en je ideeën', 'Pas voorkeuren aan bij Gezin. Stuur verbeteringen, fouten of functieverzoeken. Antwoorden op je vragen staan daar met een rode badge voor ongelezen antwoorden. Meldingen over afgeronde verzoeken verdwijnen na vijf dagen of als je ze sluit; de verzoeken blijven bij Gesloten verzoeken.', '/family#family-feedback'],
      ['Blijf ontdekken', 'Bekijk Updates voor verbeteringen, opgeloste fouten en nieuwe functies in de geïnstalleerde versie. Open deze gids wanneer je wilt. Systeembeheerders kunnen goedgekeurde feedback bij Admin implementeren, een aparte preview testen, wijzigingen aanvragen en de geteste commit goedkeuren voor samenvoegen.', '/updates'],
    ],
  },
}

export function guideStorageKey(account: Pick<Account, 'id' | 'family_id'>) {
  return `madplanner:welcome:${account.family_id}:${account.id}`
}

